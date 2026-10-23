import { withDb } from '@/app/api/platform-courses/_db';

type CountRow = { count: number };

export type PlatformHomeStats = {
  online_count: number;
  dance_count: number;
  offline_count: number;
  members: number;
  course_count: number;
};

const COURSE_CATEGORY_ONLINE = '线上系统课';
const COURSE_CATEGORY_DANCE = '成品舞';
const PLATFORM_API_BASE = (
  process.env.STUDENT_API_URL
  || process.env.MANAGEMENT_API_BASE
  || process.env.NEXT_PUBLIC_API_URL
  || ''
).replace(/\/$/, '');

function countValue(row: CountRow | undefined) {
  return Number(row?.count || 0);
}

async function fetchPlatformHomeStats() {
  if (!/^https?:\/\//.test(PLATFORM_API_BASE)) return null;

  try {
    const res = await fetch(`${PLATFORM_API_BASE}/mini/public/home-stats`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const payload = await res.json();
    const data = payload?.data;
    if (!payload?.success || !data) return null;
    return {
      online_count: Number(data.online_count || 0),
      dance_count: Number(data.dance_count || 0),
      offline_count: Number(data.offline_count || 0),
      members: Number(data.members || 0),
      course_count: Number(data.course_count || 0),
    } satisfies PlatformHomeStats;
  } catch {
    return null;
  }
}

function getLocalPlatformHomeStats(): PlatformHomeStats {
  return withDb((db) => {
    const onlineCount = countValue(db.prepare(
      `SELECT COUNT(*) AS count
       FROM CourseSeries
       WHERE status='published'
         AND (
           category=?
           OR (COALESCE(category, '') IN ('', '线上学院') AND source_type='official_online')
         )`,
    ).get<CountRow>(COURSE_CATEGORY_ONLINE));
    const danceCount = countValue(db.prepare(
      `SELECT COUNT(*) AS count
       FROM CourseSeries
       WHERE status='published'
         AND (
           category=?
           OR (COALESCE(category, '') NOT IN (?, '') AND source_type='official_dance_collection')
         )`,
    ).get<CountRow>(COURSE_CATEGORY_DANCE, COURSE_CATEGORY_ONLINE));
    const offlineCount = countValue(db.prepare(
      `SELECT COUNT(*) AS count
       FROM CourseSeries
       WHERE status='published'
         AND COALESCE(source_type, '') NOT IN ('official_online', 'official_dance_collection')`,
    ).get<CountRow>());
    const courseCount = countValue(db.prepare(
      `SELECT COUNT(*) AS count
       FROM OnlineCourse oc
       JOIN CourseSeries cs ON cs.id=oc.series_id
       WHERE oc.status='published' AND cs.status='published'`,
    ).get<CountRow>());
    const members = countValue(db.prepare(
      'SELECT COUNT(*) AS count FROM Member WHERE COALESCE(merged_to_member_id, 0)=0'
    ).get<CountRow>());

    return {
      online_count: onlineCount,
      dance_count: danceCount,
      offline_count: offlineCount,
      members,
      course_count: courseCount,
    };
  });
}

export async function getPlatformHomeStats(): Promise<PlatformHomeStats> {
  return (await fetchPlatformHomeStats()) || getLocalPlatformHomeStats();
}
