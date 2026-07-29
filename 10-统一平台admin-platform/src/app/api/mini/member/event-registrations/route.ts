import { getMemberId } from '../../_helpers';
import { withEventDb } from '../../../event/_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    return withEventDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: [] });
      const rows = db.prepare(`
        SELECT p.id, p.competition_id, p.group_id, p.player_no, p.name,
          p.audit_status, p.paid_status, p.score_status, p.registered_at,
          c.name AS competition_name, c.start_date, c.location, c.cover_url,
          g.name AS group_name
        FROM event_players p
        JOIN event_competitions c ON c.id=p.competition_id
        LEFT JOIN event_groups g ON g.id=p.group_id
        WHERE p.member_id=? AND p.status!='cancelled'
        ORDER BY datetime(p.registered_at) DESC, p.id DESC
      `).all(memberId).map((row: any) => ({
        id: row.id,
        competitionId: row.competition_id,
        competitionName: row.competition_name || '',
        groupId: row.group_id || null,
        groupName: row.group_name || '',
        playerNo: row.player_no || '',
        name: row.name,
        auditStatus: row.audit_status || 'pending',
        paidStatus: row.paid_status || 'unpaid',
        scoreStatus: row.score_status || 'not_started',
        startDate: row.start_date || '',
        location: row.location || '',
        coverUrl: row.cover_url || '',
        registeredAt: row.registered_at || '',
      }));
      return Response.json({ success: true, data: rows });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '赛事报名记录加载失败' }, { status: 500 });
  }
}
