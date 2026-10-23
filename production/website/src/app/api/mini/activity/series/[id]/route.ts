import { jsonError, toPositiveInt, withDb } from '../../../_helpers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const limit = toPositiveInt(new URL(request.url).searchParams.get('limit'), 20);
      const questions = db.prepare(`SELECT 'question' as type, q.id, q.content, q.status, q.created_at, COALESCE(m.name, '') as member_name, oc.name as course_name FROM Question q LEFT JOIN Member m ON q.member_id=m.id LEFT JOIN OnlineCourse oc ON q.course_id=oc.id WHERE q.series_id=? ORDER BY q.created_at DESC LIMIT ?`).all(seriesId, limit);
      const checkins = db.prepare(`SELECT 'checkin' as type, pc.id, pc.remark as content, pc.submission_type, pc.submission_url, pc.created_at, COALESCE(m.name, '') as member_name, '' as course_name FROM PracticeCheckin pc LEFT JOIN Member m ON pc.member_id=m.id WHERE pc.series_id=? OR pc.member_id IN (SELECT member_id FROM CourseAuthorization WHERE series_id=?) ORDER BY pc.created_at DESC LIMIT ?`).all(seriesId, seriesId, limit);
      const notes = db.prepare(`SELECT 'note' as type, sn.id, sn.content, sn.timestamp_seconds, sn.created_at, COALESCE(m.name, '') as member_name, cv.name as course_name FROM StudyNote sn LEFT JOIN Member m ON sn.member_id=m.id LEFT JOIN CourseVideo cv ON sn.video_id=cv.id LEFT JOIN OnlineCourse oc ON cv.course_id=oc.id WHERE oc.series_id=? ORDER BY sn.created_at DESC LIMIT ?`).all(seriesId, limit);
      const data = [...questions, ...checkins, ...notes].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
