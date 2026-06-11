import { assertValidFolderParent, cleanText, ensureDefaultMaterialFolder, jsonError, toPositiveInt, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return jsonError('文件夹名称不能为空', 400);
  try {
    return withDb((db) => {
      const parentId = Math.max(0, toPositiveInt(body.parent_id, 0));
      const id = toPositiveInt(routeParams.id);
      assertValidFolderParent(db, parentId, id);
      const duplicate = db.prepare('SELECT id FROM MaterialFolder WHERE id != ? AND parent_id=? AND lower(name)=lower(?)').get(id, parentId, name);
      if (duplicate) return jsonError('同一文件夹下已存在同名文件夹', 409);
      const result = db.prepare("UPDATE MaterialFolder SET name=?, parent_id=?, updated_at=datetime('now','localtime') WHERE id=?").run(name, parentId, id);
      if (!result.changes) return jsonError('文件夹不存在', 404);
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err?.message || '更新文件夹失败', err?.status || 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const id = toPositiveInt(routeParams.id);
      const defaultFolder = ensureDefaultMaterialFolder(db);
      if (id === Number(defaultFolder.id)) return jsonError('不能删除默认文件夹', 400);
      const result = db.transaction(() => {
        db.prepare('UPDATE Material SET folder_id=? WHERE folder_id=?').run(Number(defaultFolder.id), id);
        db.prepare('UPDATE MaterialFolder SET parent_id=0 WHERE parent_id=?').run(id);
        return db.prepare('DELETE FROM MaterialFolder WHERE id=?').run(id);
      })();
      if (!result.changes) return jsonError('文件夹不存在', 404);
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err?.message || '删除文件夹失败', err?.status || 500);
  }
}
