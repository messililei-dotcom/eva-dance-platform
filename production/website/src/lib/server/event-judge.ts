import legacyAvatars from '@/data/event-avatars.json';
import { recalculateGroupRankings } from './event-ranking';
import type { AdminDb } from '@/lib/server/admin-db';

export type JudgeIdentity = { id: number; name: string; title: string };
export type JudgeCriterion = { key: string; name: string; maxScore: number; ruleId: number | null };

const PHONE_SQL = "REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(%s, ''), ' ', ''), '-', ''), '+86', ''), '(', '')";

function phoneSql(column: string) {
  return PHONE_SQL.replace('%s', column);
}

export function resolveJudge(db: AdminDb, memberId: number, competitionId: number): JudgeIdentity | null {
  return db.prepare(`
    SELECT DISTINCT j.id, j.name, COALESCE(j.title, '') AS title
    FROM event_judges j
    JOIN event_group_judges gj ON gj.judge_id = j.id
    JOIN Member m ON m.id = ?
    WHERE gj.competition_id = ?
      AND j.status = 'active' AND j.auth_enabled = 1
      AND gj.status = 'active' AND gj.auth_enabled = 1
      AND (
        (j.member_id = ? AND j.member_id > 0)
        
        OR (COALESCE(j.member_id, 0) = 0 AND ${phoneSql('j.phone')} <> ''
          AND ${phoneSql('j.phone')} = ${phoneSql('m.phone')})
      )
    ORDER BY j.id ASC
    LIMIT 1
  `).get<JudgeIdentity>(memberId, competitionId, memberId) || null;
}

export function verifyJudgeGroup(db: AdminDb, competitionId: number, groupId: number, judgeId: number) {
  return db.prepare(`
    SELECT g.id, g.name,
           COALESCE(g.scoring_status, '') AS scoring_status, g.score_rule_id
    FROM event_groups g
    JOIN event_group_judges gj ON gj.group_id = g.id AND gj.judge_id = ?
    WHERE g.id = ? AND g.competition_id = ? AND g.status = 'active'
      AND gj.status = 'active' AND gj.auth_enabled = 1
    LIMIT 1
  `).get<Record<string, any>>(judgeId, groupId, competitionId) || null;
}

export function loadJudgeGroups(db: AdminDb, competitionId: number, judgeId: number) {
  return db.prepare(`
    SELECT g.id, g.name,
      COUNT(DISTINCT CASE WHEN p.audit_status != 'rejected' AND p.status NOT IN ('withdrawn','cancelled') THEN p.id END) AS player_count,
      COUNT(DISTINCT CASE WHEN p.audit_status != 'rejected' AND p.status NOT IN ('withdrawn','cancelled') AND EXISTS (
        SELECT 1 FROM event_scores s
        WHERE s.group_id = g.id AND s.player_id = p.id AND s.judge_id = ?
          AND s.score_status IN ('submitted','reviewed','published')
          AND NOT EXISTS (
            SELECT 1 FROM event_scores newer
            WHERE newer.group_id=s.group_id AND newer.player_id=s.player_id
              AND newer.judge_id=s.judge_id AND newer.version>s.version
              AND newer.score_status!='voided'
          )
      ) THEN p.id END) AS scored_count
    FROM event_groups g
    JOIN event_group_judges gj ON gj.group_id = g.id AND gj.judge_id = ?
    LEFT JOIN event_players p ON p.group_id = g.id
    WHERE g.competition_id = ? AND g.status = 'active'
      AND gj.status = 'active' AND gj.auth_enabled = 1
    GROUP BY g.id
    ORDER BY g.sort_order ASC, g.id ASC
  `).all<Record<string, any>>(judgeId, judgeId, competitionId);
}

export function loadJudgePlayers(db: AdminDb, competitionId: number, groupId: number, judgeId: number, playerId?: number) {
  return db.prepare(`
    SELECT p.id, COALESCE(p.player_no, '') AS player_no, p.name,
      COALESCE(p.organization, '') AS organization,
      COALESCE(p.teacher, '') AS teacher,
      COALESCE(NULLIF(m.wx_avatar_url,''), NULLIF(m.avatar,''), '') AS avatarUrl,
      COALESCE((SELECT ep.title FROM event_performances ep WHERE ep.player_id=p.id ORDER BY ep.id LIMIT 1), '') AS performance_title,
      (SELECT CASE WHEN s.score_status IN ('submitted','reviewed','published') THEN s.calculated_score END FROM event_scores s
        WHERE s.group_id=p.group_id AND s.player_id=p.id AND s.judge_id=?
          AND s.score_status!='voided'
        ORDER BY s.version DESC LIMIT 1) AS my_score,
      (SELECT s.score_status FROM event_scores s
        WHERE s.group_id=p.group_id AND s.player_id=p.id AND s.judge_id=?
          AND s.score_status!='voided'
        ORDER BY s.version DESC LIMIT 1) AS my_score_status
    FROM event_players p
    LEFT JOIN Member m ON m.id=p.member_id
    WHERE p.competition_id=? AND p.group_id=? AND p.audit_status!='rejected'
      AND p.status NOT IN ('withdrawn','cancelled')
      ${playerId === undefined ? '' : 'AND p.id=?'}
    ORDER BY p.player_no ASC, p.id ASC
  `).all<Record<string, any>>(judgeId, judgeId, competitionId, groupId, ...(playerId === undefined ? [] : [playerId]))
    .map(player => ({ ...player, id: Number(player.id), avatarUrl: player.avatarUrl || (legacyAvatars.players as Record<string, string>)[String(player.id)] || '' }));
}

function parseCriteria(raw: string, ruleId: number | null, ruleName: string, totalScore: number): JudgeCriterion[] {
  try {
    const values = JSON.parse(raw || '[]');
    if (Array.isArray(values) && values.length) {
      return values.map((item, index) => ({
        key: String(item.id ?? item.key ?? `${ruleId || 'rule'}-${index}`),
        name: String(item.name || ruleName || `评分项${index + 1}`),
        maxScore: Number(item.maxScore ?? item.score ?? totalScore ?? 0),
        ruleId,
      })).filter((item) => item.maxScore > 0);
    }
  } catch {}
  return totalScore > 0 ? [{ key: String(ruleId || 'total'), name: ruleName || '评分总分', maxScore: totalScore, ruleId }] : [];
}

export function loadJudgeCriteria(db: AdminDb, competitionId: number, group: Record<string, any>) {
  const rules = group.score_rule_id
    ? db.prepare(`
        SELECT * FROM event_score_rules WHERE id=? AND (competition_id=? OR competition_id IS NULL)
          AND (status='active' OR (status='archived' AND ?='locked'))
      `).all<Record<string, any>>(group.score_rule_id, competitionId, group.scoring_status)
    : [];
  if (!rules.length) {
    rules.push(...db.prepare(`SELECT * FROM event_score_rules WHERE competition_id=? AND status='active' ORDER BY id ASC`)
      .all<Record<string, any>>(competitionId));
  }
  const criteria = rules.flatMap((rule) => parseCriteria(rule.criteria_json, Number(rule.id), String(rule.name || ''), Number(rule.total_score || 0)));
  return criteria.length ? criteria : [{ key: 'total', name: '评分总分', maxScore: 10, ruleId: null }];
}

export function loadCurrentJudgeScore(db: AdminDb, groupId: number, playerId: number, judgeId: number, criteria: JudgeCriterion[]) {
  const latest = db.prepare(`
    SELECT * FROM event_scores
    WHERE group_id=? AND player_id=? AND judge_id=? AND score_status!='voided'
    ORDER BY version DESC LIMIT 1
  `).get<Record<string, any>>(groupId, playerId, judgeId);
  if (!latest) return { values: {} as Record<string, number>, total: null as number | null, status: '' };
  let parsed: Record<string, number> = {};
  try {
    const value = JSON.parse(String(latest.criteria_scores_json || '{}'));
    if (value && typeof value === 'object') parsed = value;
  } catch {}
  if (criteria.length === 1 && parsed[criteria[0].key] == null) {
    parsed = { [criteria[0].key]: Number(latest.calculated_score || 0) };
  }
  const needsRescore = criteria.some(item => {
    const value = parsed[item.key];
    return typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > item.maxScore;
  });
  return { values: needsRescore ? {} : parsed, total: Number(latest.calculated_score || 0), status: String(latest.score_status || ''), needsRescore };
}

export function saveJudgeScore(db: AdminDb, options: {
  competitionId: number;
  group: Record<string, any>;
  playerId: number;
  judge: JudgeIdentity;
  criteria: JudgeCriterion[];
  values: Record<string, unknown>;
}) {
  const { competitionId, group, playerId, judge, criteria, values } = options;
  if (group.scoring_status === 'locked') throw new Error('该组别评分已锁定');
  const player = db.prepare(`SELECT id FROM event_players WHERE id=? AND group_id=? AND competition_id=? AND audit_status!='rejected' AND status NOT IN ('withdrawn','cancelled')`)
    .get(playerId, group.id, competitionId);
  if (!player) throw new Error('选手不存在或报名已失效');

  const keys = new Set(criteria.map(item => item.key));
  const maximum = criteria.reduce((sum, item) => sum + item.maxScore, 0);
  if (!criteria.length || keys.size !== criteria.length || criteria.some(item => !Number.isFinite(item.maxScore) || item.maxScore <= 0) || Math.abs(maximum - 10) > 1e-8) {
    throw new Error('评分规则无效，分项总分必须为10分，请联系赛事管理员');
  }
  if (Object.keys(values).some(key => !keys.has(key))) throw new Error('评分规则已变化，请重新加载评分页面');
  const normalized: Record<string, number> = {};
  let total = 0;
  for (const criterion of criteria) {
    const raw = values[criterion.key];
    if ((typeof raw !== 'number' && typeof raw !== 'string') || String(raw).trim() === '') throw new Error(`请填写${criterion.name}`);
    const score = Number(raw);
    if (!Number.isFinite(score)) throw new Error(`请填写${criterion.name}`);
    if (score < 0 || score > criterion.maxScore) throw new Error(`${criterion.name}应在 0–${criterion.maxScore} 分之间`);
    normalized[criterion.key] = score;
    total += score;
  }
  if (!Number.isFinite(total) || total < 0 || total > 10 + 1e-8) throw new Error('赛事评分合计必须在0至10分之间');
  total = Number(total.toFixed(2));
  const now = new Date().toISOString();

  const result = db.transaction(() => {
    const currentGroup = verifyJudgeGroup(db, competitionId, Number(group.id), judge.id);
    if (!currentGroup) throw new Error('无此组别评委权限');
    if (currentGroup.scoring_status === 'locked') throw new Error('该组别评分已锁定');
    const currentCriteria = loadJudgeCriteria(db, competitionId, currentGroup);
    if (JSON.stringify(currentCriteria) !== JSON.stringify(criteria)) throw new Error('评分规则已变化，请重新加载评分页面');
    const previous = db.prepare(`SELECT * FROM event_scores WHERE group_id=? AND player_id=? AND judge_id=? AND score_status!='voided' ORDER BY version DESC LIMIT 1`)
      .get<Record<string, any>>(group.id, playerId, judge.id);
    db.prepare(`UPDATE event_scores SET score_status='voided', updated_at=? WHERE group_id=? AND player_id=? AND judge_id=? AND score_status!='voided'`)
      .run(now, group.id, playerId, judge.id);
    const versionRow = db.prepare(`SELECT COALESCE(MAX(version),0) AS value FROM event_scores WHERE group_id=? AND player_id=? AND judge_id=?`)
      .get<{ value: number }>(group.id, playerId, judge.id);
    const version = Number(versionRow?.value || 0) + 1;
    const inserted = db.prepare(`
      INSERT INTO event_scores (
        competition_id, group_id, player_id, judge_id, rule_id,
        raw_score, criteria_scores_json, calculated_score, score_status,
        submitted_at, version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?)
    `).run(competitionId, group.id, playerId, judge.id, criteria[0].ruleId, total, JSON.stringify(normalized), total, now, version, now);
    db.prepare(`
      INSERT INTO event_score_audit_logs (
        competition_id, group_id, player_id, judge_id, score_id,
        action, before_json, after_json, reason, operator
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(competitionId, group.id, playerId, judge.id, inserted.lastInsertRowid,
      previous ? 'correct_score' : 'submit_score', JSON.stringify(previous || {}),
      JSON.stringify({ criteriaScores: normalized, calculatedScore: total, version }),
      previous ? '评委修改评分' : '评委提交评分', judge.name);
    db.prepare(`UPDATE event_players SET score_status='scored', updated_at=? WHERE id=?`).run(now, playerId);
    recalculateGroupRankings(db, Number(group.id));
    return { id: Number(inserted.lastInsertRowid), total, version };
  }).immediate();
  return result;
}
