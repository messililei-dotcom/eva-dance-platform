import { jsonError, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';
import { importMissingVodMaterials } from '../../_vod-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const search = new URL(request.url).searchParams;
  const type = search.get('type');
  const keyword = search.get('keyword') || '';
  const page = Math.max(1, Number(search.get('page') || 1));
  const pageSize = Math.min(200, Math.max(1, Number(search.get('pageSize') || 50)));
  try {
    return withDb(async (db) => {
      await importMissingVodMaterials(db, { minIntervalMs: 15000 });
      let where = 'WHERE 1=1';
      const params: any[] = [];
      if (type && type !== 'all') {
        where += ' AND type=?';
        params.push(type);
      }
      if (keyword.trim()) {
        where += ' AND name LIKE ?';
        params.push(`%${keyword.trim()}%`);
      }
      const total = db.prepare(`SELECT COUNT(*) as total FROM Material ${where}`).get(...params)?.total || 0;
      const rows = db.prepare(`
        SELECT id, name, type, folder_id, file_path, file_url, file_size, duration, thumbnail, vod_media_id, vod_video_id, created_at
        FROM Material ${where}
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, (page - 1) * pageSize);
      return Response.json({ success: true, data: rows, total, page, pageSize });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取素材失败');
  }
}
