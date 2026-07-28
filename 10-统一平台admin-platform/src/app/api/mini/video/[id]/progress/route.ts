import { getMemberId, jsonError, toPositiveInt, withDb } from '../../../_helpers';
import { recordGrowthEvent } from '@/lib/server/inbox';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: null });
      const data = db.prepare(
        `SELECT progress, duration, last_play_at as updated_at, last_play_at, completed
         FROM VideoProgress WHERE member_id=? AND video_id=?`
      ).get(memberId, toPositiveInt(routeParams.id)) || null;
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    const body = await request.json();
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const progress = Math.max(0, Number(body.progress || 0));
      const duration = Math.max(0, Number(body.duration || 0));
      const completed = duration > 0 && progress >= duration * 0.9 ? 1 : 0;
      const videoId = toPositiveInt(routeParams.id);
      const previous = db.prepare('SELECT completed FROM VideoProgress WHERE member_id=? AND video_id=?')
        .get<{ completed?: number }>(memberId, videoId);
      db.prepare(
        `INSERT INTO VideoProgress (member_id, video_id, progress, duration, completed, last_play_at)
         VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
         ON CONFLICT(member_id, video_id) DO UPDATE SET
           progress=excluded.progress, duration=excluded.duration, completed=excluded.completed,
           last_play_at=excluded.last_play_at`
      ).run(memberId, videoId, progress, duration, completed);
      if (completed && !Number(previous?.completed || 0)) {
        const video = db.prepare(`
          SELECT cv.name, oc.series_id
          FROM CourseVideo cv
          LEFT JOIN OnlineCourse oc ON oc.id=cv.course_id
          WHERE cv.id=?
        `).get<{ name?: string; series_id?: number }>(videoId);
        recordGrowthEvent(db, {
          memberId,
          eventType: 'online_lesson',
          points: 1,
          sourceType: 'course_video',
          sourceId: videoId,
          description: `完成《${video?.name || '线上课程'}》，经验值 +1。`,
          actionUrl: `/courses/${video?.series_id || ''}/videos`,
        });
      }
      return Response.json({ success: true, completed: !!completed });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
