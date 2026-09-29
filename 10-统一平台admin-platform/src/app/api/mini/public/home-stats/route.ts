import { jsonError, withDb } from '../../_helpers';
import { noStoreJson } from '@/lib/http-cache';
import { COURSE_CATEGORY_DANCE, COURSE_CATEGORY_ONLINE } from '@/lib/course-category';

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
         WHERE status='published'
           AND (
             category=?
             OR (COALESCE(category, '') IN ('', '线上学院') AND source_type='official_online')
           )`
      ).get<CountRow>(COURSE_CATEGORY_ONLINE));
      const danceCount = countValue(db.prepare(
        `SELECT COUNT(*) AS count
         FROM CourseSeries
         WHERE status='published'
           AND (
             category=?
             OR (COALESCE(category, '') NOT IN (?, '') AND source_type='official_dance_collection')
           )`
      ).get<CountRow>(COURSE_CATEGORY_DANCE, COURSE_CATEGORY_ONLINE));
      const platformOfflineCount = tableExists(db, 'Course') ? countValue(db.prepare(
        `SELECT COUNT(*) AS count
         FROM Course c LEFT JOIN CourseTemplate t ON t.id=c.templateId
         WHERE COALESCE(c.name, '') <> '' AND COALESCE(c.status, 'active') <> 'deleted'
           AND COALESCE(t.websiteVisible, 1)=1 AND COALESCE(c.category, '') NOT LIKE '%演示%' AND COALESCE(c.name, '') NOT LIKE '%测试%'`
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
      const members = countValue(db.prepare(
        'SELECT COUNT(*) AS count FROM Member WHERE COALESCE(merged_to_member_id, 0)=0'
      ).get<CountRow>());

      return noStoreJson({
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
