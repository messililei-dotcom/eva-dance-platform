import { assertValidFolderParent, jsonError, materialFolderById, toPositiveInt, withDb } from '../../../_materials';
import { hasAuth, unauthorized } from '../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  try {
    return withDb((db) => {
      const id = toPositiveInt(routeParams.id);
      const parentId = Math.max(0, toPositiveInt(body.parent_id, 0));
      const folder = materialFolderById(db, id);
      if (!folder) return jsonError('文件夹不存在', 404);
      assertValidFolderParent(db, parentId, id);
      const duplicate = db.prepare('SELECT id FROM MaterialFolder WHERE id != ? AND parent_id=? AND lower(name)=lower(?)').get(id, parentId, folder.name);
      if (duplicate) return jsonError('目标文件夹下已存在同名文件夹', 409);
      const result = db.prepare("UPDATE MaterialFolder SET parent_id=?, sort_order=?, updated_at=datetime('now','localtime') WHERE id=?")
        .run(parentId, Math.max(0, toPositiveInt(body.sort_order, 0)), id);
      if (!result.changes) return jsonError('文件夹不存在', 404);
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err?.message || '移动文件夹失败', err?.status || 500);
  }
}
