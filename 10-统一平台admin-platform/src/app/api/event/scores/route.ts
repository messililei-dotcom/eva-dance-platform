import {
  calculateScore,
  cleanText,
  getRuleForGroup,
  hasAuth,
  readEventBody,
  jsonError,
  mapScore,
  markAbnormalScore,
  nowIso,
  recalculateGroupRankings,
  toNumber,
  unauthorized,
  withRequestEventDb,
} from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  const groupId = toNumber(url.searchParams.get('groupId') ?? url.searchParams.get('group_id'));
  const playerId = toNumber(url.searchParams.get('playerId') ?? url.searchParams.get('player_id'));
  const judgeId = toNumber(url.searchParams.get('judgeId') ?? url.searchParams.get('judge_id'));

  return withRequestEventDb(request, (db) => {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (competitionId) {
      where += ' AND s.competition_id = ?';
      params.push(competitionId);
    }
    if (groupId) {
      where += ' AND s.group_id = ?';
      params.push(groupId);
    }
    if (playerId) {
      where += ' AND s.player_id = ?';
      params.push(playerId);
    }
    if (judgeId) {
      where += ' AND s.judge_id = ?';
      params.push(judgeId);
    }

    const rows = db.prepare(`
      SELECT s.*, p.name AS player_name, p.player_no, j.name AS judge_name, g.name AS group_name
      FROM event_scores s
      LEFT JOIN event_players p ON p.id = s.player_id
      LEFT JOIN event_judges j ON j.id = s.judge_id
      LEFT JOIN event_groups g ON g.id = s.group_id
      ${where}
      ORDER BY s.group_id ASC, p.player_no ASC, p.id ASC, j.id ASC, s.version DESC
    `).all(...params);

    return Response.json({ success: true, data: rows.map(mapScore) });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const groupId = toNumber(body.groupId ?? body.group_id);
  const playerId = toNumber(body.playerId ?? body.player_id);
  const judgeId = toNumber(body.judgeId ?? body.judge_id);
  if (!groupId || !playerId || !judgeId) return jsonError('缺少组别、选手或评委ID');

  return withRequestEventDb(request, (db) => {
    try {
      const group = db.prepare('SELECT * FROM event_groups WHERE id = ?').get(groupId);
      if (!group) return jsonError('组别不存在', 404);
      if (group.scoring_status === 'locked' && !body.overrideLocked) return jsonError('组别评分已锁定，请先解锁或使用修正流程');

      const player = db.prepare('SELECT * FROM event_players WHERE id = ? AND group_id = ?').get(playerId, groupId);
      if (!player) return jsonError('选手不属于该组别', 404);
      if (player.audit_status === 'rejected' || ['withdrawn', 'cancelled'].includes(player.status)) return jsonError('该报名已失效，不能评分');

      const assignment = db.prepare(`
        SELECT gj.*, j.auth_enabled AS judge_auth_enabled, j.status AS judge_status
        FROM event_group_judges gj
        LEFT JOIN event_judges j ON j.id = gj.judge_id
        WHERE gj.group_id = ? AND gj.judge_id = ?
      `).get(groupId, judgeId);
      if (!assignment) return jsonError('评委未分配到该组别');
      if ((!assignment.auth_enabled || !assignment.judge_auth_enabled || assignment.judge_status !== 'active') && !body.overrideAuth) {
        return jsonError('评委未授权或已停用');
      }

      const rule = getRuleForGroup(db, groupId, toNumber(body.ruleId ?? body.rule_id) || null);
      const criteriaScores = body.criteriaScores ?? body.criteria_scores ?? {};
      const calculatedScore = calculateScore(rule, criteriaScores, toNumber(body.rawScore ?? body.raw_score));
      const abnormal = markAbnormalScore(db, groupId, playerId, judgeId, calculatedScore, Number(rule.abnormal_threshold || 15));
      const latest = db.prepare(`
        SELECT *
        FROM event_scores
        WHERE group_id = ? AND player_id = ? AND judge_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(groupId, playerId, judgeId);
      const version = (latest?.version || 0) + 1;
      const status = cleanText(body.scoreStatus ?? body.score_status, 'submitted');
      const now = nowIso();
      const reason = cleanText(body.reason ?? body.remark, version > 1 ? '评分修正' : '首次评分');

      const writeScore = db.transaction(() => {
        if (latest && latest.score_status !== 'voided') {
          db.prepare('UPDATE event_scores SET score_status = ?, updated_at = ? WHERE id = ?')
            .run('voided', now, latest.id);
        }
        const result = db.prepare(`
          INSERT INTO event_scores (
            competition_id, group_id, player_id, performance_id, judge_id, rule_id,
            raw_score, criteria_scores_json, calculated_score, score_status,
            is_abnormal, abnormal_reason, submitted_at, reviewed_at, version, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          group.competition_id,
          groupId,
          playerId,
          toNumber(body.performanceId ?? body.performance_id) || null,
          judgeId,
          rule.id || null,
          calculatedScore,
          JSON.stringify(criteriaScores || {}),
          calculatedScore,
          status,
          abnormal.isAbnormal ? 1 : 0,
          cleanText(body.abnormalReason ?? body.abnormal_reason, abnormal.reason),
          status === 'draft' ? '' : now,
          status === 'reviewed' ? now : '',
          version,
          now,
        );
        db.prepare(`
          INSERT INTO event_score_audit_logs (
            competition_id, group_id, player_id, judge_id, score_id,
            action, before_json, after_json, reason, operator
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          group.competition_id,
          groupId,
          playerId,
          judgeId,
          result.lastInsertRowid,
          latest ? 'correct_score' : 'submit_score',
          JSON.stringify(latest || {}),
          JSON.stringify({ calculatedScore, criteriaScores, status, version }),
          reason,
          cleanText(body.operator, 'admin'),
        );
        db.prepare('UPDATE event_players SET score_status = ?, updated_at = ? WHERE id = ?')
          .run(status === 'draft' ? 'in_progress' : 'scored', now, playerId);
        recalculateGroupRankings(db, groupId);
        return result.lastInsertRowid;
      });

      const id = writeScore();
      return Response.json({ success: true, data: { id, version, isAbnormal: abnormal.isAbnormal, abnormalReason: abnormal.reason } });
    } catch (err: any) {
      return jsonError(err?.message || '评分保存失败');
    }
  });
}
