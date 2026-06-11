import { cleanText, hasAuth, jsonError, mapPlayer, nowIso, toNumber, unauthorized, withEventDb } from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  return withEventDb((db) => {
    const row = db.prepare(`
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
      WHERE p.id = ?
      GROUP BY p.id
    `).get(routeParams.id);
    if (!row) return jsonError('选手不存在', 404);

    const scores = db.prepare(`
      SELECT s.*, j.name AS judge_name, g.name AS group_name
      FROM event_scores s
      LEFT JOIN event_judges j ON j.id = s.judge_id
      LEFT JOIN event_groups g ON g.id = s.group_id
      WHERE s.player_id = ?
      ORDER BY datetime(s.submitted_at) DESC, s.id DESC
    `).all(routeParams.id);

    return Response.json({ success: true, data: { ...mapPlayer(row), scores } });
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return jsonError('选手姓名不能为空');

  return withEventDb((db) => {
    db.prepare(`
      UPDATE event_players
      SET group_id = ?, member_id = ?, order_id = ?, player_no = ?, name = ?,
          phone = ?, gender = ?, birthday = ?, organization = ?, teacher = ?,
          status = ?, audit_status = ?, paid_status = ?, score_status = ?,
          remark = ?, updated_at = ?
      WHERE id = ?
    `).run(
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
      routeParams.id,
    );
    return Response.json({ success: true });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const auditStatus = cleanText(body.auditStatus ?? body.audit_status);
  if (!auditStatus) return jsonError('缺少审核状态');

  return withEventDb((db) => {
    db.prepare('UPDATE event_players SET audit_status = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(auditStatus, auditStatus === 'approved' ? 'approved' : 'pending', nowIso(), routeParams.id);
    return Response.json({ success: true });
  });
}
