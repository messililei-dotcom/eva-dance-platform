import { getMemberId, jsonError, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const rows = db.prepare(
        `SELECT DISTINCT cs.id as series_id, cs.name as series_name, ca.granted_at
         FROM CourseAuthorization ca
         JOIN CourseSeries cs ON cs.id=ca.series_id
         LEFT JOIN Member m ON m.id=?
         WHERE ca.status='active' AND cs.status='published'
           AND (ca.member_id=? OR (ca.phone<>'' AND ca.phone=m.phone))
           AND (ca.expire_at IS NULL OR ca.expire_at > datetime('now','localtime'))
         ORDER BY ca.granted_at DESC`
      ).all(memberId, memberId);
      return Response.json({ success: true, data: rows });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
