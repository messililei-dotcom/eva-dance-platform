import {
  competitionSelectSql,
  mapCompetition,
  mapGroup,
  mapRanking,
  withEventDb,
} from '../../../event/_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withEventDb((db) => {
      const competition = db.prepare(`
        ${competitionSelectSql()}
        WHERE c.id = ? AND c.status IN ('published', 'finished')
        GROUP BY c.id
      `).get(routeParams.id);
      if (!competition) {
        return Response.json({ success: false, error: '赛事不存在或尚未发布' }, { status: 404 });
      }

      const groups = db.prepare(`
        SELECT g.*, sr.name AS score_rule_name,
          COUNT(DISTINCT CASE WHEN p.audit_status='approved' THEN p.id END) AS player_count,
          COUNT(DISTINCT CASE WHEN gj.status='active' THEN gj.judge_id END) AS judge_count,
          COUNT(DISTINCT CASE WHEN r.status='published' THEN r.player_id END) AS ranking_count
        FROM event_groups g
        LEFT JOIN event_score_rules sr ON sr.id=g.score_rule_id
        LEFT JOIN event_players p ON p.group_id=g.id
        LEFT JOIN event_group_judges gj ON gj.group_id=g.id
        LEFT JOIN event_rankings r ON r.group_id=g.id
        WHERE g.competition_id=? AND g.status='active'
        GROUP BY g.id
        ORDER BY g.sort_order, g.id
      `).all(routeParams.id).map(mapGroup);

      const players = db.prepare(`
        SELECT p.id, p.group_id, p.player_no, p.name, p.organization, p.teacher,
          p.score_status, g.name AS group_name
        FROM event_players p
        LEFT JOIN event_groups g ON g.id=p.group_id
        WHERE p.competition_id=? AND p.audit_status='approved'
        ORDER BY g.sort_order, p.player_no, p.id
      `).all(routeParams.id).map((row: any) => ({
        id: row.id,
        groupId: row.group_id || null,
        groupName: row.group_name || '',
        playerNo: row.player_no || '',
        name: row.name,
        organization: row.organization || '',
        teacher: row.teacher || '',
        scoreStatus: row.score_status || 'not_started',
      }));

      const judges = db.prepare(`
        SELECT DISTINCT j.id, j.name, j.title, j.organization, j.bio
        FROM event_judges j
        JOIN event_group_judges gj ON gj.judge_id=j.id
        WHERE gj.competition_id=? AND gj.status='active' AND j.status='active'
        ORDER BY j.id
      `).all(routeParams.id).map((row: any) => ({
        id: row.id,
        name: row.name,
        title: row.title || '',
        organization: row.organization || '',
        bio: row.bio || '',
      }));

      const rankings = db.prepare(`
        SELECT r.*, g.name AS group_name, p.name AS player_name,
          p.player_no, p.organization, 0 AS score_count, 0 AS judge_count, 0 AS abnormal_count
        FROM event_rankings r
        JOIN event_groups g ON g.id=r.group_id
        JOIN event_players p ON p.id=r.player_id
        WHERE r.competition_id=? AND r.status='published'
        ORDER BY g.sort_order, r.rank_no, r.published_total DESC
      `).all(routeParams.id).map(mapRanking);

      const sessions = db.prepare(`
        SELECT id, group_id, name, venue, starts_at, ends_at, status
        FROM event_sessions
        WHERE competition_id=? AND status!='cancelled'
        ORDER BY starts_at, sort_order, id
      `).all(routeParams.id).map((row: any) => ({
        id: row.id,
        groupId: row.group_id || null,
        name: row.name,
        venue: row.venue || '',
        startsAt: row.starts_at || '',
        endsAt: row.ends_at || '',
        status: row.status || 'planned',
      }));

      const awards = db.prepare(`
        SELECT id, group_id, name, award_type, rank_start, rank_end, quota
        FROM event_awards
        WHERE competition_id=? AND status='active'
        ORDER BY sort_order, id
      `).all(routeParams.id).map((row: any) => ({
        id: row.id,
        groupId: row.group_id || null,
        name: row.name,
        awardType: row.award_type || 'rank',
        rankStart: row.rank_start || 0,
        rankEnd: row.rank_end || 0,
        quota: row.quota || 0,
      }));

      return Response.json({
        success: true,
        data: {
          competition: mapCompetition(competition),
          groups,
          players,
          judges,
          rankings,
          sessions,
          awards,
        },
      });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '赛事详情加载失败' }, { status: 500 });
  }
}
