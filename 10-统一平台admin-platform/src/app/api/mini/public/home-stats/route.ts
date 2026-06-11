import { jsonError, withDb } from '../../_helpers';

type CountRow = { count: number };

function countValue(row: CountRow | undefined) {
  return Number(row?.count || 0);
}

function tableExists(db: any, table: string) {
  return Boolean(db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(table));
}

export async function GET() {
  try {
    return withDb((db) => {
      const onlineCount = countValue(db.prepare(
        `SELECT COUNT(*) AS count
         FROM CourseSeries
         WHERE status='published' AND source_type='official_online'`
      ).get<CountRow>());
      const danceCount = countValue(db.prepare(
        `SELECT COUNT(*) AS count
         FROM CourseSeries
         WHERE status='published' AND source_type='official_dance_collection'`
      ).get<CountRow>());
      const platformOfflineCount = tableExists(db, 'Course') ? countValue(db.prepare(
        `SELECT COUNT(*) AS count
         FROM Course
         WHERE COALESCE(name, '') <> ''`
      ).get<CountRow>()) : 0;
      const offlineCount = platformOfflineCount || countValue(db.prepare(
        `SELECT COUNT(*) AS count
         FROM CourseSeries
         WHERE status='published'
           AND COALESCE(source_type, '') NOT IN ('official_online', 'official_dance_collection')`
      ).get<CountRow>());
      const courseCount = countValue(db.prepare(
        `SELECT COUNT(*) AS count
         FROM OnlineCourse oc
         JOIN CourseSeries cs ON cs.id=oc.series_id
         WHERE oc.status='published' AND cs.status='published'`
      ).get<CountRow>());
      const members = countValue(db.prepare('SELECT COUNT(*) AS count FROM Member').get<CountRow>());

      return Response.json({
        success: true,
        data: {
          online_count: onlineCount,
          dance_count: danceCount,
          offline_count: offlineCount,
          members,
          course_count: courseCount,
        },
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
