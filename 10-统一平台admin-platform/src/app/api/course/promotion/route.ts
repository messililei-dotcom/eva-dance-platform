import { withDb, jsonError } from '../_materials';
import { requirePermission, hasPermission } from '../../training-db';
import { getCoursePromotion } from '@/lib/server/course-promotion';
import { setCoursePromotion, PromotionConflict } from '@/lib/server/course-promotion-settings';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
export async function GET(request: Request) {
  const denied = requirePermission(request, 'permCourseView');
  if (denied) return denied;
  try { return withDb(db => Response.json({ success: true, data: { ...getCoursePromotion(db), canEdit: hasPermission(request, 'permCourseEdit') } }, { headers })); }
  catch { return jsonError('读取促销价设置失败', 503); }
}
export async function PATCH(request: Request) {
  const denied = requirePermission(request, 'permCourseEdit', '无权限修改课程促销设置');
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== 'boolean' || typeof body?.expectedRevision !== 'string') return jsonError('促销开关参数无效', 400);
  try {
    return withDb(db => Response.json({ success: true, data: { ...setCoursePromotion(db, body.enabled, body.expectedRevision), canEdit: true } }, { headers }));
  } catch (error) { return jsonError(error instanceof PromotionConflict ? error.message : '更新促销价设置失败', error instanceof PromotionConflict ? 409 : 503); }
}
