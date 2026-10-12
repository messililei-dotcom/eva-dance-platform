import { cleanText, readEventBody, hasAuth, jsonError, mapPlayer, nowIso, toNumber, unauthorized, withRequestEventDb } from '../../_db';
import { normalizeEventMemberPhone, syncEventPlayerToMember } from '@/lib/server/event-member-sync';

import { ensurePhoneMember } from '@/lib/server/event-entry-import';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  return withRequestEventDb(request, (db) => {
    const row = db.prepare(`
      SELECT
        p.*,
        mf.file_name AS music_name, mf.file_url AS music_url, mf.duration_seconds AS music_duration,
        c.name AS competition_name,
        g.name AS group_name,
        (SELECT ep.sequence_no FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS sequence_no,
        (SELECT ep.music_file_id FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS music_file_id,
        (SELECT ep.title FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS performance_title,
        COUNT(DISTINCT s.id) AS score_count,
        COUNT(DISTINCT gj.judge_id) AS judge_count
      FROM event_players p
      LEFT JOIN event_music_files mf ON mf.id = (SELECT ep.music_file_id FROM event_performances ep WHERE ep.player_id=p.id ORDER BY ep.id DESC LIMIT 1)
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

  const body = await readEventBody(request);
  const name = cleanText(body.name);
  if (!name) return jsonError('选手姓名不能为空');
  const contact = normalizeEventMemberPhone(body.phone);
  if (!contact) return jsonError('手机号必填且格式须正确');
  const hasTitle = Object.prototype.hasOwnProperty.call(body, 'performanceTitle');
  const performanceTitle = cleanText(body.performanceTitle);
  if (hasTitle && (!performanceTitle || performanceTitle.length > 120)) return jsonError('请填写1至120字的节目名称');
  delete body.memberId; delete body.member_id;

  return withRequestEventDb(request, (db) => {
    const updated = db.transaction(() => {
      const current = db.prepare('SELECT * FROM event_players WHERE id=?').get(routeParams.id) as Record<string, any> | undefined;
      if (!current) return null;
      if (body.paidStatus && body.paidStatus !== current.paid_status) return { paymentError: true };
      const member = { memberId: ensurePhoneMember(db, name, contact, 'event_competition'), created: false, paymentError: false };
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
        contact,
        body.gender != null ? cleanText(body.gender) : current.gender,
        body.birthday != null ? cleanText(body.birthday) : current.birthday,
        body.organization != null ? cleanText(body.organization) : current.organization,
        body.teacher != null ? cleanText(body.teacher) : current.teacher,
        body.status != null ? cleanText(body.status) : current.status,
        current.audit_status === 'rejected' ? 'rejected' : 'approved',
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
      if (hasTitle) {
        const performance = db.prepare('SELECT id FROM event_performances WHERE player_id=? ORDER BY id DESC LIMIT 1').get(routeParams.id) as { id: number } | undefined;
        if (performance) db.prepare('UPDATE event_performances SET title=?,updated_at=? WHERE id=?').run(performanceTitle, nowIso(), performance.id);
        else db.prepare("INSERT INTO event_performances (competition_id,group_id,player_id,title,status,updated_at) VALUES (?,?,?,?,'pending',?)").run(current.competition_id, body.groupId ?? current.group_id, current.id, performanceTitle, nowIso());
      }
      return member;
    })();
    if (!updated) return jsonError('选手不存在', 404);
    if (updated.paymentError) return jsonError('请使用登记缴费功能修改缴费状态');
    return Response.json({ success: true, data: { memberId: updated.memberId, memberCreated: updated.created } });
  });
}

export async function PATCH(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  return jsonError('报名审核流程已取消，请使用报名修正功能', 410);
}
