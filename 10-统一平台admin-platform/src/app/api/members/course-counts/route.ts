import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      WITH offline_counts AS (
        SELECT memberId, COUNT(DISTINCT courseId) AS courseCount
        FROM Payment
        GROUP BY memberId
      ), online_counts AS (
        SELECT member_id, COUNT(DISTINCT series_id) AS courseCount
        FROM CourseAuthorization
        WHERE status = 'active'
        GROUP BY member_id
      )
      SELECT
        m.id AS memberId,
        COALESCE(o.courseCount, 0) + COALESCE(a.courseCount, 0) AS courseCount
      FROM Member m
      LEFT JOIN offline_counts o ON o.memberId = m.id
      LEFT JOIN online_counts a ON a.member_id = m.id
      WHERE COALESCE(m.status, 'active') != 'deleted'
    `).all();
    return Response.json({ data: rows });
  } finally {
    db.close();
  }
}
