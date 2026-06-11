import { cleanText, deletePaymentOrder, hasAuth, openTrainingDb, syncCourseDenormalizedFields, toNumber, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return Response.json({ success: false, error: '请填写课程名称' }, { status: 400 });

  const db = openTrainingDb();
  try {
    const result = db.transaction(() => {
      const info = db.prepare(`
        UPDATE Course
        SET name = ?, type = ?, subType = ?, startDate = ?, endDate = ?, price = ?,
            sessions = ?, validDays = ?, teacher = ?, content = ?, coverImage = ?
        WHERE id = ?
      `).run(
        name,
        cleanText(body.type, '集训'),
        cleanText(body.subType),
        cleanText(body.startDate),
        cleanText(body.endDate),
        toNumber(body.price),
        Math.max(1, toNumber(body.sessions, 10)),
        cleanText(body.validDays),
        cleanText(body.teacher),
        cleanText(body.content),
        cleanText(body.coverImage),
        routeParams.id,
      );
      syncCourseDenormalizedFields(db, routeParams.id);
      return info;
    })();
    if (!result.changes) return Response.json({ success: false, error: '课程不存在' }, { status: 404 });
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const linked = db.prepare('SELECT COUNT(*) AS count FROM Payment WHERE courseId = ?').get(routeParams.id)?.count || 0;
    if (linked) return Response.json({ success: false, error: '该课程已有缴费记录，不能删除' }, { status: 409 });
    db.transaction(() => {
      const payments = db.prepare('SELECT id FROM Payment WHERE courseId = ?').all(routeParams.id);
      db.prepare('DELETE FROM ConsumeRecord WHERE courseId = ?').run(routeParams.id);
      db.prepare('DELETE FROM Payment WHERE courseId = ?').run(routeParams.id);
      payments.forEach((payment: any) => deletePaymentOrder(db, payment.id));
      db.prepare('DELETE FROM Course WHERE id = ?').run(routeParams.id);
    })();
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
