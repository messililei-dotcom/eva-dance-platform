import { ensureDefaultMaterialFolder, materialFolderById, jsonError, toPositiveInt, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => toPositiveInt(id)).filter(Boolean) : [];
  const folderId = toPositiveInt(body.folder_id, 0);
  if (!ids.length) return jsonError('请选择素材', 400);
  try {
    return withDb((db) => {
      const defaultFolder = ensureDefaultMaterialFolder(db);
      const targetFolderId = folderId > 0 ? folderId : Number(defaultFolder.id);
      if (!materialFolderById(db, targetFolderId)) return jsonError('目标文件夹不存在', 404);
      const stmt = db.prepare("UPDATE Material SET folder_id=?, updated_at=datetime('now','localtime') WHERE id=?");
      db.transaction((items: number[]) => items.forEach(id => stmt.run(targetFolderId, id)))(ids);
      return Response.json({ success: true, moved: ids.length });
    });
  } catch (err: any) {
    return jsonError(err?.message || '批量移动失败');
  }
}
