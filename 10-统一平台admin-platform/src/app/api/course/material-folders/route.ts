import { assertValidFolderParent, cleanText, folderRowsWithCounts, jsonError, toPositiveInt, withDb } from '../_materials';
import { hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const { tree, flat, total } = folderRowsWithCounts(db);
      return Response.json({ success: true, data: tree, flat, total_materials: total });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取文件夹失败', err?.status || 500);
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return jsonError('文件夹名称不能为空', 400);
  try {
    return withDb((db) => {
      const parentId = Math.max(0, toPositiveInt(body.parent_id, 0));
      assertValidFolderParent(db, parentId);
      const duplicate = db.prepare('SELECT id FROM MaterialFolder WHERE parent_id=? AND lower(name)=lower(?)').get(parentId, name);
      if (duplicate) return jsonError('同一文件夹下已存在同名文件夹', 409);
      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order),0) as sort_order FROM MaterialFolder WHERE parent_id=?').get(parentId);
      const result = db.prepare('INSERT INTO MaterialFolder (name, parent_id, sort_order) VALUES (?, ?, ?)').run(name, parentId, Number(maxSort?.sort_order || 0) + 1);
      return Response.json({ success: true, data: { id: result.lastInsertRowid, name, parent_id: parentId } });
    });
  } catch (err: any) {
    return jsonError(err?.message || '创建文件夹失败', err?.status || 500);
  }
}
