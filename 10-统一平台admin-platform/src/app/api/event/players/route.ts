import { cleanText, hasAuth, jsonError, mapPlayer, nowIso, toNumber, unauthorized, withEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  const groupId = toNumber(url.searchParams.get('groupId') ?? url.searchParams.get('group_id'));
  const keyword = cleanText(url.searchParams.get('keyword'));

  return withEventDb((db) => {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (competitionId) {
      where += ' AND p.competition_id = ?';
      params.push(competitionId);
    }
    if (groupId) {
      where += ' AND p.group_id = ?';
      params.push(groupId);
    }
    if (keyword) {
      where += ' AND (p.name LIKE ? OR p.phone LIKE ? OR p.player_no LIKE ? OR p.organization LIKE ?)';
      const like = `%${keyword}%`;
      params.push(like, like, like, like);
    }

    const rows = db.prepare(`
      SELECT
        p.*,
        c.name AS competition_name,
        g.name AS group_name,
        COUNT(DISTINCT s.id) AS score_count,
        COUNT(DISTINCT gj.judge_id) AS judge_count
      FROM event_players p
      LEFT JOIN event_competitions c ON c.id = p.competition_id
      LEFT JOIN event_groups g ON g.id = p.group_id
      LEFT JOIN event_scores s ON s.player_id = p.id
      LEFT JOIN event_group_judges gj ON gj.group_id = p.group_id
      ${where}
      GROUP BY p.id
      ORDER BY datetime(p.registered_at) DESC, p.id DESC
    `).all(...params);

    return Response.json({ success: true, data: rows.map(mapPlayer) });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const name = cleanText(body.name);
  if (!competitionId) return jsonError('缺少赛事ID');
  if (!name) return jsonError('选手姓名不能为空');

  return withEventDb((db) => {
    const result = db.prepare(`
      INSERT INTO event_players (
        competition_id, group_id, member_id, order_id, player_no, name, phone,
        gender, birthday, organization, teacher, status, audit_status,
        paid_status, score_status, remark, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      competitionId,
      toNumber(body.groupId ?? body.group_id) || null,
      toNumber(body.memberId ?? body.member_id),
      toNumber(body.orderId ?? body.order_id),
      cleanText(body.playerNo ?? body.player_no),
      name,
      cleanText(body.phone),
      cleanText(body.gender),
      cleanText(body.birthday),
      cleanText(body.organization),
      cleanText(body.teacher),
      cleanText(body.status, 'pending'),
      cleanText(body.auditStatus ?? body.audit_status, 'pending'),
      cleanText(body.paidStatus ?? body.paid_status, 'unpaid'),
      cleanText(body.scoreStatus ?? body.score_status, 'not_started'),
      cleanText(body.remark),
      nowIso(),
    );

    return Response.json({ success: true, data: { id: result.lastInsertRowid } });
  });
}
