import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { hasAuth, unauthorized } from '../../../training-db';
import {
  MATERIAL_CENTER_ROOT,
  MATERIAL_CENTER_SEGMENTS,
  MaterialRuleError,
  cleanText,
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

const MAX_TOTAL_SIZE = 4 * 1024 * 1024 * 1024;
const { execFileSync } = require('node:child_process');
const DIRECT_PLAYABLE_VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm', '.m3u8']);

function requestAbortedError() {
  const err = new Error('上传已停止');
  (err as any).status = 499;
  return err;
}

async function writeFile(file: File, absolutePath: string, signal?: AbortSignal) {
  const writeStream = fs.createWriteStream(absolutePath);
  const reader = file.stream().getReader();
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
        writeStream.off('error', fail);
        writeStream.off('finish', done);
      };
      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        writeStream.destroy();
        reject(err);
      };
      const done = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onAbort = () => {
        reader.cancel().catch(() => {});
        fail(requestAbortedError());
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }

      signal?.addEventListener('abort', onAbort, { once: true });
      writeStream.on('error', fail);
      writeStream.on('finish', done);

      async function pump() {
        try {
          while (true) {
            if (signal?.aborted) throw requestAbortedError();
            const { done, value } = await reader.read();
            if (done) {
              writeStream.end();
              break;
            }
            if (signal?.aborted) throw requestAbortedError();
            if (!writeStream.write(Buffer.from(value))) {
              await new Promise<void>(done => writeStream.once('drain', () => done()));
            }
          }
        } catch (err) {
          fail(err);
        }
      }

      pump();
    });
  } catch (err) {
    writeStream.destroy();
    await fsp.unlink(absolutePath).catch(() => {});
    throw err;
  }
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

type PendingVodTask = {
  materialId: number;
  absolutePath: string;
  diskName: string;
  size: number;
  originalName: string;
};

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const writtenFiles: string[] = [];
  const uploadedVodIds: string[] = [];
  const pendingVodTasks: PendingVodTask[] = [];
  const warnings: Array<{ file: string; message: string }> = [];

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

    const formData = await request.formData();
    assertRequestActive();
    const files = formData.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
    if (!files.length) return jsonError('请选择本地文件', 400);

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) return jsonError('文件总大小超过限制', 413);

    const requestedFolderId = toPositiveInt(formData.get('folder_id') || formData.get('folderId'), 0);
    const uploadedBy = Math.max(0, Number(formData.get('uploaded_by') || 0));
    const thumbnailDataUrl = formData.get('thumbnail_data_url');

    return await withDb(async (db) => {
      const folder = ensureTargetFolder(db, requestedFolderId);
      const folderId = Number(folder.id);
      const created: any[] = [];
      const incoming = new Set<string>();

      for (const file of files) {
        assertRequestActive();
        const originalName = safeName(file.name || `material-${Date.now()}`);
        const type = materialTypeFromFile(file, originalName);
        const size = file.size || 0;
        const key = duplicateKey(originalName, type, size);
        if (incoming.has(key)) {
          return jsonError(`已有重复的素材「${originalName}」，不能上传重复的素材`, 409);
        }
        incoming.add(key);

        const duplicate = findDuplicateMaterial(db, originalName, type, size);
        if (duplicate) {
          const folderText = duplicate.folder_name ? `（${duplicate.folder_name}）` : '';
          return jsonError(`已有重复的素材「${duplicate.name}」${folderText}，不能上传重复的素材`, 409);
        }

        const dir = path.join(MATERIAL_CENTER_ROOT, String(folderId), type);
        await fsp.mkdir(dir, { recursive: true });

        const diskName = await uniqueDiskName(dir, originalName);
        const absolutePath = path.join(dir, diskName);
        await writeFile(file, absolutePath, request.signal);
        writtenFiles.push(absolutePath);
        assertRequestActive();

        const filePath = uploadUrl(...MATERIAL_CENTER_SEGMENTS, folderId, type, encodeURIComponent(diskName));
        let thumbnail = '';
        if (type === 'video') {
          const savedThumbnail = saveThumbnailDataUrl(thumbnailDataUrl, dir, diskName);
          if (savedThumbnail) {
            writtenFiles.push(savedThumbnail.absolutePath);
            thumbnail = uploadUrl(...MATERIAL_CENTER_SEGMENTS, folderId, type, encodeURIComponent(savedThumbnail.filename));
          }
        }
        if (type === 'video' && !thumbnail) {
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
        if (type === 'video') {
          const formatWarning = videoFormatWarning(originalName);
          const vodConfig = getVodConfigStatus();
          if (vodConfig.ready) {
            // VOD 上传改为异步后台任务，HTTP 请求立即返回
            needsVodUpload = true;
            transcodeStatus = 'pending';
            if (formatWarning) {
              warnings.push({ file: originalName, message: formatWarning });
            }
          } else {
            warnings.push({
              file: originalName,
              message: `VOD 未配置，已保留本地素材（缺少 ${vodConfig.missingRequired.join(' / ')}）${formatWarning ? `；${formatWarning}` : ''}`,
            });
            transcodeStatus = DIRECT_PLAYABLE_VIDEO_EXTENSIONS.has(path.extname(originalName).toLowerCase()) ? 'success' : 'failed';
          }
        }

        const result = db.prepare(`
          INSERT INTO Material (
            name, type, folder_id, file_path, file_url, file_size,
            duration, thumbnail, transcode_status, risk_status, uploaded_by,
            vod_media_id, vod_video_id, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'passed', ?, ?, ?,
            datetime('now','localtime'), datetime('now','localtime'))
        `).run(originalName, type, folderId, filePath, filePath, size, thumbnail, transcodeStatus, uploadedBy, vodMediaId, vodVideoId);

        const materialId = Number(result.lastInsertRowid);

        created.push({
          id: materialId,
          name: originalName,
          type,
          folder_id: folderId,
          folder_name: folder.name,
          file_path: filePath,
          file_url: filePath,
          file_size: size,
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
          });
        }
      }

      // 返回响应前启动后台 VOD 上传任务（不阻塞 HTTP 响应）
      if (pendingVodTasks.length) {
        // 串行执行后台 VOD 上传，避免内存暴涨
        (async () => {
          for (const task of pendingVodTasks) {
            try {
              const uploaded = await uploadLocalVideoToVod({
                filePath: task.absolutePath,
                fileName: task.diskName,
                fileSize: task.size,
                title: task.originalName,
              });
              // VOD 上传成功，更新 DB 中的 vod_video_id 和状态
              const { openAdminDb } = await import('@/lib/server/admin-db');
              const bgDb = openAdminDb();
              try {
                bgDb.prepare(
                  "UPDATE Material SET vod_video_id=?, vod_media_id=?, transcode_status='processing', updated_at=datetime('now','localtime') WHERE id=?"
                ).run(uploaded.videoId, uploaded.videoId, task.materialId);
              } finally {
                bgDb.close();
              }
              console.log(`[VOD-BG] 上传完成: ${task.originalName} → ${uploaded.videoId}`);
            } catch (bgErr: any) {
              console.error(`[VOD-BG] 上传失败: ${task.originalName} - ${bgErr?.message || bgErr}`);
              // 更新状态为 failed（本地文件仍可用播放）
              try {
                const { openAdminDb } = await import('@/lib/server/admin-db');
                const bgDb = openAdminDb();
                try {
                  bgDb.prepare(
                    "UPDATE Material SET transcode_status='success', updated_at=datetime('now','localtime') WHERE id=?"
                  ).run(task.materialId);
                } finally {
                  bgDb.close();
                }
              } catch {}
            }
          }
        })().catch(() => {});
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
    await Promise.all(writtenFiles.map(file => fsp.unlink(file).catch(() => {})));
    return jsonError(cleanText(err?.message, '上传失败'), err?.status || 500);
  }
}
