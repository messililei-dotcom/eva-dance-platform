import { getMemberId, jsonError, linkedMemberIds, shanghaiDateKey, sqlIn, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const data = db.prepare(`SELECT * FROM PracticeCheckin WHERE member_id IN (${linked.clause}) ORDER BY checkin_date DESC LIMIT 60`).all(...linked.values);
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
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const data = db.prepare(`SELECT * FROM PracticeCheckin WHERE member_id IN (${linked.clause}) ORDER BY checkin_date DESC LIMIT 60`).all(...linked.values);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
