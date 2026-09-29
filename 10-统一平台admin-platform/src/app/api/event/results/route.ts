import { cleanText, hasAuth, jsonError, mapRanking, nowIso, recalculateGroupRankings, rerankGroupRankings, toNumber, unauthorized, withEventDb } from '../_db';
import { createPersonalMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  const groupId = toNumber(url.searchParams.get('groupId') ?? url.searchParams.get('group_id'));
  if (!competitionId && !groupId) return jsonError('缺少赛事或组别ID');

  return withEventDb((db) => {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (competitionId) {
      where += ' AND r.competition_id = ?';
      params.push(competitionId);
    }
    if (groupId) {
      where += ' AND r.group_id = ?';
      params.push(groupId);
    }

    const rows = db.prepare(`
      SELECT
        r.*,
        g.name AS group_name,
        p.name AS player_name,
        p.player_no,
        p.organization,
        COUNT(DISTINCT s.judge_id) AS score_count,
        COUNT(DISTINCT gj.judge_id) AS judge_count,
        SUM(CASE WHEN s.is_abnormal = 1 AND s.score_status != 'voided' THEN 1 ELSE 0 END) AS abnormal_count
      FROM event_rankings r
      LEFT JOIN event_groups g ON g.id = r.group_id
      LEFT JOIN event_players p ON p.id = r.player_id
      LEFT JOIN event_scores s ON s.group_id = r.group_id AND s.player_id = r.player_id AND s.score_status != 'voided'
      LEFT JOIN event_group_judges gj ON gj.group_id = r.group_id AND gj.status = 'active'
      ${where}
      GROUP BY r.id
      ORDER BY g.sort_order ASC, r.rank_no ASC, r.calculated_total DESC
    `).all(...params);

    const logs = db.prepare(`
      SELECT l.*, g.name AS group_name
      FROM event_result_publish_logs l
      LEFT JOIN event_groups g ON g.id = l.group_id
      WHERE (? = 0 OR l.competition_id = ?) AND (? = 0 OR l.group_id = ?)
      ORDER BY datetime(l.created_at) DESC, l.id DESC
      LIMIT 50
    `).all(competitionId, competitionId, groupId, groupId);

    return Response.json({ success: true, data: { rankings: rows.map(mapRanking), logs } });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const groupId = toNumber(body.groupId ?? body.group_id);
  if (!groupId) return jsonError('缺少组别ID');

  return withEventDb((db) => {
    try {
      const count = recalculateGroupRankings(db, groupId);
      return Response.json({ success: true, data: { count } });
    } catch (err: any) {
      return jsonError(err?.message || '成绩重算失败');
    }
  });
}

export async function PATCH(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const groupId = toNumber(body.groupId ?? body.group_id);
  const action = cleanText(body.action);
  if (!groupId) return jsonError('缺少组别ID');
  if (!['publish', 'unpublish', 'set_manual_score', 'clear_manual_score'].includes(action)) return jsonError('不支持的结果操作');

  return withEventDb((db) => {
    const group = db.prepare('SELECT * FROM event_groups WHERE id = ?').get(groupId);
    if (!group) return jsonError('组别不存在', 404);
    const now = nowIso();

    if (action === 'set_manual_score' || action === 'clear_manual_score') {
      const playerId = toNumber(body.playerId ?? body.player_id);
      if (!playerId) return jsonError('缺少选手ID');
      const player = db.prepare('SELECT * FROM event_players WHERE id = ? AND group_id = ?').get(playerId, groupId);
      if (!player) return jsonError('选手不属于当前组别', 404);

      const manualTotal = action === 'set_manual_score' ? Number(body.finalScore ?? body.final_score) : null;
      if (action === 'set_manual_score' && (manualTotal === null || !Number.isFinite(manualTotal) || manualTotal < 0)) return jsonError('最终得分必须是不小于 0 的数字');

      const operator = cleanText(body.operator, 'admin');
      const reason = cleanText(body.reason, action === 'set_manual_score' ? '后台直接修改最终得分' : '取消人工最终得分');
      const before = db.prepare('SELECT * FROM event_rankings WHERE group_id = ? AND player_id = ?').get(groupId, playerId) || null;
      const changeFinalScore = db.transaction(() => {
        if (!before) {
          db.prepare(`
            INSERT INTO event_rankings (
              competition_id, group_id, player_id, raw_total, calculated_total, manual_total,
              manual_reason, manual_updated_by, manual_updated_at, published_total,
              rank_no, status, recalculated_at, updated_at
            ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, NULL, 0, 'draft', ?, ?)
          `).run(group.competition_id, groupId, playerId, manualTotal ?? 0, manualTotal, reason, operator, now, now, now);
        } else if (action === 'set_manual_score') {
          db.prepare(`
            UPDATE event_rankings
            SET calculated_total = ?, manual_total = ?, manual_reason = ?, manual_updated_by = ?,
                manual_updated_at = ?, published_total = NULL, published_at = '', status = 'draft', updated_at = ?
            WHERE group_id = ? AND player_id = ?
          `).run(manualTotal, manualTotal, reason, operator, now, now, groupId, playerId);
        } else {
          db.prepare(`
            UPDATE event_rankings
            SET calculated_total = raw_total, manual_total = NULL, manual_reason = '', manual_updated_by = ?,
                manual_updated_at = ?, published_total = NULL, published_at = '', status = 'draft', updated_at = ?
            WHERE group_id = ? AND player_id = ?
          `).run(operator, now, now, groupId, playerId);
        }
        rerankGroupRankings(db, groupId, now);
        const after = db.prepare('SELECT * FROM event_rankings WHERE group_id = ? AND player_id = ?').get(groupId, playerId);
        db.prepare(`
          INSERT INTO event_score_audit_logs (
            competition_id, group_id, player_id, action, before_json, after_json, reason, operator
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(group.competition_id, groupId, playerId, action, JSON.stringify(before || {}), JSON.stringify(after || {}), reason, operator);
        return after;
      });

      const ranking = changeFinalScore();
      return Response.json({ success: true, data: { ranking: mapRanking(ranking) } });
    }

    const rankings = db.prepare('SELECT * FROM event_rankings WHERE group_id = ? ORDER BY rank_no ASC').all(groupId);
    if (action === 'publish' && !rankings.length) return jsonError('请先重算成绩再公示');

    const publish = db.transaction(() => {
      if (action === 'publish') {
        db.prepare(`
          UPDATE event_rankings
          SET status = 'published', published_total = calculated_total, published_at = ?, updated_at = ?
          WHERE group_id = ?
        `).run(now, now, groupId);
        db.prepare(`UPDATE event_scores SET score_status='published', published_score=calculated_score, updated_at=? WHERE group_id=? AND score_status IN ('submitted','reviewed','published')`).run(now, groupId);
        db.prepare('UPDATE event_groups SET scoring_status = ?, updated_at = ? WHERE id = ?').run('locked', now, groupId);
      } else {
        db.prepare(`
          UPDATE event_rankings
          SET status = 'draft', published_total = NULL, published_at = '', updated_at = ?
          WHERE group_id = ?
        `).run(now, groupId);
        db.prepare(`UPDATE event_scores SET score_status='reviewed', published_score=NULL, updated_at=? WHERE group_id=? AND score_status='published'`).run(now, groupId);
        db.prepare('UPDATE event_groups SET scoring_status = ?, updated_at = ? WHERE id = ?').run('unlocked', now, groupId);
      }
      db.prepare(`
        INSERT INTO event_result_publish_logs (competition_id, group_id, action, snapshot_json, operator)
        VALUES (?, ?, ?, ?, ?)
      `).run(group.competition_id, groupId, action, JSON.stringify(rankings), cleanText(body.operator, 'admin'));
    });

    publish();
    if (action === 'publish') {
      const competition = db.prepare('SELECT name FROM event_competitions WHERE id = ?')
        .get(group.competition_id) as { name?: string } | undefined;
      const publishedRows = db.prepare(`
        SELECT r.id, r.rank_no, r.published_total, p.member_id
        FROM event_rankings r
        JOIN event_players p ON p.id = r.player_id
        WHERE r.group_id = ? AND p.member_id > 0
      `).all(groupId) as Array<Record<string, any>>;
      publishedRows.forEach(row => {
        createPersonalMessage(db, Number(row.member_id), {
          type: 'event',
          title: '赛事成绩已公布',
          content: `《${competition?.name || '东方舞赛事'}》成绩已公布，你的名次为第 ${row.rank_no || '-'} 名。`,
          actionUrl: '/dashboard/events',
          businessType: 'event_result',
          businessId: row.id,
          dedupeKey: `event-result:${row.id}`,
          priority: 'urgent',
          payload: { rank: row.rank_no, score: row.published_total },
        });
      });
    }
    return Response.json({ success: true });
  });
}
