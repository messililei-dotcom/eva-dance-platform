import { getMemberId, jsonError, toPositiveInt, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const memberId = getMemberId(url.searchParams, request);
      const limit = toPositiveInt(url.searchParams.get('limit'), 30);
      if (!memberId) return jsonError('未登录', 401);
      const data = db.prepare('SELECT * FROM PracticeCheckin WHERE member_id=? ORDER BY checkin_date DESC LIMIT ?').all(memberId, limit);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
