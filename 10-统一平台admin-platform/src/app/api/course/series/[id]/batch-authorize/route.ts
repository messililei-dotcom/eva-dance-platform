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
  const memberIds = Array.isArray(body.member_ids) ? body.member_ids.map((id: unknown) => toPositiveInt(id)).filter(Boolean) : [];
  const grantedBy = toPositiveInt(authPayloadFromRequest(request)?.id) || 1;
  if (!seriesId || !memberIds.length) return jsonError('请选择学员', 400);

  try {
    return withDb((db) => Response.json({ success: true, ...authorizeMembers(db, seriesId, memberIds, grantedBy) }));
  } catch (err: any) {
    return jsonError(err?.message || '批量授权失败');
  }
}
