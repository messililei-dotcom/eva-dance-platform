import { getMemberId, jsonError, toPositiveInt, withDb } from '../../../../_helpers';
import { courses as websiteCourses } from '@/config/courses';

function normalizeSeriesName(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/成品舞/g, '')
    .replace(/[｜|·•・.\s"'“”‘’《》（）()【】\[\]：:，,。！!、\-—_]/g, '');
}

function resolveSeriesId(db: any, routeId: string) {
  const exactId = toPositiveInt(routeId);
  if (exactId) {
    const exact = db.prepare('SELECT id FROM CourseSeries WHERE id=? AND status=?').get(exactId, 'published');
    if (exact) return exactId;
  }

  const websiteCourse = websiteCourses.find(course => course.id === routeId);
  const targetName = normalizeSeriesName(websiteCourse?.title);
  if (targetName) {
    const seriesRows = db.prepare('SELECT id, name FROM CourseSeries WHERE status=?').all('published');
    const match = seriesRows.find((row: any) => {
      const name = normalizeSeriesName(row.name);
      return name && (name === targetName || name.includes(targetName) || targetName.includes(name));
    });
    if (match?.id) return Number(match.id);
  }
  return toPositiveInt(routeId);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return withDb((db) => {
      const seriesId = resolveSeriesId(db, routeParams.id);
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: [] });

      const rows = db.prepare(
        `SELECT cv.id as video_id, cv.course_id, vp.progress, vp.duration, vp.completed, vp.last_play_at
         FROM CourseVideo cv
         JOIN OnlineCourse oc ON cv.course_id=oc.id
         LEFT JOIN VideoProgress vp ON vp.video_id=cv.id AND vp.member_id=?
         WHERE oc.series_id=?
         ORDER BY oc.sort_order, oc.id, cv.sort_order, cv.id`
      ).all(memberId, seriesId);

      return Response.json({ success: true, data: rows });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
