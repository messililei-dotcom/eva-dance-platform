#!/usr/bin/env node

const fs = require('fs');
const Database = require('better-sqlite3');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function parseJson(value) {
  try { return value ? JSON.parse(String(value)) : {}; } catch { return {}; }
}

const dbPath = arg('--db', 'admin.db');
const planPath = arg('--plan');
const apply = process.argv.includes('--apply');
if (!planPath) throw new Error('Missing --plan');

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
if (plan.kind !== 'event_final_score_recovery' || plan.version !== 1) throw new Error('Unsupported recovery plan');
if (!plan.safety?.preserveEventScores || !plan.safety?.replaceRankingsOnlyInSourceGroups || !plan.safety?.publishFinalScores || !plan.safety?.lockCompletedGroups) {
  throw new Error('Recovery plan safety declaration is missing');
}

const db = new Database(dbPath, { readonly: !apply, fileMustExist: true });
if (apply) db.pragma('foreign_keys = ON');

const competition = db.prepare('SELECT id, name, start_date FROM event_competitions WHERE id = ?');
const group = db.prepare('SELECT id, competition_id, name FROM event_groups WHERE id = ?');
const player = db.prepare('SELECT * FROM event_players WHERE id = ?');
const recoveredPlayer = db.prepare("SELECT * FROM event_players WHERE json_extract(remark, '$.score_recovery.key') = ?");
const insertPlayer = apply ? db.prepare(`
  INSERT INTO event_players (
    competition_id, group_id, member_id, order_id, player_no, name,
    status, audit_status, paid_status, score_status, remark,
    registered_at, created_at, updated_at
  ) VALUES (?, ?, 0, 0, ?, ?, 'active', 'approved', 'paid', 'scored', ?, ?, ?, ?)
`) : null;
const updatePlayer = apply ? db.prepare(`
  UPDATE event_players SET score_status = 'scored', remark = ?, updated_at = ? WHERE id = ?
`) : null;
const deleteGroupRankings = apply ? db.prepare('DELETE FROM event_rankings WHERE group_id = ?') : null;
const insertRanking = apply ? db.prepare(`
  INSERT INTO event_rankings (
    competition_id, group_id, player_id, raw_total, calculated_total,
    published_total, rank_no, status, recalculated_at, published_at,
    created_at, updated_at, manual_total, manual_reason,
    manual_updated_by, manual_updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?)
`) : null;
const lockGroup = apply ? db.prepare("UPDATE event_groups SET scoring_status = 'locked', updated_at = ? WHERE id = ?") : null;
const countRankings = db.prepare('SELECT COUNT(*) AS count FROM event_rankings WHERE group_id = ?');

const resolvedPlayers = new Map();
const sourceGroups = new Set();
const report = {
  mode: apply ? 'apply' : 'preview',
  sourceRows: plan.rows.length,
  sourceGroups: 0,
  existingPlayers: 0,
  playersToCreate: 0,
  playersCreated: 0,
  playersUpdated: 0,
  rankingsCurrentlyInSourceGroups: 0,
  rankingsPublished: 0,
  eventScoreRowsBefore: db.prepare('SELECT COUNT(*) AS count FROM event_scores').get().count,
  eventScoreRowsAfter: 0,
  invalid: [],
};

function resolveRows(now) {
  for (const row of plan.rows) {
    const currentCompetition = competition.get(row.competitionId);
    const currentGroup = group.get(row.groupId);
    if (!currentCompetition) {
      report.invalid.push({ recoveryKey: row.recoveryKey, reason: 'competition_missing' });
      continue;
    }
    if (!currentGroup || Number(currentGroup.competition_id) !== Number(row.competitionId)) {
      report.invalid.push({ recoveryKey: row.recoveryKey, reason: 'group_missing_or_mismatched' });
      continue;
    }
    sourceGroups.add(Number(row.groupId));

    let currentPlayer = recoveredPlayer.get(row.recoveryKey) || null;
    if (!currentPlayer && row.existingPlayerId) currentPlayer = player.get(row.existingPlayerId) || null;
    if (currentPlayer && (Number(currentPlayer.competition_id) !== Number(row.competitionId) || Number(currentPlayer.group_id) !== Number(row.groupId))) {
      report.invalid.push({ recoveryKey: row.recoveryKey, reason: 'player_group_mismatch' });
      continue;
    }

    if (!currentPlayer) {
      report.playersToCreate += 1;
      if (apply) {
        const remark = {
          source: 'historical_final_score_xlsx',
          score_recovery: {
            key: row.recoveryKey,
            sourceSheet: row.sourceSheet,
            sourceRow: row.sourceRow,
            sourceRank: row.sourceRank,
            restoredAt: now,
          },
          legacy_payload: {
            name: row.name,
            show_name: row.name,
            cid: row.competitionId,
            tid: row.groupId,
            score: row.score,
            complete: 1,
          },
        };
        const registeredAt = currentCompetition.start_date || now;
        const result = insertPlayer.run(
          row.competitionId,
          row.groupId,
          `HIST-${row.competitionId}-${String(row.sourceRow).padStart(4, '0')}`,
          row.name,
          JSON.stringify(remark),
          registeredAt,
          now,
          now,
        );
        currentPlayer = player.get(Number(result.lastInsertRowid));
        report.playersCreated += 1;
      }
    } else {
      report.existingPlayers += 1;
      if (apply) {
        const remark = parseJson(currentPlayer.remark);
        remark.legacy_payload = { ...(remark.legacy_payload || {}), score: row.score, complete: 1 };
        remark.score_recovery = {
          key: row.recoveryKey,
          sourceSheet: row.sourceSheet,
          sourceRow: row.sourceRow,
          sourceRank: row.sourceRank,
          restoredAt: now,
        };
        updatePlayer.run(JSON.stringify(remark), now, currentPlayer.id);
        report.playersUpdated += 1;
      }
    }
    if (currentPlayer) resolvedPlayers.set(row.recoveryKey, Number(currentPlayer.id));
  }
}

function writeRankings(now) {
  report.sourceGroups = sourceGroups.size;
  for (const groupId of sourceGroups) {
    report.rankingsCurrentlyInSourceGroups += Number(countRankings.get(groupId).count || 0);
    if (apply) deleteGroupRankings.run(groupId);
  }
  if (!apply) return;
  for (const row of plan.rows) {
    const playerId = resolvedPlayers.get(row.recoveryKey);
    if (!playerId) throw new Error(`Player was not resolved: ${row.recoveryKey}`);
    insertRanking.run(
      row.competitionId,
      row.groupId,
      playerId,
      row.score,
      row.score,
      row.score,
      row.rankNo,
      now,
      now,
      now,
      now,
      row.score,
      `历史最终成绩恢复：${row.sourceSheet}第${row.sourceRow}行`,
      'Codex data recovery',
      now,
    );
    report.rankingsPublished += 1;
  }
  for (const groupId of sourceGroups) lockGroup.run(now, groupId);
}

const run = () => {
  const now = new Date().toISOString();
  resolveRows(now);
  if (report.invalid.length) throw new Error(`Recovery aborted: ${report.invalid.length} invalid rows`);
  writeRankings(now);
};

if (apply) db.transaction(run)();
else run();
report.eventScoreRowsAfter = db.prepare('SELECT COUNT(*) AS count FROM event_scores').get().count;
if (report.eventScoreRowsAfter !== report.eventScoreRowsBefore) throw new Error('event_scores changed unexpectedly');
console.log(JSON.stringify(report, null, 2));

