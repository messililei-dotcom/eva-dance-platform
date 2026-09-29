import { cleanText, deletePaymentOrder, findMatchingCourseByIdentity, hasAuth, mergeCourseInto, openTrainingDb, syncCourseDenormalizedFields, toNumber, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return Response.json({ success: false, error: '请填写课程名称' }, { status: 400 });

  const db = openTrainingDb();
  try {
    const templateId = Math.max(0, toNumber(body.templateId));
    const template = templateId ? db.prepare('SELECT * FROM CourseTemplate WHERE id = ?').get(templateId) as any : null;
    if (templateId && !template) {
      return Response.json({ success: false, error: '所选课程不存在，请重新选择' }, { status: 400 });
    }
    const result = db.transaction(() => {
      const current = db.prepare('SELECT id FROM Course WHERE id = ?').get(routeParams.id);
      if (!current) return { changes: 0 };

      const courseName = cleanText(template?.name || name);
      const courseType = cleanText(template?.trainingType || body.type, '集训');
      const mergeTarget = findMatchingCourseByIdentity(db, courseName, body.subType, routeParams.id);
      if (mergeTarget) {
        const mergeResult = mergeCourseInto(db, routeParams.id, mergeTarget.id);
        return { changes: 1, ...mergeResult };
      }

      const info = db.prepare(`
        UPDATE Course
        SET name = ?, type = ?, subType = ?, startDate = ?, endDate = ?, price = ?,
            sessions = ?, validDays = ?, teacher = ?, content = ?, coverImage = ?, templateId = ?
        WHERE id = ?
      `).run(
        courseName,
        courseType,
        cleanText(body.subType),
        cleanText(body.startDate),
        cleanText(body.endDate),
        toNumber(body.price),
        Math.max(1, toNumber(body.sessions, 10)),
        cleanText(body.validDays),
        cleanText(body.teacher),
        cleanText(template?.content || body.content),
        cleanText(template?.coverImage || body.coverImage),
        templateId,
        routeParams.id,
      );
      syncCourseDenormalizedFields(db, routeParams.id);
      return info;
    })();
    if (!result.changes) return Response.json({ success: false, error: '课程不存在' }, { status: 404 });
    return Response.json({ success: true, merged: Boolean((result as any).merged), targetId: (result as any).targetId });
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
