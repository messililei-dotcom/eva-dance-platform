import { jsonError, toPositiveInt, withDb } from '../../../_materials';
import { hasAuth, unauthorized } from '../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));

  try {
    return withDb((db) => {
      const sourceMaterialId = toPositiveInt(routeParams.id);
      const targetMaterialId = toPositiveInt(body.target_material_id);
      if (!sourceMaterialId || !targetMaterialId) return jsonError('请选择要替换的视频素材', 400);
      if (sourceMaterialId === targetMaterialId) return jsonError('不能用素材自身进行替换', 400);

      const source = db.prepare('SELECT id, name, type FROM Material WHERE id=?').get(sourceMaterialId) as any;
      const target = db.prepare('SELECT id, name, type FROM Material WHERE id=?').get(targetMaterialId) as any;
      if (!source) return jsonError('当前素材不存在', 404);
      if (!target) return jsonError('目标素材不存在', 404);
      if (source.type !== 'video' || target.type !== 'video') return jsonError('只能在视频素材之间替换课程引用', 400);

      const replace = db.transaction(() => {
        const result = db.prepare('UPDATE CourseVideo SET material_id=? WHERE material_id=?')
          .run(targetMaterialId, sourceMaterialId);
        const moved = Number(result.changes || 0);
        db.prepare("UPDATE Material SET is_referenced=0, updated_at=datetime('now','localtime') WHERE id=?")
          .run(sourceMaterialId);
        const targetReferences = Number(
          (db.prepare('SELECT COUNT(*) AS count FROM CourseVideo WHERE material_id=?').get(targetMaterialId) as any)?.count || 0
        );
        db.prepare("UPDATE Material SET is_referenced=?, updated_at=datetime('now','localtime') WHERE id=?")
          .run(targetReferences > 0 ? 1 : 0, targetMaterialId);
        return { moved, targetReferences };
      });

      const result = replace();
      return Response.json({
        success: true,
        replaced: result.moved,
        source: { id: source.id, name: source.name, is_referenced: 0 },
        target: { id: target.id, name: target.name, is_referenced: result.targetReferences > 0 ? 1 : 0 },
      });
    });
  } catch (err: any) {
    return jsonError(err?.message || '替换素材引用失败');
  }
}
