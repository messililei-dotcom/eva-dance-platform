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
        
        OR (${phoneSql('j.phone')} <> '' AND ${phoneSql('j.phone')} = ${phoneSql('m.phone')})
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
      COUNT(DISTINCT CASE WHEN p.audit_status != 'rejected' AND EXISTS (
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

export function loadJudgePlayers(db: AdminDb, competitionId: number, groupId: number, judgeId: number) {
  return db.prepare(`
    SELECT p.id, COALESCE(p.player_no, '') AS player_no, p.name,
      COALESCE(p.organization, '') AS organization,
      COALESCE(p.teacher, '') AS teacher,
      COALESCE((SELECT ep.title FROM event_performances ep WHERE ep.player_id=p.id ORDER BY ep.id LIMIT 1), '') AS performance_title,
      (SELECT s.calculated_score FROM event_scores s
        WHERE s.group_id=p.group_id AND s.player_id=p.id AND s.judge_id=?
          AND s.score_status IN ('submitted','reviewed','published')
        ORDER BY s.version DESC LIMIT 1) AS my_score,
      (SELECT s.score_status FROM event_scores s
        WHERE s.group_id=p.group_id AND s.player_id=p.id AND s.judge_id=?
          AND s.score_status!='voided'
        ORDER BY s.version DESC LIMIT 1) AS my_score_status
    FROM event_players p
    WHERE p.competition_id=? AND p.group_id=? AND p.audit_status!='rejected'
      AND p.status NOT IN ('withdrawn','cancelled')
    ORDER BY p.player_no ASC, p.id ASC
  `).all<Record<string, any>>(judgeId, judgeId, competitionId, groupId);
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
    ? db.prepare(`SELECT * FROM event_score_rules WHERE id=? AND status='active'`).all<Record<string, any>>(group.score_rule_id)
    : db.prepare(`SELECT * FROM event_score_rules WHERE competition_id=? AND status='active' ORDER BY id ASC`).all<Record<string, any>>(competitionId);
  const criteria = rules.flatMap((rule) => parseCriteria(rule.criteria_json, Number(rule.id), String(rule.name || ''), Number(rule.total_score || 0)));
  return criteria.length ? criteria : [{ key: 'total', name: '评分总分', maxScore: 100, ruleId: null }];
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
  if (!Object.keys(parsed).length && criteria.length === 1) parsed[criteria[0].key] = Number(latest.calculated_score || 0);
  return { values: parsed, total: Number(latest.calculated_score || 0), status: String(latest.score_status || '') };
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

  const normalized: Record<string, number> = {};
  let total = 0;
  for (const criterion of criteria) {
    const raw = values[criterion.key];
    if (raw === null || raw === undefined || String(raw).trim() === '') throw new Error(`请填写${criterion.name}`);
    const score = Number(raw);
    if (!Number.isFinite(score)) throw new Error(`请填写${criterion.name}`);
    if (score < 0 || score > criterion.maxScore) throw new Error(`${criterion.name}应在 0–${criterion.maxScore} 分之间`);
    normalized[criterion.key] = score;
    total += score;
  }
  total = Number(total.toFixed(2));
  const now = new Date().toISOString();

  const result = db.transaction(() => {
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
    `).run(competitionId, group.id, playerId, judge.id, group.score_rule_id || null, total, JSON.stringify(normalized), total, now, version, now);
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
  })();
  return result;
}
