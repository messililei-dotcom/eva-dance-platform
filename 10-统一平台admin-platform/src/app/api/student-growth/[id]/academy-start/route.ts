import { adminSetAcademyStart } from '@/lib/server/student-growth';
import { authPayloadFromRequest, openTrainingDb, requireSuperAdmin } from '../../../training-db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireSuperAdmin(request, '仅超级管理员可补录学院舞龄');
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const operator = authPayloadFromRequest(request);
  const db = openTrainingDb();
  try {
    const data = db.transaction(() => adminSetAcademyStart(db, {
      memberId: Number(id), startedAt: String(body.started_at || ''),
      source: body.source === 'imported' ? 'imported' : 'admin',
      evidence: String(body.evidence || ''), reason: String(body.reason || ''),
      operatorId: operator?.username || operator?.id || 'local-super-admin',
    }))();
    return Response.json({ success: true, data });
  } catch (error: any) {
    return Response.json({ success: false, error: error?.message || '舞龄补录失败' }, { status: 400 });
  } finally {
    db.close();
  }
}
