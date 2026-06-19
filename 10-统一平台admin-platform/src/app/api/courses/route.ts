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
    const existing = findMatchingCourseByIdentity(db, name, body.subType);
    if (existing) {
      return Response.json({ success: true, id: existing.id, existing: true });
    }

    const result = db.prepare(`
      INSERT INTO Course (
        name, type, subType, startDate, endDate, price, sessions, validDays,
        teacher, content, coverImage, series_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
    );
    return Response.json({ success: true, id: result.lastInsertRowid });
  } finally {
    db.close();
  }
}
