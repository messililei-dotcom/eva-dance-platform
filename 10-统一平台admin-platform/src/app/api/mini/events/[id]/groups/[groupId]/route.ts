import { withEventDb } from '../../../../../event/_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const routeParams = await params;
  try {
    return withEventDb((db) => {
      const competition = db.prepare(`
        SELECT id, name, code, status, start_date, end_date, location
        FROM event_competitions
        WHERE id=? AND status IN ('published', 'finished')
      `).get(routeParams.id);
      const group = db.prepare(`
        SELECT g.id, g.competition_id, g.name, g.code, g.category, g.age_range,
          g.dance_type, g.entry_type, g.scoring_status,
          COUNT(DISTINCT CASE
            WHEN p.audit_status!='rejected' AND p.status NOT IN ('withdrawn','cancelled') THEN p.id
          END) AS player_count,
          COUNT(DISTINCT CASE WHEN r.status='published' THEN r.player_id END) AS ranking_count
        FROM event_groups g
        LEFT JOIN event_players p ON p.group_id=g.id
        LEFT JOIN event_rankings r ON r.group_id=g.id
        WHERE g.id=? AND g.competition_id=? AND g.status='active'
        GROUP BY g.id
      `).get(routeParams.groupId, routeParams.id);
      if (!competition || !group) {
        return Response.json({ success: false, error: '赛事组别不存在或尚未发布' }, { status: 404 });
      }

      const players = db.prepare(`
        SELECT p.id, p.player_no, p.name, p.organization, p.teacher,
          COALESCE(NULLIF(m.wx_avatar_url,''), NULLIF(m.avatar,''), '') AS avatar_url,
          r.rank_no, r.published_total, r.status AS ranking_status,
          a.name AS award_name
        FROM event_players p
        LEFT JOIN Member m ON m.id=p.member_id
        LEFT JOIN event_rankings r
          ON r.group_id=p.group_id AND r.player_id=p.id AND r.status='published'
        LEFT JOIN event_awards a ON a.id=r.award_id
        WHERE p.competition_id=? AND p.group_id=?
          AND p.audit_status!='rejected'
          AND p.status NOT IN ('withdrawn','cancelled')
        ORDER BY
          CASE WHEN r.rank_no IS NULL OR r.rank_no=0 THEN 1 ELSE 0 END,
          r.rank_no ASC, p.player_no ASC, p.id ASC
      `).all(routeParams.id, routeParams.groupId).map((row: any) => ({
        id: row.id,
        playerNo: row.player_no || '',
        name: row.name || '',
        avatarUrl: row.avatar_url || '',
        organization: row.organization || '',
        teacher: row.teacher || '',
        resultPublished: row.ranking_status === 'published',
        rankNo: row.ranking_status === 'published' ? Number(row.rank_no || 0) : 0,
        publishedTotal: row.ranking_status === 'published' && row.published_total != null
          ? Number(row.published_total)
          : null,
        awardName: row.ranking_status === 'published' ? row.award_name || '' : '',
      }));

      return Response.json({
        success: true,
        data: {
          competition: {
            id: competition.id,
            name: competition.name || '',
            code: competition.code || '',
            status: competition.status || '',
            startDate: competition.start_date || '',
            endDate: competition.end_date || '',
            location: competition.location || '',
          },
          group: {
            id: group.id,
            competitionId: group.competition_id,
            name: group.name || '',
            code: group.code || '',
            category: group.category || '',
            ageRange: group.age_range || '',
            danceType: group.dance_type || '',
            entryType: group.entry_type || '',
            scoringStatus: group.scoring_status || '',
            playerCount: Number(group.player_count || 0),
            rankingCount: Number(group.ranking_count || 0),
          },
          players,
        },
      });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '组别选手加载失败' }, { status: 500 });
  }
}
