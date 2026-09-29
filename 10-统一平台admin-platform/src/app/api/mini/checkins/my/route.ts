import { getMemberId, jsonError, linkedMemberIds, sqlIn, toPositiveInt, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const memberId = getMemberId(url.searchParams, request);
      const limit = toPositiveInt(url.searchParams.get('limit'), 30);
      if (!memberId) return jsonError('未登录', 401);
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const data = db.prepare(`SELECT * FROM PracticeCheckin WHERE member_id IN (${linked.clause}) ORDER BY checkin_date DESC LIMIT ?`).all(...linked.values, limit);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
