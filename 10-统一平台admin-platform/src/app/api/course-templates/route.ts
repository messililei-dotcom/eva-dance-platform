import { cleanText, hasAuth, openTrainingDb, unauthorized } from '../training-db';

export const dynamic = 'force-dynamic';

function matchingTemplate(db: any, name: string) {
  return db.prepare(`
    SELECT * FROM CourseTemplate
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
      AND (LOWER(COALESCE(type, '')) = 'offline' OR COALESCE(trainingType, '') <> '')
    ORDER BY id ASC LIMIT 1
  `).get(name);
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      SELECT template.*,
             COALESCE(periodStats.periodCount, 0) AS periodCount,
             periodStats.latestPeriodAt
      FROM CourseTemplate template
      LEFT JOIN (
        SELECT templateId, COUNT(*) AS periodCount, MAX(created_at) AS latestPeriodAt
        FROM Course
        WHERE COALESCE(templateId, 0) > 0
        GROUP BY templateId
      ) periodStats ON periodStats.templateId = template.id
      WHERE COALESCE(template.isActive, 1) = 1
        AND (LOWER(COALESCE(template.type, '')) = 'offline' OR COALESCE(template.trainingType, '') <> '')
      ORDER BY
        CASE WHEN COALESCE(template.websiteVisible, 1) = 1 THEN 0 ELSE 1 END ASC,
        CASE WHEN COALESCE(periodStats.latestPeriodAt, '') = '' THEN 1 ELSE 0 END ASC,
        periodStats.latestPeriodAt DESC,
        template.created_at DESC,
        template.id DESC
    `).all() as any[];
    return Response.json(rows.map(row => ({
      ...row,
      type: cleanText(row.trainingType, '集训'),
    })));
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  const type = cleanText(body.type, '集训');
  if (!name) return Response.json({ success: false, error: '请填写课程名称' }, { status: 400 });

  const db = openTrainingDb();
  try {
    const existing = matchingTemplate(db, name);
    if (existing) return Response.json({ success: true, id: existing.id, existing: true });
    const result = db.prepare(`
      INSERT INTO CourseTemplate (name, slug, type, trainingType, coverImage, content, isActive, updated_at)
      VALUES (?, ?, 'offline', ?, ?, ?, 1, datetime('now', 'localtime'))
    `).run(
      name,
      `offline-course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      cleanText(body.coverImage),
      cleanText(body.content),
    );
    return Response.json({ success: true, id: result.lastInsertRowid });
  } finally {
    db.close();
  }
}
