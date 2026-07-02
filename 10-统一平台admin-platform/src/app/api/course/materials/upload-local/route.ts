import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { authPayloadFromRequest, hasAuth, unauthorized } from '../../../training-db';
import {
  MATERIAL_CENTER_ROOT,
  MATERIAL_CENTER_SEGMENTS,
  MaterialRuleError,
  cleanText,
  ensureMaterialFingerprintSchema,
  ensureDefaultMaterialFolder,
  materialFolderById,
  jsonError,
  materialTypeFromFile,
  saveThumbnailDataUrl,
  safeName,
  toPositiveInt,
  uniqueDiskName,
  uploadUrl,
  withDb,
} from '../../_materials';
import { deleteVodVideos, getVodConfigStatus, uploadLocalVideoToVod } from '@/lib/server/aliyun-vod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GIB = 1024 * 1024 * 1024;
function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
const MAX_FILE_SIZE = positiveNumber(process.env.MAX_MATERIAL_UPLOAD_FILE_SIZE, 2 * GIB);
const MAX_TOTAL_SIZE = positiveNumber(process.env.MAX_MATERIAL_UPLOAD_REQUEST_SIZE, 5 * GIB);
const MAX_SYNC_THUMBNAIL_VIDEO_SIZE = positiveNumber(process.env.MAX_SYNC_VIDEO_THUMBNAIL_SIZE, 300 * 1024 * 1024);
const { execFileSync } = require('node:child_process');
const Busboy = require('next/dist/compiled/busboy');
const DIRECT_PLAYABLE_VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm', '.m3u8']);
const pendingUploadKeys = new Set<string>();
const pendingUploadHashes = new Set<string>();

function formatBytes(value: number) {
  if (value >= GIB) return `${Number((value / GIB).toFixed(1))}GB`;
  return `${Math.ceil(value / 1024 / 1024)}MB`;
}

function requestAbortedError() {
  const err = new Error('上传已停止');
  (err as any).status = 499;
  return err;
}

function decodePossiblyMojibake(value: string) {
  const text = String(value || '');
  if (!text) return '';
  if (!/[ÃÂãåèçæéïð]/.test(text)) return text;
  try {
    const decoded = Buffer.from(text, 'latin1').toString('utf8');
    if (decoded && !decoded.includes('�')) return decoded;
  } catch {}
  return text;
}

function httpError(message: string, status = 500) {
  const err = new Error(message);
  (err as any).status = status;
  return err;
}

type ParsedUploadFile = {
  tempPath: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileHash: string;
};

function busboyFileInfo(infoOrFilename: any, encoding?: string, mimeType?: string) {
  if (infoOrFilename && typeof infoOrFilename === 'object') {
    return {
      filename: decodePossiblyMojibake(String(infoOrFilename.filename || '')),
      mimeType: String(infoOrFilename.mimeType || infoOrFilename.mime || ''),
    };
  }
  return {
    filename: decodePossiblyMojibake(String(infoOrFilename || '')),
    mimeType: String(mimeType || ''),
  };
}

async function parseUploadRequest(request: Request) {
  if (!request.body) throw httpError('请选择本地文件', 400);
  const fields = new Map<string, string>();
  const files: ParsedUploadFile[] = [];
  const tempFiles: string[] = [];
  const tempRoot = path.join(MATERIAL_CENTER_ROOT, '_tmp');
  await fsp.mkdir(tempRoot, { recursive: true });

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_TOTAL_SIZE + 1024 * 1024) {
    throw httpError(`单次上传总大小超过限制（${formatBytes(MAX_TOTAL_SIZE)}）`, 413);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      let totalSize = 0;
      let settled = false;
      const pendingWrites: Promise<void>[] = [];
      const source = Readable.fromWeb(request.body as any);
      const busboy = Busboy({
        headers: Object.fromEntries(request.headers.entries()),
        defCharset: 'utf8',
        defParamCharset: 'utf8',
        limits: {
          fileSize: MAX_FILE_SIZE,
          files: 20,
          fields: 50,
        },
      });

      const cleanup = () => {
        request.signal.removeEventListener('abort', onAbort);
        source.off('error', fail);
        busboy.off('error', fail);
        busboy.off('finish', done);
      };

      const fail = (err: any) => {
        if (settled) return;
        settled = true;
        cleanup();
        source.destroy();
        reject(err);
      };

      const done = () => {
        Promise.all(pendingWrites)
          .then(() => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
          })
          .catch(fail);
      };

      const onAbort = () => fail(requestAbortedError());
      if (request.signal.aborted) {
        onAbort();
        return;
      }

      request.signal.addEventListener('abort', onAbort, { once: true });
      source.on('error', fail);
      busboy.on('error', fail);
      busboy.on('finish', done);
      busboy.on('field', (name: string, value: string) => {
        fields.set(name, value);
      });
      busboy.on('file', (fieldName: string, fileStream: NodeJS.ReadableStream, infoOrFilename: any, encoding?: string, mimeType?: string) => {
        if (fieldName !== 'files') {
          fileStream.resume();
          return;
        }
        const info = busboyFileInfo(infoOrFilename, encoding, mimeType);
        const originalName = safeName(info.filename || `material-${Date.now()}`);
        const tempPath = path.join(tempRoot, `${Date.now()}-${Math.random().toString(16).slice(2)}-${originalName}`);
        tempFiles.push(tempPath);
        const output = fs.createWriteStream(tempPath);
        const fileHash = crypto.createHash('sha256');
        let fileSize = 0;
        let rejected = false;

        const writePromise = new Promise<void>((resolveFile, rejectFile) => {
          const rejectOnce = (err: any) => {
            if (rejected) return;
            rejected = true;
            output.destroy();
            rejectFile(err);
            if (typeof (busboy as any).destroy === 'function') (busboy as any).destroy(err);
          };

          fileStream.on('data', (chunk: Buffer) => {
            fileSize += chunk.length;
            totalSize += chunk.length;
            fileHash.update(chunk);
            if (totalSize > MAX_TOTAL_SIZE) {
              rejectOnce(httpError(`单次上传总大小超过限制（${formatBytes(MAX_TOTAL_SIZE)}）`, 413));
            }
          });
          fileStream.on('limit', () => {
            rejectOnce(httpError(`单文件不得超过${formatBytes(MAX_FILE_SIZE)}：${originalName}`, 413));
            fileStream.resume();
          });
          fileStream.on('error', rejectOnce);
          output.on('error', rejectOnce);
          output.on('finish', () => {
            if (rejected) return;
            files.push({ tempPath, originalName, mimeType: info.mimeType, size: fileSize, fileHash: fileHash.digest('hex') });
            resolveFile();
          });
        }).catch(async (err) => {
          await fsp.unlink(tempPath).catch(() => {});
          throw err;
        });
        pendingWrites.push(writePromise);
        fileStream.pipe(output);
      });
      source.pipe(busboy);
    });
  } catch (err) {
    await Promise.all(tempFiles.map(file => fsp.unlink(file).catch(() => {})));
    throw err;
  }

  return { fields, files, tempFiles };
}

function videoFormatWarning(name: string) {
  const ext = path.extname(name).toLowerCase();
  if (!ext || DIRECT_PLAYABLE_VIDEO_EXTENSIONS.has(ext)) return '';
  return `视频格式 ${ext} 可能无法在 VOD 或浏览器直接播放，建议转换为 MP4 后重新上传`;
}

function ensureTargetFolder(db: any, folderId: number) {
  if (folderId > 0) {
    const existing = materialFolderById(db, folderId);
    if (existing) return existing;
    throw new MaterialRuleError('目标文件夹不存在');
  }
  return ensureDefaultMaterialFolder(db);
}

function duplicateKey(name: string, type: string, size: number) {
  return `${name.toLowerCase()}\u0000${type}\u0000${size}`;
}

function findDuplicateMaterial(db: any, name: string, type: string, size: number) {
  return db.prepare(`
    SELECT m.id, m.name, m.type, m.file_size, m.folder_id, f.name AS folder_name
    FROM Material m
    LEFT JOIN MaterialFolder f ON f.id=m.folder_id
    WHERE lower(m.name)=lower(?) AND m.type=? AND m.file_size=?
    LIMIT 1
  `).get(name, type, size);
}

function findDuplicateMaterialByHash(db: any, fileHash: string, type: string, size: number) {
  const hash = cleanText(fileHash);
  if (!hash) return null;
  return db.prepare(`
    SELECT m.id, m.name, m.type, m.file_size, m.folder_id, f.name AS folder_name
    FROM Material m
    LEFT JOIN MaterialFolder f ON f.id=m.folder_id
    WHERE m.file_hash=? AND m.type=? AND m.file_size=?
    LIMIT 1
  `).get(hash, type, size);
}

type PendingVodTask = {
  materialId: number;
  absolutePath: string;
  diskName: string;
  size: number;
  originalName: string;
  tempOnly: boolean;
};

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const writtenFiles: string[] = [];
  const uploadedVodIds: string[] = [];
  const pendingVodTasks: PendingVodTask[] = [];
  const warnings: Array<{ file: string; message: string }> = [];
  let parsedUpload: Awaited<ReturnType<typeof parseUploadRequest>> | null = null;

  function assertRequestActive() {
    if (request.signal.aborted) {
      const err = new Error('上传已停止');
      (err as any).status = 499;
      throw err;
    }
  }

  try {
    assertRequestActive();
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) return jsonError('请选择本地文件', 400);

    parsedUpload = await parseUploadRequest(request);
    assertRequestActive();
    const files = parsedUpload.files.filter(item => item.size > 0);
    if (!files.length) return jsonError('请选择本地文件', 400);

    const oversized = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversized.length) {
      const names = oversized.slice(0, 3).map(file => file.originalName || '未命名素材').join('、');
      throw httpError(`单文件不得超过${formatBytes(MAX_FILE_SIZE)}：${names}${oversized.length > 3 ? ' 等' : ''}`, 413);
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) throw httpError(`单次上传总大小超过限制（${formatBytes(MAX_TOTAL_SIZE)}）`, 413);

    const requestedFolderId = toPositiveInt(parsedUpload.fields.get('folder_id') || parsedUpload.fields.get('folderId'), 0);
    const authPayload = authPayloadFromRequest(request);
    const uploadedBy = Math.max(0, Number(parsedUpload.fields.get('uploaded_by') || authPayload?.id || 0));
    const thumbnailDataUrl = parsedUpload.fields.get('thumbnail_data_url');

    return await withDb(async (db) => {
      ensureMaterialFingerprintSchema(db);
      const folder = ensureTargetFolder(db, requestedFolderId);
      const folderId = Number(folder.id);
      const created: any[] = [];
      const incoming = new Set<string>();

      for (const file of files) {
        assertRequestActive();
        const originalName = safeName(file.originalName || `material-${Date.now()}`);
        const type = materialTypeFromFile({ type: file.mimeType } as File, originalName);
        const size = file.size || 0;
        const key = duplicateKey(originalName, type, size);
        const fileHash = cleanText(file.fileHash);
        if (incoming.has(key)) {
          throw httpError(`已有重复的素材「${originalName}」，不能上传重复的素材`, 409);
        }
        incoming.add(key);

        const duplicateByHash = findDuplicateMaterialByHash(db, fileHash, type, size);
        if (duplicateByHash) {
          const folderText = duplicateByHash.folder_name ? `（${duplicateByHash.folder_name}）` : '';
          throw httpError(`已有素材「${duplicateByHash.name}」${folderText}，禁止重复上传`, 409);
        }
        const duplicate = findDuplicateMaterial(db, originalName, type, size);
        if (duplicate) {
          const folderText = duplicate.folder_name ? `（${duplicate.folder_name}）` : '';
          throw httpError(`已有重复的素材「${duplicate.name}」${folderText}，不能上传重复的素材`, 409);
        }
        if (fileHash && pendingUploadHashes.has(fileHash)) {
          throw httpError(`素材「${originalName}」正在上传处理中，请勿重复提交`, 409);
        }
        if (pendingUploadKeys.has(key)) {
          throw httpError(`素材「${originalName}」正在上传处理中，请勿重复提交`, 409);
        }
        pendingUploadKeys.add(key);
        if (fileHash) pendingUploadHashes.add(fileHash);

        try {
          const dir = path.join(MATERIAL_CENTER_ROOT, String(folderId), type);
          const isVideo = type === 'video';
          const vodConfig = isVideo ? getVodConfigStatus() : null;
          const videoMustUseVod = Boolean(isVideo && vodConfig?.ready);
          await fsp.mkdir(dir, { recursive: true });

          const diskName = videoMustUseVod ? originalName : await uniqueDiskName(dir, originalName);
          const absolutePath = videoMustUseVod ? file.tempPath : path.join(dir, diskName);
          if (!videoMustUseVod) {
            await fsp.rename(file.tempPath, absolutePath);
            writtenFiles.push(absolutePath);
          }
          assertRequestActive();

          const filePath = videoMustUseVod
            ? ''
            : uploadUrl(...MATERIAL_CENTER_SEGMENTS, folderId, type, encodeURIComponent(diskName));
          let thumbnail = '';
          if (isVideo) {
            const savedThumbnail = saveThumbnailDataUrl(thumbnailDataUrl, dir, diskName);
            if (savedThumbnail) {
              writtenFiles.push(savedThumbnail.absolutePath);
              thumbnail = uploadUrl(...MATERIAL_CENTER_SEGMENTS, folderId, type, encodeURIComponent(savedThumbnail.filename));
            }
          }
          if (isVideo && !thumbnail && !videoMustUseVod && size <= MAX_SYNC_THUMBNAIL_VIDEO_SIZE) {
            try {
              const thumbBase = path.basename(absolutePath, path.extname(absolutePath));
              const thumbPath = path.join(dir, `${thumbBase}-thumb-${Date.now()}.jpg`);
              execFileSync('ffmpeg', ['-y', '-ss', '5', '-i', absolutePath, '-vframes', '1', '-vf', 'scale=640:-1', '-q:v', '3', thumbPath], {
                timeout: 30000,
                stdio: 'ignore',
              });
              if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 5000) {
                writtenFiles.push(thumbPath);
                thumbnail = uploadUrl(...MATERIAL_CENTER_SEGMENTS, folderId, type, encodeURIComponent(path.basename(thumbPath)));
              }
            } catch {}
          }

          let vodVideoId = '';
          let vodMediaId = '';
          let transcodeStatus = 'success';
          let needsVodUpload = false;
          if (isVideo) {
            const formatWarning = videoFormatWarning(originalName);
            if (vodConfig?.ready) {
              needsVodUpload = true;
              transcodeStatus = 'pending';
              if (formatWarning) {
                warnings.push({ file: originalName, message: formatWarning });
              }
            } else {
              warnings.push({
                file: originalName,
                message: `VOD 未配置，已保留本地素材（缺少 ${vodConfig?.missingRequired.join(' / ')}）${formatWarning ? `；${formatWarning}` : ''}`,
              });
              transcodeStatus = DIRECT_PLAYABLE_VIDEO_EXTENSIONS.has(path.extname(originalName).toLowerCase()) ? 'success' : 'failed';
            }
          }

          const result = db.prepare(`
            INSERT INTO Material (
              name, type, folder_id, file_path, file_url, file_size,
              duration, thumbnail, transcode_status, risk_status, uploaded_by,
              vod_media_id, vod_video_id, file_hash, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'passed', ?, ?, ?, ?,
              datetime('now','localtime'), datetime('now','localtime'))
          `).run(originalName, type, folderId, filePath, filePath, size, thumbnail, transcodeStatus, uploadedBy, vodMediaId, vodVideoId, fileHash);

          const materialId = Number(result.lastInsertRowid);

          created.push({
            materialId,
            id: materialId,
            name: originalName,
            type,
            folder_id: folderId,
            folder_name: folder.name,
            file_path: filePath,
            file_url: filePath,
            file_size: size,
            file_hash: fileHash,
            thumbnail,
            vod_media_id: vodMediaId,
            vod_video_id: vodVideoId,
            transcode_status: transcodeStatus,
          });

          // 记录待后台上传的 VOD 任务
          if (needsVodUpload) {
            pendingVodTasks.push({
              materialId,
              absolutePath,
              diskName,
              size,
              originalName,
              tempOnly: videoMustUseVod,
            });
          }
        } finally {
          pendingUploadKeys.delete(key);
          if (fileHash) pendingUploadHashes.delete(fileHash);
        }
      }

      // 平台只等待“文件上传到 VOD 并取得 VideoId”。后续转码由 VOD 自动化独立完成，
      // 不再把转码状态暴露为上传流程的一部分，避免前端长时间停在“转码中”。
      if (pendingVodTasks.length) {
        for (const task of pendingVodTasks) {
          try {
            const uploaded = await uploadLocalVideoToVod({
              filePath: task.absolutePath,
              fileName: task.diskName,
              fileSize: task.size,
              title: task.originalName,
            });
            db.prepare(
              "UPDATE Material SET vod_video_id=?, vod_media_id=?, transcode_status='success', updated_at=datetime('now','localtime') WHERE id=?"
            ).run(uploaded.videoId, uploaded.videoId, task.materialId);
            uploadedVodIds.push(uploaded.videoId);
            if (task.tempOnly) {
              await fsp.unlink(task.absolutePath).catch(() => {});
            }
            const item = created.find(row => row.id === task.materialId);
            if (item) {
              item.vod_video_id = uploaded.videoId;
              item.vod_media_id = uploaded.videoId;
              item.transcode_status = 'success';
            }
            console.log(`[VOD] 上传完成: ${task.originalName} → ${uploaded.videoId}`);
          } catch (vodErr: any) {
            console.error(`[VOD] 上传失败: ${task.originalName} - ${vodErr?.message || vodErr}`);
            if (task.tempOnly) {
              await fsp.unlink(task.absolutePath).catch(() => {});
              db.prepare('DELETE FROM Material WHERE id=?').run(task.materialId);
              const index = created.findIndex(row => row.id === task.materialId);
              if (index >= 0) created.splice(index, 1);
              warnings.push({
                file: task.originalName,
                message: `VOD 上传失败，视频未保存到云服务器系统盘：${cleanText(vodErr?.message, '请稍后重新上传')}`,
              });
              continue;
            }
            const localStatus = DIRECT_PLAYABLE_VIDEO_EXTENSIONS.has(path.extname(task.originalName).toLowerCase()) ? 'success' : 'failed';
            db.prepare(
              "UPDATE Material SET transcode_status=?, updated_at=datetime('now','localtime') WHERE id=?"
            ).run(localStatus, task.materialId);
            const item = created.find(row => row.id === task.materialId);
            if (item) item.transcode_status = localStatus;
            warnings.push({
              file: task.originalName,
              message: `VOD 上传失败，已保留本地素材：${cleanText(vodErr?.message, '请稍后重新同步 VOD')}`,
            });
          }
        }
      }

      if (!created.length && warnings.length) {
        throw httpError(warnings[0]?.message || 'VOD 上传失败，视频未保存到云服务器系统盘', 502);
      }

      return Response.json({
        success: true,
        count: created.length,
        data: created,
        warnings,
        vod: getVodConfigStatus(),
      });
    }) as any;
  } catch (err: any) {
    if (uploadedVodIds.length) await deleteVodVideos(uploadedVodIds).catch(() => null);
    await Promise.all((parsedUpload?.tempFiles || []).map(file => fsp.unlink(file).catch(() => {})));
    await Promise.all(writtenFiles.map(file => fsp.unlink(file).catch(() => {})));
    return jsonError(cleanText(err?.message, '上传失败'), err?.status || 500);
  }
}
