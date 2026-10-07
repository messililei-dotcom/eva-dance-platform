import { noStoreJson } from '@/lib/http-cache';

import {
  competitionSelectSql,
  mapPublicCompetition,
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
          CASE WHEN datetime(c.start_date) IS NULL THEN 1 ELSE 0 END,
          datetime(c.start_date) DESC,
          c.id DESC
      `).all();
      return noStoreJson({ success: true, data: rows.map(mapPublicCompetition) });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '赛事加载失败' }, { status: 500 });
  }
}
