import { jsonError, toPositiveInt, withDb } from '../../../_materials';
import { authPayloadFromRequest, requirePermission } from '../../../../training-db';
import { authorizeMembers } from '../_authorization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const permissionError = requirePermission(request, 'permOnlineAuthCreate');
  if (permissionError) return permissionError;

  const body = await request.json().catch(() => ({}));
  const seriesId = toPositiveInt(routeParams.id);
  const memberId = toPositiveInt(body.member_id);
  const grantedBy = toPositiveInt(authPayloadFromRequest(request)?.id) || 1;
  if (!seriesId || !memberId) return jsonError('请选择学员', 400);

  try {
    return withDb((db) => Response.json({
      success: true,
      ...authorizeMembers(db, seriesId, [memberId], grantedBy, body.order_vouchers, String(body.remark || ''), body),
    }));
  } catch (err: any) {
    return jsonError(err?.message || '授权失败');
  }
}
