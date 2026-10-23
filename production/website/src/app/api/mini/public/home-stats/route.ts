import { jsonError, withDb } from '../../_helpers';
import { noStoreJson } from '@/lib/http-cache';

type CountRow = { count: number };

const PLATFORM_API_BASE = (
  process.env.STUDENT_API_URL
  || process.env.MANAGEMENT_API_BASE
  || process.env.NEXT_PUBLIC_API_URL
  || ''
).replace(/\/$/, '');

function countValue(row: CountRow | undefined) {
  return Number(row?.count || 0);
}

async function fetchPlatformStats() {
  if (!/^https?:\/\//.test(PLATFORM_API_BASE)) return null;

  try {
    const res = await fetch(`${PLATFORM_API_BASE}/mini/public/home-stats`, { cache: 'no-store' });
    if (!res.ok) return null;
    const payload = await res.json();
    if (!payload?.success || !payload?.data) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const platformPayload = await fetchPlatformStats();
    if (platformPayload) return noStoreJson(platformPayload);

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
      const offlineCount = countValue(db.prepare(
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
