import { cleanText, hasAuth, jsonError, mapPlayer, nowIso, toNumber, unauthorized, withEventDb } from '../../_db';
import { syncEventPlayerToMember } from '@/lib/server/event-member-sync';

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
        (SELECT ep.sequence_no FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS sequence_no,
        (SELECT ep.music_file_id FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS music_file_id,
        (SELECT ep.title FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS performance_title,
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
    const updated = db.transaction(() => {
      const current = db.prepare('SELECT * FROM event_players WHERE id=?').get(routeParams.id) as Record<string, any> | undefined;
      if (!current) return null;
      const member = syncEventPlayerToMember(db, {
        memberId: body.memberId ?? body.member_id ?? current.member_id,
        name,
        phone: body.phone,
        gender: body.gender,
        birthday: body.birthday,
        country: body.country,
        province: body.province,
        city: body.city,
        address: body.address,
        registeredAt: current.registered_at,
      });
      db.prepare(`
        UPDATE event_players
        SET group_id = ?, member_id = ?, order_id = ?, player_no = ?, name = ?,
            phone = ?, gender = ?, birthday = ?, organization = ?, teacher = ?,
            status = ?, audit_status = ?, paid_status = ?, score_status = ?,
            remark = ?, updated_at = ?
        WHERE id = ?
      `).run(
        body.groupId != null || body.group_id != null
          ? (toNumber(body.groupId ?? body.group_id) || null)
          : current.group_id,
        member.memberId,
        body.orderId != null || body.order_id != null ? toNumber(body.orderId ?? body.order_id) : current.order_id,
        current.player_no,
        name,
        body.phone != null ? cleanText(body.phone) : current.phone,
        body.gender != null ? cleanText(body.gender) : current.gender,
        body.birthday != null ? cleanText(body.birthday) : current.birthday,
        body.organization != null ? cleanText(body.organization) : current.organization,
        body.teacher != null ? cleanText(body.teacher) : current.teacher,
        body.status != null ? cleanText(body.status) : current.status,
        body.auditStatus != null || body.audit_status != null
          ? cleanText(body.auditStatus ?? body.audit_status)
          : current.audit_status,
        body.paidStatus != null || body.paid_status != null
          ? cleanText(body.paidStatus ?? body.paid_status)
          : current.paid_status,
        body.scoreStatus != null || body.score_status != null
          ? cleanText(body.scoreStatus ?? body.score_status)
          : current.score_status,
        body.remark != null ? cleanText(body.remark) : current.remark,
        nowIso(),
        routeParams.id,
      );
      return member;
    })();
    if (!updated) return jsonError('选手不存在', 404);
    return Response.json({ success: true, data: { memberId: updated.memberId, memberCreated: updated.created } });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const auditStatus = cleanText(body.auditStatus ?? body.audit_status);
  if (!auditStatus) return jsonError('缺少审核状态');

  return withEventDb((db) => {
    const result = db.transaction(() => {
      const player = db.prepare('SELECT * FROM event_players WHERE id=?').get(routeParams.id) as Record<string, any> | undefined;
      if (!player) return null;
      const member = syncEventPlayerToMember(db, {
        memberId: player.member_id,
        name: player.name,
        phone: player.phone,
        gender: player.gender,
        birthday: player.birthday,
        registeredAt: player.registered_at,
      });
      db.prepare('UPDATE event_players SET member_id = ?, audit_status = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(member.memberId, auditStatus, auditStatus === 'approved' ? 'approved' : 'pending', nowIso(), routeParams.id);
      return member;
    })();
    if (!result) return jsonError('选手不存在', 404);
    return Response.json({ success: true, data: { memberId: result.memberId, memberCreated: result.created } });
  });
}
