import { cleanText, getMemberId, jsonError, shanghaiDateKey, toPositiveInt, withDb } from '../_helpers';
import { recordLocalGrowth } from '@/lib/server/inbox-events';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const today = shanghaiDateKey();
      const existing = db.prepare('SELECT id FROM PracticeCheckin WHERE member_id=? AND checkin_date=? AND series_id=?').get(memberId, today, toPositiveInt(body.series_id, 0));
      if (existing) return jsonError('今日已打卡', 400);
      const result = db.prepare(
        `INSERT INTO PracticeCheckin (member_id, series_id, checkin_date, submission_type, submission_url, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))`
      ).run(memberId, toPositiveInt(body.series_id, 0), today, cleanText(body.submission_type, 'text'), cleanText(body.submission_url), cleanText(body.remark));
      recordLocalGrowth(db, {
        memberId,
        eventType: 'practice_checkin',
        points: 5,
        sourceType: 'practice_checkin',
        sourceId: result.lastInsertRowid,
        description: '完成今日练习打卡，经验值 +5。',
      });
      return Response.json({ success: true, data: { id: result.lastInsertRowid, date: today } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
