import { deleteLocalMaterialFiles, jsonError, toPositiveInt, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';
import { deleteVodVideos } from '@/lib/server/aliyun-vod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => toPositiveInt(id)).filter(Boolean) : [];
  if (!ids.length) return jsonError('请选择素材', 400);
  try {
    const checked = withDb((db) => {
      const placeholders = ids.map(() => '?').join(',');
      const refs = db.prepare(`SELECT material_id, COUNT(*) as cnt FROM CourseVideo WHERE material_id IN (${placeholders}) GROUP BY material_id`).all(...ids);
      if (refs.length) return Response.json({ success: false, message: '部分素材被课程引用，请先解除关联', refs }, { status: 400 });
      const materials = db.prepare(`SELECT id, file_path, file_url, thumbnail, vod_video_id FROM Material WHERE id IN (${placeholders})`).all(...ids);
      return { materials };
    });
    if (checked instanceof Response) return checked;

    const vodVideoIds = (checked as any).materials.map((item: any) => String(item.vod_video_id || '').trim()).filter(Boolean);
    if (vodVideoIds.length) await deleteVodVideos(vodVideoIds);

    const materials = (checked as any).materials as any[];
    const response = withDb((db) => {
      const stmt = db.prepare('DELETE FROM Material WHERE id=?');
      db.transaction((items: any[]) => items.forEach(item => stmt.run(item.id)))(materials);
      return Response.json({ success: true, deleted: materials.length, vod_synced: vodVideoIds.length });
    });
    await deleteLocalMaterialFiles(materials);
    return response;
  } catch (err: any) {
    return jsonError(err?.message || '批量删除失败');
  }
}
