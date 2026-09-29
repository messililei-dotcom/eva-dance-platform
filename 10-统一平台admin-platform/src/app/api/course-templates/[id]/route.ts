import { cleanText, hasAuth, openTrainingDb, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  if (typeof body.websiteVisible !== 'boolean') {
    return Response.json({ success: false, error: '官网展示状态无效' }, { status: 400 });
  }

  const db = openTrainingDb();
  try {
    const result = db.prepare(`
      UPDATE CourseTemplate
      SET websiteVisible = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(body.websiteVisible ? 1 : 0, routeParams.id);
    if (!result.changes) return Response.json({ success: false, error: '课程不存在' }, { status: 404 });
    return Response.json({ success: true, websiteVisible: body.websiteVisible });
  } finally {
    db.close();
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  const type = cleanText(body.type, '集训');
  if (!name) return Response.json({ success: false, error: '请填写课程名称' }, { status: 400 });

  const db = openTrainingDb();
  try {
    const current = db.prepare('SELECT * FROM CourseTemplate WHERE id = ?').get(routeParams.id) as any;
    if (!current) return Response.json({ success: false, error: '课程不存在' }, { status: 404 });

    const duplicate = db.prepare(`
      SELECT * FROM CourseTemplate
      WHERE id <> ?
        AND LOWER(TRIM(name)) = LOWER(TRIM(?))
        AND COALESCE(isActive, 1) = 1
      LIMIT 1
    `).get(routeParams.id, name) as any;
    const mergeTargetId = Number(body.mergeTargetId || 0);
    if (duplicate && mergeTargetId !== Number(duplicate.id)) {
      return Response.json({ success: false, error: '已存在同名课程，请确认是否合并', mergeTargetId: duplicate.id }, { status: 409 });
    }

    const coverImage = cleanText(body.coverImage);
    const content = cleanText(body.content);
    if (duplicate) {
      db.transaction(() => {
        db.prepare('UPDATE Course SET templateId = ? WHERE templateId = ?').run(duplicate.id, routeParams.id);
        db.prepare(`
          UPDATE Course
          SET name = ?, type = ?, coverImage = ?, content = ?
          WHERE templateId = ?
        `).run(name, type, cleanText(duplicate.coverImage), cleanText(duplicate.content), duplicate.id);
        db.prepare('DELETE FROM CourseTemplate WHERE id = ?').run(routeParams.id);
      })();
      return Response.json({ success: true, merged: true, id: Number(duplicate.id) });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE CourseTemplate
        SET name = ?, type = 'offline', trainingType = ?, coverImage = ?, content = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(name, type, coverImage, content, routeParams.id);

      db.prepare(`
        UPDATE Course
        SET name = ?, type = ?, coverImage = ?, content = ?
        WHERE templateId = ?
      `).run(name, type, coverImage, content, routeParams.id);
    })();

    return Response.json({ success: true, merged: false, id: Number(routeParams.id) });
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const db = openTrainingDb();
  try {
    const current = db.prepare('SELECT id, name FROM CourseTemplate WHERE id = ?').get(routeParams.id) as any;
    if (!current) return Response.json({ success: false, error: '课程不存在' }, { status: 404 });

    // 课程期次是学员缴费的上游记录：没有期次就不可能有该课程的关联学员。
    // 把检查收紧到 Course 表，并在 DELETE 本身中再做一次不存在校验，
    // 既兼容旧库的 Payment 字段差异，也避免检查后新增期次的竞态。
    const result = db.prepare(`
      DELETE FROM CourseTemplate
      WHERE id = ?
        AND NOT EXISTS (
          SELECT 1 FROM Course WHERE Course.templateId = CourseTemplate.id
        )
    `).run(routeParams.id);
    if (!result.changes) {
      const linked = db.prepare('SELECT COUNT(*) AS periodCount FROM Course WHERE templateId = ?').get(routeParams.id) as any;
      const periodCount = Number(linked?.periodCount || 0);
      return Response.json({
        success: false,
        error: `已有 ${periodCount} 个课程期次，不能删除；只能删除没有期次的空课程`,
      }, { status: 409 });
    }
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
