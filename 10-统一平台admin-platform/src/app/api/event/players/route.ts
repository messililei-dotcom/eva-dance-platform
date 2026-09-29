import { cleanText, hasAuth, jsonError, mapPlayer, nowIso, toNumber, unauthorized, withEventDb } from '../_db';
import { syncEventPlayerToMember } from '@/lib/server/event-member-sync';
import { createPersonalMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  const groupId = toNumber(url.searchParams.get('groupId') ?? url.searchParams.get('group_id'));
  const keyword = cleanText(url.searchParams.get('keyword'));
  const page = Math.max(1, toNumber(url.searchParams.get('page'), 1));
  const requestedPageSize = toNumber(url.searchParams.get('pageSize') ?? url.searchParams.get('page_size'));
  const pageSize = requestedPageSize ? Math.min(200, Math.max(1, requestedPageSize)) : 0;

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

    const total = db.prepare(`SELECT COUNT(*) AS value FROM event_players p ${where}`).get(...params)?.value || 0;
    const paginationSql = pageSize ? 'LIMIT ? OFFSET ?' : '';
    const queryParams = pageSize ? [...params, pageSize, (page - 1) * pageSize] : params;
    const rows = db.prepare(`
      SELECT
        p.*,
        c.name AS competition_name,
        g.name AS group_name,
        (SELECT ep.sequence_no FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS sequence_no,
        (SELECT ep.music_file_id FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS music_file_id,
        (SELECT ep.title FROM event_performances ep WHERE ep.player_id = p.id ORDER BY ep.id DESC LIMIT 1) AS performance_title,
        (SELECT COUNT(*) FROM event_scores s WHERE s.player_id = p.id) AS score_count,
        (SELECT COUNT(*) FROM event_group_judges gj WHERE gj.group_id = p.group_id) AS judge_count
      FROM event_players p
      LEFT JOIN event_competitions c ON c.id = p.competition_id
      LEFT JOIN event_groups g ON g.id = p.group_id
      ${where}
      ORDER BY datetime(p.registered_at) DESC, p.id DESC
      ${paginationSql}
    `).all(...queryParams);

    return Response.json({ success: true, data: rows.map(mapPlayer), total, page, pageSize: pageSize || total });
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
    const created = db.transaction(() => {
      const member = syncEventPlayerToMember(db, {
        memberId: body.memberId ?? body.member_id,
        name,
        phone: body.phone,
        gender: body.gender,
        birthday: body.birthday,
        country: body.country,
        province: body.province,
        city: body.city,
        address: body.address,
        registeredAt: body.registeredAt ?? body.registered_at,
      });
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
        member.memberId,
        toNumber(body.orderId ?? body.order_id),
        '',
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
      const competition = db.prepare('SELECT name FROM event_competitions WHERE id = ?')
        .get(competitionId) as { name?: string } | undefined;
      createPersonalMessage(db, Number(member.memberId), {
        type: 'event',
        title: '赛事报名已提交',
        content: `你已报名《${competition?.name || '东方舞赛事'}》，可在个人中心关注审核和成绩。`,
        actionUrl: '/dashboard/events',
        businessType: 'event_registration',
        businessId: result.lastInsertRowid,
        dedupeKey: `event-registration:${result.lastInsertRowid}`,
        priority: 'important',
      });
      return { playerId: result.lastInsertRowid, member };
    })();

    return Response.json({
      success: true,
      data: { id: created.playerId, memberId: created.member.memberId, memberCreated: created.member.created },
    });
  });
}
