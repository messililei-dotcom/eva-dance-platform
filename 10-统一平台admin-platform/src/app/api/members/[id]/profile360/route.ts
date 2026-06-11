import { hasAuth, openTrainingDb, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const member = db.prepare('SELECT * FROM Member WHERE id = ?').get(routeParams.id);
    if (!member) return Response.json({ success: false, error: '学员不存在' }, { status: 404 });
    const offlinePayments = db.prepare('SELECT * FROM Payment WHERE memberId = ? ORDER BY date DESC, id DESC').all(routeParams.id);
    const consumeRecords = db.prepare('SELECT * FROM ConsumeRecord WHERE memberId = ? ORDER BY consumeDate DESC, id DESC').all(routeParams.id);
    const summary = {
      offlineIncome: offlinePayments.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0),
      onlineIncome: 0,
      totalIncome: offlinePayments.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0),
      consumeCount: consumeRecords.reduce((sum: number, row: any) => sum + Number(row.count || 0), 0),
      authorizationCount: 0,
      completedVideoCount: 0,
      financeIncome: 0,
      financeOrderAmount: 0,
    };
    return Response.json({
      member,
      summary,
      offlinePayments,
      consumeRecords,
      courseOrders: [],
      authorizations: [],
      progress: [],
      financeIncomes: [],
      financeOrders: [],
      operationLogs: [],
    });
  } finally {
    db.close();
  }
}
