import { getMemberId, jsonError, withDb } from '../../_helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type EventEntryRow = Record<string, any> & { player_id: number; rank_no?: number };

function awardName(row: EventEntryRow) {
  if (row.award_name) return String(row.award_name);
  const rank = Number(row.rank_no || 0);
  if (rank === 1) return '冠军';
  if (rank === 2) return '亚军';
  if (rank === 3) return '季军';
  return rank > 0 ? `第 ${rank} 名` : '';
}

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const memberId = getMemberId(url.searchParams, request);
      if (!memberId) return jsonError('未登录', 401);

      const member = db.prepare(
        `SELECT id, name, COALESCE(phone, '') AS phone FROM Member WHERE id=?`
      ).get<{ id: number; name?: string; phone?: string }>(memberId);
      if (!member) return jsonError('学员不存在', 404);

      const phone = String(member.phone || '').trim();
      const rows = db.prepare(`
        SELECT
          p.id AS player_id,p.member_id,p.status AS player_status,p.name AS entrant_name,p.registration_fee,p.paid_amount,p.paid_at,p.submitted_by_member_id,
          p.competition_id,
          c.name AS competition_name,
          c.code AS competition_code,
          c.status AS competition_status,
          c.start_date,
          c.end_date,
          c.location,
          c.cover_url,
          p.group_id,
          COALESCE(g.name, '未分组') AS group_name,
          p.player_no,
          COALESCE((
            SELECT pf.title FROM event_performances pf
            WHERE pf.player_id=p.id
            ORDER BY pf.id DESC LIMIT 1
          ), '') AS performance_title,
          p.organization,
          p.teacher,
          p.audit_status,
          p.paid_status,
          p.score_status,
          p.registered_at,
          r.published_total,
          r.rank_no,
          r.published_at,
          r.status AS ranking_status,
          a.name AS award_name
        FROM event_players p
        JOIN event_competitions c ON c.id=p.competition_id
        LEFT JOIN event_groups g ON g.id=p.group_id
        LEFT JOIN event_rankings r
          ON r.player_id=p.id AND r.group_id=p.group_id AND r.status='published'
        LEFT JOIN event_awards a ON a.id=r.award_id
        WHERE p.member_id=? OR p.submitted_by_member_id=?
          OR (?<>'' AND REPLACE(REPLACE(REPLACE(COALESCE(p.phone,''), ' ', ''), '-', ''), '+86', '')
              = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), '+86', ''))
        ORDER BY
          CASE WHEN COALESCE(c.start_date,'')='' THEN 1 ELSE 0 END,
          c.start_date DESC,
          c.id DESC,
          g.sort_order ASC,
          p.id DESC
      `).all<EventEntryRow>(memberId, memberId, phone, phone);

      const publishedPlayerIds = rows
        .filter((row) => row.ranking_status === 'published')
        .map((row) => Number(row.player_id))
        .filter(Boolean);
      const scoresByPlayer = new Map<number, Array<{ judgeId: number; judgeName: string; score: number | null }>>();

      if (publishedPlayerIds.length) {
        const placeholders = publishedPlayerIds.map(() => '?').join(',');
        const scoreRows = db.prepare(`
          SELECT s.player_id, s.judge_id, COALESCE(j.name, '评委') AS judge_name,
                 CASE WHEN c.judge_scores_public=1 THEN SUM(COALESCE(s.published_score, s.calculated_score, 0)) ELSE NULL END AS score
          FROM event_scores s
          JOIN event_competitions c ON c.id=s.competition_id
          LEFT JOIN event_judges j ON j.id=s.judge_id
          JOIN event_rankings r
            ON r.player_id=s.player_id AND r.group_id=s.group_id AND r.status='published'
          WHERE s.player_id IN (${placeholders})
            AND s.score_status='published'
            AND s.version=(
              SELECT MAX(latest.version) FROM event_scores latest
              WHERE latest.group_id=s.group_id
                AND latest.player_id=s.player_id
                AND latest.judge_id=s.judge_id
                AND latest.rule_id IS s.rule_id
                AND latest.score_status='published'
            )
          GROUP BY s.player_id, s.judge_id, j.name, c.judge_scores_public
          ORDER BY s.player_id, j.name, s.judge_id
        `).all<{ player_id: number; judge_id: number; judge_name: string; score: number | null }>(...publishedPlayerIds);

        scoreRows.forEach((score) => {
          const list = scoresByPlayer.get(Number(score.player_id)) || [];
          list.push({
            judgeId: Number(score.judge_id),
            judgeName: String(score.judge_name || '评委'),
            score: score.score === null ? null : Number(score.score || 0),
          });
          scoresByPlayer.set(Number(score.player_id), list);
        });
      }

      const entries = rows.map((row) => {
        const resultPublished = row.ranking_status === 'published';
        return {
          playerId: String(row.player_id),
          competitionId: String(row.competition_id),
          competitionName: row.competition_name || '赛事',
          competitionCode: row.competition_code || '',
          competitionStatus: row.competition_status || '',
          startDate: row.start_date || '',
          endDate: row.end_date || '',
          location: row.location || '',
          coverUrl: row.cover_url || '',
          groupId: row.group_id ? String(row.group_id) : '',
          groupName: row.group_name || '未分组',
          playerNo: row.player_no || '',
          performanceTitle: row.performance_title || '',
          organization: row.organization || '',
          teacher: row.teacher || '',
          auditStatus: row.audit_status || 'pending',
          paidStatus: row.paid_status || 'unpaid',
          scoreStatus: row.score_status || 'not_started',
          registeredAt: row.registered_at || '',
          entrantName:row.entrant_name||'',registrationFee:Number(row.registration_fee||0),paidAmount:Number(row.paid_amount||0),paidAt:row.paid_at||'',canPay:[row.member_id,row.submitted_by_member_id].includes(memberId) && Number(row.registration_fee)>0 && Number(row.paid_amount||0)===0 && row.audit_status!=='rejected' && !['cancelled','withdrawn'].includes(row.player_status),
          resultPublished,
          totalScore: resultPublished && row.published_total != null ? Number(row.published_total) : null,
          rankNo: resultPublished ? Number(row.rank_no || 0) : 0,
          awardName: resultPublished ? awardName(row) : '',
          publishedAt: resultPublished ? row.published_at || '' : '',
          judgeScores: resultPublished ? scoresByPlayer.get(Number(row.player_id)) || [] : [],
        };
      });

      const eventCount = new Set(entries.map((entry) => entry.competitionId)).size;
      const publishedCount = entries.filter((entry) => entry.resultPublished).length;
      const podiumCount = entries.filter((entry) => entry.rankNo > 0 && entry.rankNo <= 3).length;

      return Response.json({
        success: true,
        data: {
          summary: { eventCount, groupCount: entries.length, publishedCount, podiumCount },
          entries,
        },
      });
    });
  } catch (error: any) {
    return jsonError(error?.message || '比赛数据加载失败');
  }
}
