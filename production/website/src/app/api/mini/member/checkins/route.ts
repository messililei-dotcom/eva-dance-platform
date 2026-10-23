import { getMemberId, jsonError, shanghaiDateKey, toPositiveInt, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const data = db.prepare('SELECT * FROM PracticeCheckin WHERE member_id=? ORDER BY checkin_date DESC LIMIT 60').all(memberId);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const today = shanghaiDateKey();
      db.prepare(`INSERT OR IGNORE INTO PracticeCheckin (member_id, checkin_date, created_at) VALUES (?, ?, datetime('now','localtime'))`).run(memberId, today);
      const data = db.prepare('SELECT * FROM PracticeCheckin WHERE member_id=? ORDER BY checkin_date DESC LIMIT 60').all(memberId);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
