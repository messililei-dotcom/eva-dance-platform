import { cleanText, hasAuth, jsonError, openTrainingDb, toNumber, today, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const nextCount = Math.max(1, toNumber(body.count, 1));
  const db = openTrainingDb();
  try {
    const result = db.transaction(() => {
      const current = db.prepare('SELECT * FROM ConsumeRecord WHERE id = ?').get(routeParams.id);
      if (!current) return { changes: 0 };
      const payment = db.prepare('SELECT * FROM Payment WHERE id = ?').get(current.paymentId);
      if (!payment) throw new Error('缴费记录不存在');
      const restored = toNumber(payment.remainingSessions) + toNumber(current.count);
      if (restored < nextCount) throw new Error('剩余课时不足，无法调整核销次数');
      const remainingAfter = restored - nextCount;
      const info = db.prepare(`
        UPDATE ConsumeRecord
        SET count = ?, consumeDate = ?, remainingAfter = ?, operator = ?, remark = ?
        WHERE id = ?
      `).run(
        nextCount,
        cleanText(body.consumeDate, current.consumeDate || today()),
        remainingAfter,
        cleanText(body.operator, current.operator || ''),
        cleanText(body.remark, current.remark || ''),
        routeParams.id,
      );
      db.prepare('UPDATE Payment SET remainingSessions = ? WHERE id = ?').run(remainingAfter, payment.id);
      return info;
    })();
    if (!result.changes) return Response.json({ success: false, error: '核销记录不存在' }, { status: 404 });
    return Response.json({ success: true });
  } catch (err: any) {
    return jsonError(err?.message, 400, '编辑核销失败');
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const result = db.transaction(() => {
      const current = db.prepare('SELECT * FROM ConsumeRecord WHERE id = ?').get(routeParams.id);
      if (!current) return { changes: 0 };
      db.prepare('UPDATE Payment SET remainingSessions = remainingSessions + ? WHERE id = ?').run(toNumber(current.count), current.paymentId);
      return db.prepare('DELETE FROM ConsumeRecord WHERE id = ?').run(routeParams.id);
    })();
    if (!result.changes) return Response.json({ success: false, error: '核销记录不存在' }, { status: 404 });
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
