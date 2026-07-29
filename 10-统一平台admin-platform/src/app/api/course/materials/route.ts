import { allowedSort, jsonError, withDb } from '../_materials';
import { hasAuth, unauthorized } from '../../training-db';
import { ensureLocalAuthTables } from '../../_local-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const search = new URL(request.url).searchParams;
  const folderId = search.get('folder_id');
  const type = search.get('type');
  const keyword = search.get('keyword') || '';
  const page = Math.max(1, Number(search.get('page') || 1));
  const pageSize = Math.min(200, Math.max(1, Number(search.get('pageSize') || 50)));
  const sortBy = allowedSort(search.get('sort_by'));
  const sortOrder = String(search.get('sort_order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const orderExpr = sortBy === 'is_referenced' ? 'is_referenced' : sortBy === 'uploaded_by' ? 'uploaded_by_name' : `m.${sortBy}`;

  try {
    return withDb(async (db) => {
      ensureLocalAuthTables(db);
      let where = 'WHERE 1=1';
      const params: any[] = [];
      if (folderId && folderId !== 'all') {
        const folderIds = folderId.split(',')
          .map(value => Number(value.trim()))
          .filter(value => Number.isFinite(value) && value > 0);
        if (folderIds.length) {
          where += ` AND m.folder_id IN (${folderIds.map(() => '?').join(',')})`;
          params.push(...folderIds);
        }
      }
      if (type && type !== 'all') {
        where += ' AND m.type=?';
        params.push(type);
      }
      if (keyword.trim()) {
        where += ' AND (m.name LIKE ? OR m.tags LIKE ? OR mf.name LIKE ?)';
        const like = `%${keyword.trim()}%`;
        params.push(like, like, like);
      }

      const fetchTotal = () => db.prepare(`
        SELECT COUNT(DISTINCT m.id) as total
        FROM Material m
        LEFT JOIN MaterialFolder mf ON mf.id = m.folder_id
        LEFT JOIN CourseVideo cv ON cv.material_id = m.id
        ${where}
      `).get(...params)?.total || 0;

      const fetchRows = () => db.prepare(`
        SELECT m.*,
               mf.name as folder_name,
               CASE WHEN COUNT(cv.id) > 0 THEN 1 ELSE 0 END as is_referenced,
               COALESCE(NULLIF(u.name, ''), NULLIF(mem.name, ''), (SELECT NULLIF(name, '') FROM User WHERE username='lilei' LIMIT 1), CASE WHEN m.uploaded_by > 0 THEN 'ID:' || m.uploaded_by ELSE '管理员' END) as uploaded_by_name
        FROM Material m
        LEFT JOIN MaterialFolder mf ON mf.id = m.folder_id
        LEFT JOIN CourseVideo cv ON cv.material_id = m.id
        LEFT JOIN User u ON u.id = m.uploaded_by
        LEFT JOIN Member mem ON mem.id = m.uploaded_by
        ${where}
        GROUP BY m.id
        ORDER BY ${orderExpr} ${sortOrder}, m.id DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, (page - 1) * pageSize);

      const total = fetchTotal();
      const rows = fetchRows();

      // Listing materials must remain a database-only operation. VOD reconciliation
      // can make dozens of external requests and is intentionally available through
      // the explicit /materials/vod-status action instead.
      return Response.json({ success: true, data: rows, total, page, pageSize });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取素材失败');
  }
}
