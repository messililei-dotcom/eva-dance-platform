import { cleanText, findMatchingCourseByIdentity, hasAuth, openTrainingDb, toNumber, unauthorized } from '../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      SELECT *
      FROM Course
      ORDER BY COALESCE(NULLIF(startDate, ''), created_at) DESC, id DESC
    `).all();
    return Response.json(rows);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return Response.json({ success: false, error: '请填写课程名称' }, { status: 400 });

  const db = openTrainingDb();
  try {
    const templateId = Math.max(0, toNumber(body.templateId));
    const template = templateId
      ? db.prepare('SELECT * FROM CourseTemplate WHERE id = ?').get(templateId) as any
      : null;
    if (templateId && !template) {
      return Response.json({ success: false, error: '所选课程不存在，请重新选择' }, { status: 400 });
    }
    const courseName = cleanText(template?.name || name);
    const courseType = cleanText(template?.trainingType || body.type, '集训');
    const existing = findMatchingCourseByIdentity(db, courseName, body.subType);
    if (existing) {
      return Response.json({ success: true, id: existing.id, existing: true });
    }

    const result = db.prepare(`
      INSERT INTO Course (
        name, type, subType, startDate, endDate, price, sessions, validDays,
        teacher, content, coverImage, series_id, templateId
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
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
    );
    return Response.json({ success: true, id: result.lastInsertRowid });
  } finally {
    db.close();
  }
}
