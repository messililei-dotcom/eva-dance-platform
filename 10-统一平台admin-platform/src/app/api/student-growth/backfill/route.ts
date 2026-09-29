import { backfillAllGrowth } from '@/lib/server/student-growth';
import { authPayloadFromRequest, openTrainingDb, requireSuperAdmin } from '../../training-db';

export async function POST(request: Request) {
  const denied = requireSuperAdmin(request, '仅超级管理员可执行成长数据回算');
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const apply = body.apply === true;
  const operator = authPayloadFromRequest(request);
  const db = openTrainingDb();
  try {
    const run = () => backfillAllGrowth(db, apply, operator?.username || operator?.id || 'local-super-admin');
    const report = apply ? db.transaction(run)() : run();
    return Response.json({ success: true, data: report });
  } finally {
    db.close();
  }
}
