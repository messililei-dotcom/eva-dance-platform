const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const legacyPath = path.join(workspaceRoot, '10-赛事系统/新赛事系统/public/legacy-data.js');
const dbPath = path.join(projectRoot, 'admin.db');
const dbTsPath = path.join(projectRoot, 'src/app/api/event/_db.ts');
const donePath = '/tmp/codex-event-data-done.txt';

function loadBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch {
    return require(path.join(workspaceRoot, '03-学员管理系统/学员管理系统/server/node_modules/better-sqlite3'));
  }
}

function loadLegacyData() {
  const code = fs.readFileSync(legacyPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: legacyPath });
  const data = sandbox.window.EVA_EVENT_LEGACY_DATA || sandbox.window.LEGACY_DATA;
  if (!data || !data.normalized) {
    throw new Error('legacy-data.js did not expose window.LEGACY_DATA.normalized');
  }
  return data;
}

function ensureEventTables(db) {
  const source = fs.readFileSync(dbTsPath, 'utf8');
  const match = source.match(/export function ensureEventTables\(db: any\) \{\s*db\.exec\(`([\s\S]*?)`\);\s*\}/);
  if (!match) {
    throw new Error('Could not extract ensureEventTables SQL from src/app/api/event/_db.ts');
  }
  db.exec(match[1]);
}

function text(value, fallback = '') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function num(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function statusFromFlag(value, yes, no) {
  return num(value) === 1 ? yes : no;
}

function makeInsert(db, table, columns) {
  const placeholders = columns.map(() => '?').join(', ');
  return db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
}

const Database = loadBetterSqlite3();
const db = new Database(dbPath);
const legacy = loadLegacyData();
const n = legacy.normalized;

ensureEventTables(db);
db.pragma('foreign_keys = OFF');

const usersById = new Map((n.users || []).map((user) => [Number(user.id), user]));
const systemUsersById = new Map((n.systemUsers || []).map((user) => [Number(user.user_id), user]));
const playerIdByLegacyId = new Map();
const playerIdByUidGroup = new Map();
const playerIdsByUid = new Map();

const deleteTables = [
  'event_score_audit_logs',
  'event_result_publish_logs',
  'event_bigscreen_states',
  'event_certificates',
  'event_checkins',
  'event_music_files',
  'event_performances',
  'event_rankings',
  'event_scores',
  'event_group_judges',
  'event_score_rules',
  'event_players',
  'event_groups',
  'event_judges',
  'event_awards',
  'event_sessions',
  'event_competitions',
];

const insertCompetition = makeInsert(db, 'event_competitions', [
  'id', 'name', 'code', 'status', 'registration_status', 'start_date', 'end_date',
  'registration_start', 'registration_end', 'location', 'organizer', 'description',
  'cover_url', 'max_players', 'registration_fee', 'created_by', 'created_at', 'updated_at',
]);

const insertGroup = makeInsert(db, 'event_groups', [
  'id', 'competition_id', 'name', 'code', 'category', 'age_range', 'dance_type',
  'entry_type', 'sort_order', 'max_players', 'score_rule_id', 'scoring_status',
  'status', 'created_at', 'updated_at',
]);

const insertPlayer = makeInsert(db, 'event_players', [
  'id', 'competition_id', 'group_id', 'member_id', 'order_id', 'player_no', 'name',
  'phone', 'gender', 'birthday', 'organization', 'teacher', 'id_card', 'status',
  'audit_status', 'paid_status', 'score_status', 'remark', 'registered_at',
  'created_at', 'updated_at',
]);

const insertJudge = makeInsert(db, 'event_judges', [
  'id', 'name', 'phone', 'title', 'organization', 'bio', 'account_user_id',
  'status', 'auth_enabled', 'auth_token', 'last_login_at', 'created_at', 'updated_at',
]);

const insertGroupJudge = makeInsert(db, 'event_group_judges', [
  'id', 'competition_id', 'group_id', 'judge_id', 'role', 'weight', 'auth_enabled',
  'status', 'created_at', 'updated_at',
]);

const insertRule = makeInsert(db, 'event_score_rules', [
  'id', 'competition_id', 'name', 'total_score', 'criteria_json', 'drop_high_low',
  'abnormal_threshold', 'decimal_places', 'publish_mode', 'status', 'created_at', 'updated_at',
]);

const insertScore = makeInsert(db, 'event_scores', [
  'id', 'competition_id', 'group_id', 'player_id', 'performance_id', 'judge_id',
  'rule_id', 'raw_score', 'criteria_scores_json', 'calculated_score', 'published_score',
  'score_status', 'is_abnormal', 'abnormal_reason', 'submitted_at', 'reviewed_at',
  'published_at', 'version', 'created_at', 'updated_at',
]);

const insertRanking = makeInsert(db, 'event_rankings', [
  'id', 'competition_id', 'group_id', 'player_id', 'raw_total', 'calculated_total',
  'published_total', 'rank_no', 'award_id', 'status', 'recalculated_at',
  'published_at', 'created_at', 'updated_at',
]);

function resolvePlayerId(userId, groupId) {
  return playerIdByUidGroup.get(`${userId}|${groupId}`)
    || (playerIdsByUid.get(Number(userId)) || [Number(userId)])[0]
    || Number(userId)
    || 0;
}

const importAll = db.transaction(() => {
  for (const table of deleteTables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }

  for (const c of n.competitions || []) {
    const creator = systemUsersById.get(Number(c.create_by || c.comps_sysuser_id));
    insertCompetition.run(
      c.id,
      text(c.comps_name, `赛事${c.id}`),
      `LEGACY-${c.id}`,
      'active',
      statusFromFlag(c.signup, 'open', 'closed'),
      text(c.startDate || c.comps_time),
      text(c.endDate || c.comps_time),
      text(c.comps_enter_time),
      '',
      text(c.citys),
      text(creator && creator.nick_name),
      text(c.intro),
      text(c.comps_posterPic || c.vidLogo),
      num(c.player_num || c.playerCount),
      num(c.sign_price),
      text(c.create_by || c.comps_sysuser_id),
      text(c.comps_time || c.startDate),
      text(c.comps_time || c.endDate || c.startDate),
    );
  }

  for (const g of n.groups || []) {
    insertGroup.run(
      g.id,
      g.comps_id,
      text(g.group_name, `组别${g.id}`),
      text(g.group_key, `G${g.id}`),
      text(g.group_type),
      '',
      '',
      'solo',
      num(g.sort),
      0,
      null,
      'unlocked',
      'active',
      text(g.group_time || g.comps_time),
      text(g.group_time || g.comps_time),
    );
  }

  (n.players || []).forEach((p, index) => {
    const id = index + 1;
    const user = usersById.get(Number(p.uid));
    playerIdByLegacyId.set(String(p.id), id);
    playerIdByUidGroup.set(`${p.uid}|${p.tid}`, id);
    if (!playerIdsByUid.has(Number(p.uid))) playerIdsByUid.set(Number(p.uid), []);
    playerIdsByUid.get(Number(p.uid)).push(id);
    insertPlayer.run(
      id,
      num(p.cid),
      num(p.tid) || null,
      num(p.uid),
      0,
      text(p.startOrder || p.signOrder),
      text(p.name || p.show_name || (user && user.nickname), `选手${id}`),
      text(p.mobile || (user && user.tel)),
      text(user && user.sex),
      '',
      text(p.group_name),
      text([p.zhidao, p.bianwu].filter(Boolean).join(' / ')),
      '',
      statusFromFlag(p.isSignSuccess, 'confirmed', 'pending'),
      statusFromFlag(p.isSignSuccess, 'approved', 'pending'),
      statusFromFlag(p.isPaySuccess, 'paid', 'unpaid'),
      statusFromFlag(p.isScoreSuccess, 'scored', 'not_started'),
      json({
        legacy_id: p.id,
        show_name: p.show_name,
        province: p.province,
        city: p.city,
        style: p.style,
        mp3FileName: p.mp3FileName,
        mp3_file: p.mp3_file,
        mp3Time: p.mp3Time,
        costTradeNo: p.costTradeNo,
      }),
      text(p.sign_time),
      text(p.sign_time),
      text(p.score_time || p.paid_time || p.sign_time),
    );
  });

  for (const j of n.judges || []) {
    insertJudge.run(
      j.id,
      text(j.nickname, `评委${j.id}`),
      text(j.tel),
      '',
      '',
      json({ openid: j.openid, avatarUrl: j.avatarUrl, source: j.source }),
      j.id,
      num(j.banned) ? 'inactive' : 'active',
      num(j.isJudges) ? 1 : 0,
      '',
      '',
      text(j.user_date),
      text(j.user_date),
    );
  }

  for (const gj of n.groupJudges || []) {
    insertGroupJudge.run(
      gj.id,
      gj.comps_id,
      gj.group_id,
      gj.judges_id,
      num(gj.isLeader) ? 'leader' : 'judge',
      num(gj.isLeader) ? 1.2 : 1,
      1,
      'active',
      '',
      '',
    );
  }

  for (const rule of n.scoreRules || []) {
    insertRule.run(
      rule.id,
      rule.comps_id,
      `评分项${rule.scoreid}`,
      num(rule.scoreValue, 100),
      json([{ id: rule.scoreid, name: `评分项${rule.scoreid}`, maxScore: num(rule.scoreValue) }]),
      0,
      15,
      2,
      'review_then_publish',
      'active',
      '',
      '',
    );
  }

  for (const s of n.scores || []) {
    const playerId = resolvePlayerId(s.user_id, s.group_id);
    insertScore.run(
      s.id,
      s.comps_id,
      s.group_id,
      playerId,
      null,
      s.judges_id,
      s.scorerulesId,
      num(s.scoreValue),
      json({ [s.scorerulesId]: num(s.scoreValue), legacy_user_id: s.user_id }),
      num(s.scoreValue),
      num(s.scoreValue),
      'published',
      0,
      '',
      text(s.score_time),
      '',
      text(s.score_time),
      s.id,
      text(s.score_time),
      text(s.score_time),
    );
  }

  for (const r of n.integral || []) {
    const playerId = resolvePlayerId(r.user_id, 0);
    insertRanking.run(
      r.id,
      0,
      r.id,
      playerId,
      num(r.integral_value),
      num(r.integral_value),
      num(r.integral_value),
      num(r.integral_text),
      null,
      'published',
      text(r.integral_time),
      text(r.integral_time),
      text(r.integral_time),
      text(r.integral_time),
    );
  }
});

importAll();
db.pragma('foreign_keys = ON');

const counts = {};
for (const table of [
  'event_competitions',
  'event_groups',
  'event_players',
  'event_judges',
  'event_group_judges',
  'event_scores',
  'event_score_rules',
  'event_rankings',
]) {
  counts[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

fs.writeFileSync(donePath, `${new Date().toISOString()}\n${JSON.stringify(counts, null, 2)}\n`);
console.log(JSON.stringify(counts, null, 2));
console.log(`done: ${donePath}`);
db.close();
