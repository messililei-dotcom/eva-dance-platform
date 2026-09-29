import { authPayloadFromRequest, hasAuth, openTrainingDb, unauthorized } from '../training-db';
import { ensureGrowthTables, formatAcademyAge } from '@/lib/server/student-growth';
import { pagePayload, readPage } from '@/lib/server/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const url = new URL(request.url);
  const level = Math.max(0, Number(url.searchParams.get('level')) || 0);
  const keyword = String(url.searchParams.get('keyword') || '').trim();
  const paging = readPage(url, { pageSize: 20, maxPageSize: 100 });
  const db = openTrainingDb();
  try {
    ensureGrowthTables(db);
    const where = `WHERE COALESCE(m.status,'active')!='deleted'
        AND (?=0 OR COALESCE(g.level_no,1)=?)
        AND (?='' OR m.name LIKE '%'||?||'%' OR m.phone LIKE '%'||?||'%' OR CAST(m.id AS TEXT) LIKE '%'||?||'%')`;
    const params = [level, level, keyword, keyword, keyword, keyword];
    const total = Number(db.prepare(`
      SELECT COUNT(*) AS value FROM Member m
      LEFT JOIN StudentGrowthSummary g ON g.user_id=m.id
      ${where}
    `).get<any>(...params)?.value || 0);
    const rows = db.prepare(`
      SELECT m.id,m.name,m.phone,m.city,m.status,m.avatar,
             g.experience_total,g.level_no,g.level_name,g.academy_started_at,g.academy_started_source,
             g.online_authorized_courses,g.online_completed_lessons,g.offline_completed_hours,
             g.completed_courses,g.total_learning_days,g.current_streak_days,g.longest_streak_days,
             g.last_learning_at
      FROM Member m
      LEFT JOIN StudentGrowthSummary g ON g.user_id=m.id
      ${where}
      ORDER BY COALESCE(g.experience_total,0) DESC,m.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, paging.pageSize, paging.offset) as Array<Record<string, any>>;
    const summary = db.prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(COALESCE(g.experience_total,0)),0) AS experience,
             SUM(CASE WHEN COALESCE(g.last_learning_at,'')!='' THEN 1 ELSE 0 END) AS learning,
             SUM(CASE WHEN COALESCE(g.level_no,1)=5 THEN 1 ELSE 0 END) AS top
      FROM Member m LEFT JOIN StudentGrowthSummary g ON g.user_id=m.id
      WHERE COALESCE(m.status,'active')!='deleted'
    `).get<any>() || {};
    return Response.json({
      success: true,
      ...pagePayload(rows.map(row => ({ ...row, academy_age: formatAcademyAge(row.academy_started_at) })), total, paging),
      summary,
      operator: authPayloadFromRequest(request),
    });
  } finally {
    db.close();
  }
}
