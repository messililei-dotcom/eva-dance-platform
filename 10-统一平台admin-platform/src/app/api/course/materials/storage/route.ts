import { MATERIAL_CENTER_ROOT, diskCapacityFor, jsonError, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const stats = db.prepare('SELECT COALESCE(SUM(file_size),0) as material_bytes, COUNT(*) as material_count FROM Material').get();
      const diskStats = diskCapacityFor(MATERIAL_CENTER_ROOT);
      return Response.json({
        success: true,
        path: MATERIAL_CENTER_ROOT,
        material_bytes: Number(stats?.material_bytes || 0),
        material_count: Number(stats?.material_count || 0),
        ...(diskStats || { used_bytes: Number(stats?.material_bytes || 0), total_bytes: 0, free_bytes: 0, available_bytes: 0 }),
      });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取存储容量失败');
  }
}
