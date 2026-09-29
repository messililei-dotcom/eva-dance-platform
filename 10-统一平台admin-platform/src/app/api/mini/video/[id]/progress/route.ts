import { getMemberId, jsonError, linkedMemberIds, sqlIn, toPositiveInt, withDb } from '../../../_helpers';
import { recordOnlineLessonCompletion } from '@/lib/server/student-growth';
import { getVideoAccessStatus } from '../../../../course/series/[id]/_authorization';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: null });
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const data = db.prepare(
        `SELECT progress, duration, last_play_at as updated_at, last_play_at, completed
         FROM VideoProgress
         WHERE member_id IN (${linked.clause}) AND video_id=?
         ORDER BY CASE WHEN member_id=? THEN 0 ELSE 1 END, datetime(last_play_at) DESC
         LIMIT 1`
      ).get(...linked.values, toPositiveInt(routeParams.id), memberId) || null;
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
      const videoId = toPositiveInt(routeParams.id);
      const access = getVideoAccessStatus(db, videoId, memberId);
      if (!access.authorized && !access.trial_available) return jsonError(access.message || '无有效学习权限', 403);
      const progress = Math.max(0, Number(body.progress || 0));
      const duration = Math.max(0, Number(body.duration || 0));
      const completed = duration > 0 && progress >= duration * 0.8 ? 1 : 0;
      const saved = db.transaction(() => {
        db.prepare(
          `INSERT INTO VideoProgress (member_id, video_id, progress, duration, completed, last_play_at)
           VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
           ON CONFLICT(member_id, video_id) DO UPDATE SET
             progress=MAX(VideoProgress.progress,excluded.progress),
             duration=MAX(VideoProgress.duration,excluded.duration),
             completed=MAX(VideoProgress.completed,excluded.completed),
             last_play_at=excluded.last_play_at`
        ).run(memberId, videoId, progress, duration, completed);
        const row = db.prepare('SELECT completed FROM VideoProgress WHERE member_id=? AND video_id=?').get<{ completed: number }>(memberId, videoId);
        if (row?.completed) recordOnlineLessonCompletion(db, memberId, videoId);
        return Boolean(row?.completed);
      })();
      return Response.json({ success: true, completed: saved });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
