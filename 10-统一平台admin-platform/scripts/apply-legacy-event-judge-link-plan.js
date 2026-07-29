#!/usr/bin/env node

const fs = require('fs');
const Database = require('better-sqlite3');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const dbPath = arg('--db', 'admin.db');
const planPath = arg('--plan');
const apply = process.argv.includes('--apply');
if (!planPath) throw new Error('Usage: node scripts/apply-legacy-event-judge-link-plan.js --db <admin.db> --plan <plan.json> [--apply]');

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
if (plan.kind !== 'legacy_event_group_judge_link_repair' || plan.version !== 1) throw new Error('Unsupported repair plan');
if (!plan.safety?.insertsOnly || !plan.safety?.competitionMustAlreadyExist || !plan.safety?.noCompetitionCreation || !plan.safety?.noScoreMutation) {
  throw new Error('Repair plan safety declaration is missing');
}

const db = new Database(dbPath, { readonly: !apply, fileMustExist: true });
if (apply) db.pragma('foreign_keys = ON');

const competition = db.prepare('SELECT id, code, name FROM event_competitions WHERE id = ?');
const group = db.prepare('SELECT id, competition_id FROM event_groups WHERE id = ?');
const judge = db.prepare('SELECT id FROM event_judges WHERE id = ?');
const existing = db.prepare('SELECT id FROM event_group_judges WHERE group_id = ? AND judge_id = ?');
const insert = apply ? db.prepare(`
  INSERT OR IGNORE INTO event_group_judges
    (competition_id, group_id, judge_id, role, weight, auth_enabled, status, created_at, updated_at)
  VALUES (?, ?, ?, 'judge', 1, 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`) : null;

const report = {
  mode: apply ? 'apply' : 'preview',
  planned: plan.assignments.length,
  eligible: 0,
  alreadyPresent: 0,
  inserted: 0,
  skippedDeletedCompetitions: 0,
  invalid: [],
  affectedCompetitions: new Set(),
};

function processPlan() {
  for (const row of plan.assignments) {
    const currentCompetition = competition.get(row.competitionId);
    if (!currentCompetition) {
      report.skippedDeletedCompetitions += 1;
      continue;
    }
    if (!String(currentCompetition.code || '').startsWith('LEGACY-')) {
      report.invalid.push({ ...row, reason: 'competition_is_not_legacy' });
      continue;
    }
    const currentGroup = group.get(row.groupId);
    if (!currentGroup || Number(currentGroup.competition_id) !== Number(row.competitionId)) {
      report.invalid.push({ ...row, reason: 'group_not_in_competition' });
      continue;
    }
    if (!judge.get(row.judgeId)) {
      report.invalid.push({ ...row, reason: 'judge_not_found' });
      continue;
    }
    if (existing.get(row.groupId, row.judgeId)) {
      report.alreadyPresent += 1;
      continue;
    }
    report.eligible += 1;
    report.affectedCompetitions.add(row.competitionId);
    if (apply) report.inserted += insert.run(row.competitionId, row.groupId, row.judgeId).changes;
  }
  if (report.invalid.length) throw new Error(`Repair aborted: ${report.invalid.length} invalid assignments`);
}

if (apply) db.transaction(processPlan)();
else processPlan();

console.log(JSON.stringify({
  ...report,
  affectedCompetitions: [...report.affectedCompetitions].sort((a, b) => a - b),
}, null, 2));

