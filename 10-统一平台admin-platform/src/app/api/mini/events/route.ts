import {
  competitionSelectSql,
  mapCompetition,
  withEventDb,
} from '../../event/_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return withEventDb((db) => {
      const rows = db.prepare(`
        ${competitionSelectSql()}
        WHERE c.status IN ('published', 'finished')
        GROUP BY c.id
        ORDER BY
          CASE WHEN COALESCE(c.start_date, '') = '' THEN 1 ELSE 0 END,
          datetime(c.start_date) DESC,
          c.id DESC
      `).all();
      return Response.json({ success: true, data: rows.map(mapCompetition) });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '赛事加载失败' }, { status: 500 });
  }
}
