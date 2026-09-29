import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';
import { getGrowthSummary, listGrowthLedger } from '@/lib/server/student-growth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAuth(request)) return unauthorized();
  const { id } = await params;
  const memberId = Number(id);
  const db = openTrainingDb();
  try {
    const member = db.prepare('SELECT id,name,phone,avatar FROM Member WHERE id=?').get(memberId);
    if (!member) return Response.json({ success: false, error: '学员不存在' }, { status: 404 });
    const growth = getGrowthSummary(db, memberId);
    const ledger = listGrowthLedger(db, memberId, 200);
    const levelHistory = db.prepare('SELECT * FROM LevelChangeLog WHERE user_id=? ORDER BY id DESC LIMIT 100').all(memberId);
    const academyAudit = db.prepare('SELECT * FROM AcademyStartAudit WHERE user_id=? ORDER BY id DESC LIMIT 100').all(memberId);
    return Response.json({ success: true, data: { member, growth, ledger, level_history: levelHistory, academy_audit: academyAudit } });
  } finally {
    db.close();
  }
}
