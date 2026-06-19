import fs from 'fs';
import path from 'path';
import { deleteVodVideos, getVodConfigStatus, getVodPlayUrl, getVodVideoStatus, listVodVideos, uploadLocalVideoToVod, type VodVideoInfo } from '@/lib/server/aliyun-vod';
import { cleanText, deleteLocalMaterialFiles, ensureDefaultMaterialFolder, localMaterialPath } from './_materials';

type VodMaterialRow = {
  id: number;
  name?: string;
  type?: string;
  file_path?: string;
  file_url?: string;
  thumbnail?: string;
  vod_video_id?: string;
  transcode_status?: string;
  is_referenced?: number;
  file_size?: number;
  updated_at?: string;
};

function statusFromVodStatus(status: string | null, fallback: string) {
  switch (status) {
    case 'Normal':
      return 'success';
    case 'UploadFail':
    case 'TranscodeFail':
    case 'Blocked':
      return 'failed';
    case 'Uploading':
    case 'UploadSucc':
    case 'Transcoding':
      return 'processing';
    default:
      return fallback || 'processing';
  }
}

function materialNameFromVod(video: VodVideoInfo) {
  const title = cleanText(decodePossiblyMojibake(video.title), `VOD-${video.videoId}`);
  return title.length > 180 ? `${title.slice(0, 170)}-${video.videoId.slice(0, 8)}` : title;
}

function decodePossiblyMojibake(value: string) {
  const text = String(value || '');
  if (!text || !/[ÃÂãåèçæéïð]/.test(text)) return text;
  try {
    const decoded = Buffer.from(text, 'latin1').toString('utf8');
    if (decoded && !decoded.includes('�')) return decoded;
  } catch {}
  return text;
}

function comparableMaterialName(value: string) {
  return cleanText(decodePossiblyMojibake(value))
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .toLowerCase();
}

function localVideoFile(row: VodMaterialRow) {
  const candidates = [row.file_path, row.file_url]
    .map(value => localMaterialPath(String(value || '')))
    .filter((value): value is string => Boolean(value));
  return candidates.find(filePath => {
    if (!fs.existsSync(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    return ['.mp4', '.m4v', '.mov', '.webm', '.avi', '.mkv'].includes(ext);
  }) || '';
}

function isStaleVodUpload(row: VodMaterialRow) {
  const raw = String(row.updated_at || '').trim();
  if (!raw) return true;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const time = new Date(normalized).getTime();
  if (!Number.isFinite(time)) return true;
  return Date.now() - time > 10 * 60 * 1000;
}

async function reuploadLocalVideoToVod(db: any, row: VodMaterialRow) {
  const filePath = localVideoFile(row);
  if (!filePath) return false;
  const oldVideoId = String(row.vod_video_id || '').trim();
  const uploaded = await uploadLocalVideoToVod({
    filePath,
    fileName: path.basename(filePath),
    fileSize: Number(row.file_size || 0) || fs.statSync(filePath).size,
    title: row.name || path.basename(filePath),
  });
  db.prepare(`
    UPDATE Material
    SET vod_video_id=?,
        vod_media_id=?,
        transcode_status='processing',
        updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(uploaded.videoId, uploaded.videoId, row.id);
  if (oldVideoId && oldVideoId !== uploaded.videoId) {
    await deleteVodVideos([oldVideoId]).catch(() => null);
  }
  return true;
}

function claimLocalMaterialForVod(db: any, video: VodVideoInfo, name: string, status: string) {
  const targetName = comparableMaterialName(name);
  if (!targetName || !video.size) return false;
  const candidates = db.prepare(`
    SELECT id, name, thumbnail, is_referenced, vod_video_id
    FROM Material
    WHERE type='video'
      AND file_size=?
      AND COALESCE(vod_video_id,'')=''
    ORDER BY is_referenced DESC, id DESC
    LIMIT 20
  `).all(Math.max(0, Math.floor(video.size || 0)));
  const match = candidates.find((row: any) => comparableMaterialName(row.name || '') === targetName);
  if (!match) return false;
  db.prepare(`
    UPDATE Material
    SET name=?,
        vod_video_id=?,
        vod_media_id=?,
        thumbnail=COALESCE(NULLIF(thumbnail,''), ?),
        transcode_status=?,
        updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(name, video.videoId, video.videoId, video.coverUrl || '', status, match.id);
  return true;
}

function insertMissingVodMaterials(db: any, videos: VodVideoInfo[]) {
  if (!videos.length) return { imported: 0, claimed: 0 };
  const existingRows = db.prepare("SELECT vod_video_id FROM Material WHERE COALESCE(vod_video_id,'') != ''").all();
  const existingIds = new Set(existingRows.map((row: any) => String(row.vod_video_id || '').trim()).filter(Boolean));
  const defaultFolder = ensureDefaultMaterialFolder(db);
  const insertStmt = db.prepare(`
    INSERT INTO Material (
      name, type, folder_id, file_path, file_url, file_size,
      duration, thumbnail, transcode_status, risk_status, is_referenced,
      vod_media_id, vod_video_id, uploaded_by, created_at, updated_at
    )
    VALUES (?, 'video', ?, ?, '', ?, ?, ?, ?, 'passed', 0, ?, ?, 0,
      datetime('now','localtime'), datetime('now','localtime'))
  `);

  let imported = 0;
  let claimed = 0;
  const transaction = db.transaction((items: VodVideoInfo[]) => {
    for (const video of items) {
      if (existingIds.has(video.videoId)) continue;
      const name = materialNameFromVod(video);
      const status = statusFromVodStatus(video.status, 'processing');
      if (claimLocalMaterialForVod(db, video, name, status)) {
        existingIds.add(video.videoId);
        claimed += 1;
        continue;
      }
      insertStmt.run(
        name,
        Number(defaultFolder.id),
        `vod:${video.videoId}`,
        Math.max(0, Math.floor(video.size || 0)),
        Math.max(0, Math.round(video.duration || 0)),
        video.coverUrl || '',
        status,
        video.videoId,
        video.videoId,
      );
      existingIds.add(video.videoId);
      imported += 1;
    }
  });
  transaction(videos);
  return { imported, claimed };
}

export async function importMissingVodMaterials(db: any, options: { limit?: number } = {}) {
  const config = getVodConfigStatus();
  if (!config.ready) return { checked: 0, imported: 0, ready: false, errors: 0 };
  const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
  const pageSize = Math.min(100, limit);
  try {
    const videos: VodVideoInfo[] = [];
    let page = 1;
    while (videos.length < limit) {
      const vod = await listVodVideos({ page, pageSize: Math.min(pageSize, limit - videos.length) });
      videos.push(...vod.videos);
      if (!vod.videos.length || videos.length >= vod.total) break;
      page += 1;
    }
    const result = insertMissingVodMaterials(db, videos);
    return { checked: videos.length, imported: result.imported, claimed: result.claimed, ready: true, errors: 0 };
  } catch (err: any) {
    console.warn(`[VOD-SYNC] 拉取 VOD 文件列表失败：${err?.message || err}`);
    return { checked: 0, imported: 0, ready: true, errors: 1 };
  }
}

export async function syncVodMaterials(db: any, rows: VodMaterialRow[], options: { limit?: number; repairStaleUploads?: boolean } = {}) {
  const config = getVodConfigStatus();
  if (!config.ready) return { checked: 0, updated: 0, deleted: 0, missing: 0, errors: 0, skipped: rows.length, ready: false };

  const candidates = rows
    .filter(row => row?.type === 'video' && (String(row.vod_video_id || '').trim() || String(row.transcode_status || '') === 'pending'))
    .slice(0, Math.max(1, Math.min(50, Number(options.limit || 20))));
  let checked = 0;
  let updated = 0;
  let deleted = 0;
  let missing = 0;
  let errors = 0;
  const deletedMaterials: VodMaterialRow[] = [];

  for (const row of candidates) {
    checked += 1;
    const vodVideoId = String(row.vod_video_id || '').trim();
    if (!vodVideoId) {
      if (!options.repairStaleUploads) continue;
      try {
        if (await reuploadLocalVideoToVod(db, row)) {
          updated += 1;
        }
      } catch (err: any) {
        errors += 1;
        console.warn(`[VOD-SYNC] 本地素材 ${row.id} 重新上传 VOD 失败：${err?.message || err}`);
      }
      continue;
    }
    const vod = await getVodVideoStatus(vodVideoId).catch((err) => {
      errors += 1;
      console.warn(`[VOD-SYNC] 同步素材 ${row.id}(${vodVideoId}) 失败：${err?.message || err}`);
      return null;
    });
    if (!vod) continue;
    if (!vod.exists) {
      missing += 1;
      const refs = Number((row.is_referenced ?? db.prepare('SELECT COUNT(*) AS count FROM CourseVideo WHERE material_id=?').get(row.id)?.count) || 0);
      if (refs > 0) {
        db.prepare(`
          UPDATE Material
          SET vod_video_id='', vod_media_id='', transcode_status='failed', updated_at=datetime('now','localtime')
          WHERE id=?
        `).run(row.id);
        updated += 1;
      } else {
        db.prepare('DELETE FROM Material WHERE id=?').run(row.id);
        deletedMaterials.push(row);
        deleted += 1;
      }
      continue;
    }

    let nextStatus = statusFromVodStatus(vod.status, String(row.transcode_status || 'processing'));
    if (nextStatus === 'processing') {
      try {
        const playUrl = await getVodPlayUrl(vodVideoId);
        if (playUrl) nextStatus = 'success';
      } catch {}
    }
    if (options.repairStaleUploads && vod.status === 'Uploading' && isStaleVodUpload(row)) {
      try {
        if (await reuploadLocalVideoToVod(db, row)) {
          updated += 1;
          continue;
        }
      } catch (err: any) {
        errors += 1;
        console.warn(`[VOD-SYNC] 素材 ${row.id}(${vodVideoId}) 卡在上传中，重传失败：${err?.message || err}`);
      }
    }
    if (nextStatus !== row.transcode_status) {
      db.prepare("UPDATE Material SET transcode_status=?, updated_at=datetime('now','localtime') WHERE id=?").run(nextStatus, row.id);
      updated += 1;
    }
  }

  if (deletedMaterials.length) await deleteLocalMaterialFiles(deletedMaterials);
  return { checked, updated, deleted, missing, errors, skipped: Math.max(0, rows.length - candidates.length), ready: true };
}
