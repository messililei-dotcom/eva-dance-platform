import { getMemberId } from '../../../_helpers';
import { cleanText, nowIso, toNumber, withEventDb } from '../../../../event/_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withEventDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: [] });
      const rows = db.prepare(`
        SELECT p.id, p.group_id, p.player_no, p.name, p.organization, p.teacher,
          p.status, p.audit_status, p.paid_status, p.score_status, p.registered_at,
          g.name AS group_name
        FROM event_players p
        LEFT JOIN event_groups g ON g.id=p.group_id
        WHERE p.competition_id=? AND p.member_id=?
        ORDER BY p.id DESC
      `).all(routeParams.id, memberId).map((row: any) => ({
        id: row.id,
        groupId: row.group_id || null,
        groupName: row.group_name || '',
        playerNo: row.player_no || '',
        name: row.name,
        organization: row.organization || '',
        teacher: row.teacher || '',
        status: row.status || 'pending',
        auditStatus: row.audit_status || 'pending',
        paidStatus: row.paid_status || 'unpaid',
        scoreStatus: row.score_status || 'not_started',
        registeredAt: row.registered_at || '',
      }));
      return Response.json({ success: true, data: rows });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '报名记录加载失败' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const body = await request.json().catch(() => ({}));
  try {
    return withEventDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: false, error: '请先登录后报名' }, { status: 401 });

      const competition = db.prepare(`
        SELECT id, registration_status, registration_start, registration_end, max_players
        FROM event_competitions
        WHERE id=? AND status='published'
      `).get(routeParams.id);
      if (!competition) return Response.json({ success: false, error: '赛事不存在或尚未发布' }, { status: 404 });
      if (competition.registration_status !== 'open') {
        return Response.json({ success: false, error: '赛事报名尚未开放或已经结束' }, { status: 409 });
      }
      const now = Date.now();
      if (competition.registration_start && now < Date.parse(competition.registration_start)) {
        return Response.json({ success: false, error: '赛事报名尚未开始' }, { status: 409 });
      }
      if (competition.registration_end && now > Date.parse(competition.registration_end)) {
        return Response.json({ success: false, error: '赛事报名已经结束' }, { status: 409 });
      }

      const groupId = toNumber(body.groupId ?? body.group_id);
      const group = db.prepare(
        "SELECT id, max_players FROM event_groups WHERE id=? AND competition_id=? AND status='active'"
      ).get(groupId, routeParams.id);
      if (!group) return Response.json({ success: false, error: '请选择有效的参赛组别' }, { status: 400 });

      const member = db.prepare('SELECT name, phone FROM Member WHERE id=?').get(memberId) || {};
      const name = cleanText(body.name, cleanText(member.name));
      const phone = cleanText(body.phone, cleanText(member.phone));
      if (!name || !phone) return Response.json({ success: false, error: '请填写参赛姓名和手机号' }, { status: 400 });

      const duplicate = db.prepare(`
        SELECT id FROM event_players
        WHERE competition_id=? AND group_id=? AND (member_id=? OR phone=?)
          AND status!='cancelled'
        LIMIT 1
      `).get(routeParams.id, groupId, memberId, phone);
      if (duplicate) return Response.json({ success: false, error: '您已报名该赛事组别' }, { status: 409 });

      const groupCount = db.prepare(
        "SELECT COUNT(*) AS count FROM event_players WHERE group_id=? AND status!='cancelled'"
      ).get(groupId)?.count || 0;
      if (group.max_players > 0 && groupCount >= group.max_players) {
        return Response.json({ success: false, error: '该组别报名人数已满' }, { status: 409 });
      }

      const totalCount = db.prepare(
        "SELECT COUNT(*) AS count FROM event_players WHERE competition_id=? AND status!='cancelled'"
      ).get(routeParams.id)?.count || 0;
      if (competition.max_players > 0 && totalCount >= competition.max_players) {
        return Response.json({ success: false, error: '赛事报名人数已满' }, { status: 409 });
      }

      const result = db.prepare(`
        INSERT INTO event_players (
          competition_id, group_id, member_id, player_no, name, phone, gender,
          birthday, organization, teacher, status, audit_status, paid_status,
          score_status, remark, registered_at, updated_at
        ) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'unpaid',
          'not_started', ?, ?, ?)
      `).run(
        routeParams.id,
        groupId,
        memberId,
        name,
        phone,
        cleanText(body.gender),
        cleanText(body.birthday),
        cleanText(body.organization),
        cleanText(body.teacher),
        cleanText(body.remark),
        nowIso(),
        nowIso(),
      );

      return Response.json({ success: true, data: { id: result.lastInsertRowid, auditStatus: 'pending' } });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '赛事报名失败' }, { status: 500 });
  }
}
