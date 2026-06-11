import { cleanText, ensureDefaultMaterialFolder, jsonError, materialFolderById, toPositiveInt, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  const type = cleanText(body.type);
  if (!name || !type) return jsonError('素材名称和类型不能为空', 400);
  if (!['video', 'image', 'pdf', 'audio'].includes(type)) return jsonError('素材类型不支持', 400);
  try {
    return withDb((db) => {
      const exists = db.prepare('SELECT id FROM Material WHERE lower(name)=lower(?) LIMIT 1').get(name);
      if (exists) return jsonError('素材已存在', 409);
      const requestedFolderId = toPositiveInt(body.folder_id, 0);
      const folder = requestedFolderId > 0 ? materialFolderById(db, requestedFolderId) : ensureDefaultMaterialFolder(db);
      if (!folder) return jsonError('目标文件夹不存在', 404);
      const filePath = cleanText(body.file_path || body.file_url);
      const thumbnail = cleanText(body.thumbnail || body.cover_url);
      const vodMediaId = cleanText(body.vod_media_id);
      const vodVideoId = cleanText(body.vod_video_id || body.video_id);
      const result = db.prepare(`
        INSERT INTO Material (
          name, type, folder_id, file_path, file_url, file_size, duration,
          thumbnail, transcode_status, risk_status, vod_media_id, vod_video_id, uploaded_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', 'passed', ?, ?, ?)
      `).run(
        name,
        type,
        Number(folder.id),
        filePath,
        cleanText(body.file_url || filePath),
        Math.max(0, Number(body.file_size || 0)),
        Math.max(0, Number(body.duration || 0)),
        thumbnail,
        vodMediaId,
        vodVideoId,
        Math.max(0, Number(body.uploaded_by || 0)),
      );
      return Response.json({ success: true, data: { id: result.lastInsertRowid, folder_id: Number(folder.id), vod_media_id: vodMediaId, vod_video_id: vodVideoId } });
    });
  } catch (err: any) {
    return jsonError(err?.message || '创建素材失败');
  }
}
