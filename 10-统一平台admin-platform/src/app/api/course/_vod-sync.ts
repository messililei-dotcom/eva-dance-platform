import { getVodConfigStatus, getVodVideoStatus, listVodVideos, type VodVideoInfo } from '@/lib/server/aliyun-vod';
import { cleanText, deleteLocalMaterialFiles, ensureDefaultMaterialFolder } from './_materials';

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
  const title = cleanText(video.title, `VOD-${video.videoId}`);
  return title.length > 180 ? `${title.slice(0, 170)}-${video.videoId.slice(0, 8)}` : title;
}

function insertMissingVodMaterials(db: any, videos: VodVideoInfo[]) {
  if (!videos.length) return { imported: 0 };
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
  const transaction = db.transaction((items: VodVideoInfo[]) => {
    for (const video of items) {
      if (existingIds.has(video.videoId)) continue;
      const name = materialNameFromVod(video);
      const status = statusFromVodStatus(video.status, 'processing');
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
  return { imported };
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
    return { checked: videos.length, imported: result.imported, ready: true, errors: 0 };
  } catch (err: any) {
    console.warn(`[VOD-SYNC] 拉取 VOD 文件列表失败：${err?.message || err}`);
    return { checked: 0, imported: 0, ready: true, errors: 1 };
  }
}

export async function syncVodMaterials(db: any, rows: VodMaterialRow[], options: { limit?: number } = {}) {
  const config = getVodConfigStatus();
  if (!config.ready) return { checked: 0, updated: 0, deleted: 0, missing: 0, errors: 0, skipped: rows.length, ready: false };

  const candidates = rows
    .filter(row => row?.type === 'video' && String(row.vod_video_id || '').trim())
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

    const nextStatus = statusFromVodStatus(vod.status, String(row.transcode_status || 'processing'));
    if (nextStatus !== row.transcode_status) {
      db.prepare("UPDATE Material SET transcode_status=?, updated_at=datetime('now','localtime') WHERE id=?").run(nextStatus, row.id);
      updated += 1;
    }
  }

  if (deletedMaterials.length) await deleteLocalMaterialFiles(deletedMaterials);
  return { checked, updated, deleted, missing, errors, skipped: Math.max(0, rows.length - candidates.length), ready: true };
}
