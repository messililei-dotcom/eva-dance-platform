import { jsonError, toPositiveInt, withDb } from '../../../_materials';
import { deauthorizeMemberIdentity } from '../_authorization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const body = await request.json().catch(() => ({}));
  const seriesId = toPositiveInt(routeParams.id);
  const memberId = toPositiveInt(body.member_id);
  const phone = String(body.phone || '').trim();
  if (!seriesId || (!memberId && !phone)) return jsonError('请选择学员', 400);

  try {
    return withDb((db) => Response.json({ success: true, ...deauthorizeMemberIdentity(db, seriesId, memberId, phone) }));
  } catch (err: any) {
    return jsonError(err?.message || '取消授权失败');
  }
}
