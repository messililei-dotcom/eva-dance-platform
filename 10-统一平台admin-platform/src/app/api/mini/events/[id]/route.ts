import avatars from '@/data/event-avatars.json';
import {
  competitionSelectSql,
  mapPublicCompetition,
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

      const registrationPublic = Number(competition.registration_public) === 1;
      const groups = db.prepare(`
        SELECT g.*, sr.name AS score_rule_name,
          COUNT(DISTINCT CASE WHEN p.audit_status!='rejected' AND p.status NOT IN ('withdrawn','cancelled') THEN p.id END) AS player_count,
          COUNT(DISTINCT CASE WHEN gj.status='active' THEN gj.judge_id END) AS judge_count
        FROM event_groups g
        LEFT JOIN event_score_rules sr ON sr.id=g.score_rule_id
        LEFT JOIN event_players p ON p.group_id=g.id
        LEFT JOIN event_group_judges gj ON gj.group_id=g.id
        WHERE g.competition_id=? AND g.status='active'
        GROUP BY g.id
        ORDER BY g.sort_order, g.id
      `).all(routeParams.id).map((row: any) => ({ ...mapGroup(row), playerCount: registrationPublic ? Number(row.player_count || 0) : null, registrationPublic }));

      const players = db.prepare(`
        SELECT p.id, p.group_id, p.player_no, p.name, p.organization, p.teacher,
          p.score_status, g.name AS group_name, COALESCE(NULLIF(m.wx_avatar_url,''),NULLIF(m.avatar,''),'') AS avatar_url, (SELECT title FROM event_performances ep WHERE ep.player_id=p.id ORDER BY ep.id LIMIT 1) performance_title
        FROM event_players p
        LEFT JOIN event_groups g ON g.id=p.group_id
        LEFT JOIN Member m ON m.id=p.member_id
        WHERE p.competition_id=? AND p.audit_status!='rejected' AND p.status NOT IN ('withdrawn','cancelled')
          AND (? = 1 OR EXISTS (SELECT 1 FROM event_rankings r WHERE r.player_id=p.id AND r.group_id=p.group_id AND r.status='published'))
        ORDER BY g.sort_order, p.player_no, p.id
      `).all(routeParams.id, registrationPublic ? 1 : 0).map((row: any) => ({
        id: row.id,
        groupId: row.group_id || null,
        groupName: row.group_name || '',
        playerNo: row.player_no || '',
        name: row.name,
        organization: row.organization || '',
        teacher: row.teacher || '',
        scoreStatus: row.score_status || 'not_started',
        avatarUrl: row.avatar_url || (avatars.players as Record<string,string>)[String(row.id)] || '',
        performanceTitle: row.performance_title || '',
      }));

      const judges = db.prepare(`
        SELECT DISTINCT j.id, j.name, j.title, j.organization, j.bio, COALESCE(NULLIF(m.wx_avatar_url,''),NULLIF(m.avatar,''),'') AS avatar_url
        FROM event_judges j
        JOIN event_group_judges gj ON gj.judge_id=j.id
        LEFT JOIN Member m ON m.id=j.member_id
        WHERE gj.competition_id=? AND gj.status='active' AND j.status='active'
        ORDER BY j.id
      `).all(routeParams.id).map((row: any) => ({
        id: row.id,
        name: row.name,
        title: row.title || '',
        organization: row.organization || '',
        bio: row.bio || '',
        avatarUrl: row.avatar_url || (avatars.judges as Record<string,string>)[String(row.id)] || '',
      }));

      const rankings = db.prepare(`
        SELECT r.*, g.name AS group_name, p.name AS player_name,
          p.player_no, p.organization, COALESCE(NULLIF(m.wx_avatar_url,''),NULLIF(m.avatar,''),'') AS avatar_url, 0 AS score_count, 0 AS judge_count, 0 AS abnormal_count
        FROM event_rankings r
        JOIN event_groups g ON g.id=r.group_id
        JOIN event_players p ON p.id=r.player_id
        LEFT JOIN Member m ON m.id=p.member_id
        WHERE r.competition_id=? AND r.status='published'
        ORDER BY g.sort_order, r.rank_no, r.published_total DESC
      `).all(routeParams.id).map((row:any) => ({ id:row.id,groupId:row.group_id,groupName:row.group_name,playerId:row.player_id,playerName:row.player_name,playerNo:row.player_no||'',avatarUrl:row.avatar_url||(avatars.players as Record<string,string>)[String(row.player_id)]||'',organization:row.organization||'',rankNo:row.rank_no||0,publishedTotal:row.published_total==null?null:Number(row.published_total),status:'published' }));

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
          competition: mapPublicCompetition(competition),
          groups: groups.map((group: any) => ({ ...group, rankingCount: rankings.filter((rank: any) => rank.groupId === group.id).length })),
          players,
          judges,
          rankings,
          sessions,
          awards,
        },
      }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || '赛事详情加载失败' }, { status: 500 });
  }
}
