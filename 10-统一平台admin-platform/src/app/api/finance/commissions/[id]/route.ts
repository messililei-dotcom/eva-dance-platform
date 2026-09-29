import { cleanText, jsonError, openTrainingDb, requirePermission, syncPaymentOrder, toNumber, today } from '../../../training-db';

export const dynamic = 'force-dynamic';

function commissionValues(amountValue: unknown, rateValue: unknown) {
  const amount = Math.max(0, toNumber(amountValue));
  const rate = Math.min(100, Math.max(0, toNumber(rateValue)));
  return {
    rate,
    amount: Math.round(amount * rate) / 100,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const permissionError = requirePermission(request, 'permPaymentEdit', '无权限编辑奖金提成');
  if (permissionError) return permissionError;

  const body = await request.json().catch(() => ({}));
  const db = openTrainingDb();

  try {
    const result = db.transaction(() => {
      const current = db.prepare('SELECT * FROM Payment WHERE id = ?').get(routeParams.id);
      if (!current) return { changes: 0 };

      const amount = Math.max(0, toNumber(body.amount, current.amount));
      const commission = commissionValues(amount, body.commissionRate ?? current.commissionRate);
      const info = db.prepare(`
        UPDATE Payment
        SET date = ?, amount = ?, payment = ?, sales = ?, remark = ?,
            commissionRate = ?, commissionAmount = ?
        WHERE id = ?
      `).run(
        cleanText(body.date, current.date || today()),
        amount,
        cleanText(body.payment, current.payment || ''),
        cleanText(body.sales, current.sales || ''),
        cleanText(body.remark, current.remark || ''),
        commission.rate,
        commission.amount,
        routeParams.id,
      );

      syncPaymentOrder(db, routeParams.id);
      return info;
    })();

    if (!result.changes) return Response.json({ success: false, error: '提成明细不存在' }, { status: 404 });
    return Response.json({ success: true });
  } catch (err: any) {
    return jsonError(err?.message, 400, '保存提成明细失败');
  } finally {
    db.close();
  }
}
