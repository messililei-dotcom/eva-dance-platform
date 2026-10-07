import { openAdminDb } from '@/lib/server/admin-db';
import { verifyLocalToken } from '../_local-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function hasAuth(request: Request) {
  // 1. 检查 Authorization: Bearer token
  const bearerToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken && verifyLocalToken(bearerToken)) return true;

  // 2. 检查 Cookie 中的 token（用于 media/img 预览）
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookieToken = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('token='))
      ?.split('=')[1]?.trim();
    if (cookieToken && verifyLocalToken(cookieToken)) return true;
  }

  return false;
}

export function unauthorized() {
  return Response.json({ success: false, error: '未登录' }, { status: 401 });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status });
}

export function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function nowIso() {
  return new Date().toISOString();
}

export function openEventDb() {
  const db = openAdminDb();
  ensureEventTables(db);
  return db;
}

export function withEventDb<T>(fn: (db: any) => T) {
  const db = openEventDb();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export function ensureEventTables(db: any) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS event_competitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'published',
      registration_status TEXT NOT NULL DEFAULT 'closed',
      registration_public INTEGER NOT NULL DEFAULT 0,
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      registration_start TEXT DEFAULT '',
      registration_end TEXT DEFAULT '',
      location TEXT DEFAULT '',
      organizer TEXT DEFAULT '',
      description TEXT DEFAULT '',
      cover_url TEXT DEFAULT '',
      max_players INTEGER NOT NULL DEFAULT 0,
      registration_fee REAL NOT NULL DEFAULT 0,
      created_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT DEFAULT '',
      category TEXT DEFAULT '',
      age_range TEXT DEFAULT '',
      dance_type TEXT DEFAULT '',
      entry_type TEXT DEFAULT 'solo',
      sort_order INTEGER NOT NULL DEFAULT 0,
      max_players INTEGER NOT NULL DEFAULT 0,
      registration_fee REAL NOT NULL DEFAULT 0,
      score_rule_id INTEGER,
      scoring_status TEXT NOT NULL DEFAULT 'unlocked',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      name TEXT NOT NULL,
      venue TEXT DEFAULT '',
      starts_at TEXT DEFAULT '',
      ends_at TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      member_id INTEGER DEFAULT 0,
      order_id INTEGER DEFAULT 0,
      player_no TEXT DEFAULT '',
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      birthday TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      teacher TEXT DEFAULT '',
      id_card TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      audit_status TEXT NOT NULL DEFAULT 'pending',
      paid_status TEXT NOT NULL DEFAULT 'unpaid',
      score_status TEXT NOT NULL DEFAULT 'not_started',
      remark TEXT DEFAULT '',
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_performances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      player_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      music_file_id INTEGER,
      duration_seconds INTEGER DEFAULT 0,
      sequence_no INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (player_id) REFERENCES event_players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_judges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      title TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      account_user_id INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      auth_enabled INTEGER NOT NULL DEFAULT 0,
      auth_token TEXT DEFAULT '',
      last_login_at TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_group_judges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      judge_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'judge',
      weight REAL NOT NULL DEFAULT 1,
      auth_enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, judge_id),
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (judge_id) REFERENCES event_judges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_score_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER,
      name TEXT NOT NULL,
      total_score REAL NOT NULL DEFAULT 100,
      criteria_json TEXT NOT NULL DEFAULT '[]',
      drop_high_low INTEGER NOT NULL DEFAULT 0,
      judge_anonymous INTEGER NOT NULL DEFAULT 0,
      abnormal_threshold REAL NOT NULL DEFAULT 15,
      decimal_places INTEGER NOT NULL DEFAULT 2,
      publish_mode TEXT NOT NULL DEFAULT 'review_then_publish',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      performance_id INTEGER,
      judge_id INTEGER NOT NULL,
      rule_id INTEGER,
      raw_score REAL NOT NULL DEFAULT 0,
      criteria_scores_json TEXT NOT NULL DEFAULT '{}',
      calculated_score REAL NOT NULL DEFAULT 0,
      published_score REAL,
      score_status TEXT NOT NULL DEFAULT 'draft',
      is_abnormal INTEGER NOT NULL DEFAULT 0,
      abnormal_reason TEXT DEFAULT '',
      submitted_at TEXT DEFAULT '',
      reviewed_at TEXT DEFAULT '',
      published_at TEXT DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, player_id, judge_id, version),
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES event_players(id) ON DELETE CASCADE,
      FOREIGN KEY (performance_id) REFERENCES event_performances(id) ON DELETE SET NULL,
      FOREIGN KEY (judge_id) REFERENCES event_judges(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_id) REFERENCES event_score_rules(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      raw_total REAL NOT NULL DEFAULT 0,
      calculated_total REAL NOT NULL DEFAULT 0,
      published_total REAL,
      rank_no INTEGER NOT NULL DEFAULT 0,
      award_id INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      recalculated_at TEXT DEFAULT '',
      published_at TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, player_id),
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES event_players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_awards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      name TEXT NOT NULL,
      award_type TEXT NOT NULL DEFAULT 'rank',
      rank_start INTEGER DEFAULT 0,
      rank_end INTEGER DEFAULT 0,
      quota INTEGER DEFAULT 0,
      certificate_template_id INTEGER DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      player_id INTEGER NOT NULL,
      award_id INTEGER,
      certificate_no TEXT NOT NULL UNIQUE,
      certificate_url TEXT DEFAULT '',
      issued_at TEXT DEFAULT '',
      issued_by TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (player_id) REFERENCES event_players(id) ON DELETE CASCADE,
      FOREIGN KEY (award_id) REFERENCES event_awards(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      player_id INTEGER NOT NULL,
      checkin_type TEXT NOT NULL DEFAULT 'onsite',
      checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checked_by TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'checked',
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (player_id) REFERENCES event_players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_music_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      player_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      duration_seconds INTEGER DEFAULT 0,
      audit_status TEXT NOT NULL DEFAULT 'pending',
      audit_remark TEXT DEFAULT '',
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      audited_at TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (player_id) REFERENCES event_players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_result_publish_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      action TEXT NOT NULL,
      snapshot_json TEXT NOT NULL DEFAULT '{}',
      operator TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_score_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      group_id INTEGER,
      player_id INTEGER,
      judge_id INTEGER,
      score_id INTEGER,
      action TEXT NOT NULL,
      before_json TEXT NOT NULL DEFAULT '{}',
      after_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT DEFAULT '',
      operator TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES event_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (player_id) REFERENCES event_players(id) ON DELETE SET NULL,
      FOREIGN KEY (judge_id) REFERENCES event_judges(id) ON DELETE SET NULL,
      FOREIGN KEY (score_id) REFERENCES event_scores(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_bigscreen_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      current_group_id INTEGER,
      current_player_id INTEGER,
      current_performance_id INTEGER,
      mode TEXT NOT NULL DEFAULT 'standby',
      payload_json TEXT NOT NULL DEFAULT '{}',
      updated_by TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(competition_id),
      FOREIGN KEY (competition_id) REFERENCES event_competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (current_group_id) REFERENCES event_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (current_player_id) REFERENCES event_players(id) ON DELETE SET NULL,
      FOREIGN KEY (current_performance_id) REFERENCES event_performances(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_event_groups_competition ON event_groups(competition_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_event_players_competition ON event_players(competition_id, group_id, status);
    CREATE INDEX IF NOT EXISTS idx_event_scores_group_player ON event_scores(group_id, player_id, judge_id);
    CREATE INDEX IF NOT EXISTS idx_event_scores_player ON event_scores(player_id);
    CREATE INDEX IF NOT EXISTS idx_event_scores_judge ON event_scores(judge_id);
    CREATE INDEX IF NOT EXISTS idx_event_group_judges_group ON event_group_judges(group_id, judge_id);
    CREATE INDEX IF NOT EXISTS idx_event_group_judges_competition ON event_group_judges(competition_id, judge_id);
    CREATE INDEX IF NOT EXISTS idx_event_group_judges_judge ON event_group_judges(judge_id);
  `);

  const competitionColumns = new Set((db.prepare('PRAGMA table_info(event_competitions)').all() as Array<{ name: string }>).map((row) => row.name));
  if (!competitionColumns.has('registration_public')) {
    db.transaction(() => {
      db.exec('ALTER TABLE event_competitions ADD COLUMN registration_public INTEGER NOT NULL DEFAULT 0');
      // Preserve existing public registration views; new competitions default to private.
      db.exec('UPDATE event_competitions SET registration_public = 1');
    })();
  }

  if (!competitionColumns.has('judge_scores_public')) {
    db.transaction(() => {
      db.exec('ALTER TABLE event_competitions ADD COLUMN judge_scores_public INTEGER NOT NULL DEFAULT 0');
      // Preserve current historical score visibility; new events start private.
      db.exec('UPDATE event_competitions SET judge_scores_public = 1');
    })();
  }

  const judgeColumns = new Set((db.prepare('PRAGMA table_info(event_judges)').all() as Array<{ name: string }>).map((row) => row.name));
  if (!judgeColumns.has('member_id')) db.exec('ALTER TABLE event_judges ADD COLUMN member_id INTEGER DEFAULT 0');
  db.exec('CREATE INDEX IF NOT EXISTS idx_event_judges_member ON event_judges(member_id)');

  const groupColumns = new Set((db.prepare('PRAGMA table_info(event_groups)').all() as Array<{ name: string }>).map((row) => row.name));
  if (!groupColumns.has('registration_fee')) db.exec('ALTER TABLE event_groups ADD COLUMN registration_fee REAL NOT NULL DEFAULT 0');

  const ruleColumns = new Set((db.prepare('PRAGMA table_info(event_score_rules)').all() as Array<{ name: string }>).map((row) => row.name));
  if (!ruleColumns.has('judge_anonymous')) db.exec('ALTER TABLE event_score_rules ADD COLUMN judge_anonymous INTEGER NOT NULL DEFAULT 0');

  const rankingColumns = new Set((db.prepare('PRAGMA table_info(event_rankings)').all() as Array<{ name: string }>).map((row) => row.name));
  if (!rankingColumns.has('manual_total')) db.exec('ALTER TABLE event_rankings ADD COLUMN manual_total REAL');
  if (!rankingColumns.has('manual_reason')) db.exec("ALTER TABLE event_rankings ADD COLUMN manual_reason TEXT DEFAULT ''");
  if (!rankingColumns.has('manual_updated_by')) db.exec("ALTER TABLE event_rankings ADD COLUMN manual_updated_by TEXT DEFAULT ''");
  if (!rankingColumns.has('manual_updated_at')) db.exec("ALTER TABLE event_rankings ADD COLUMN manual_updated_at TEXT DEFAULT ''");
}

export function generateCode(prefix: string) {
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

export function competitionSelectSql() {
  return `
    SELECT
      c.*,
      (SELECT COUNT(*) FROM event_players p WHERE p.competition_id=c.id AND p.audit_status!='rejected' AND p.status NOT IN ('withdrawn','cancelled')) AS active_player_count,
      (SELECT COUNT(*) FROM event_groups g WHERE g.competition_id = c.id) AS group_count,
      (SELECT COUNT(*) FROM event_players p WHERE p.competition_id = c.id) AS player_count,
      (SELECT COUNT(DISTINCT gj.judge_id) FROM event_group_judges gj WHERE gj.competition_id = c.id) AS judge_count,
      (SELECT COUNT(*) FROM event_players p WHERE p.competition_id = c.id AND p.audit_status = 'approved') AS approved_player_count
    FROM event_competitions c
  `;
}

export function mapCompetition(row: any) {
  return {
    id: row.id,
    key: String(row.id),
    name: row.name,
    code: row.code,
    status: row.status,
    registrationStatus: row.registration_status,
    registrationPublic: Number(row.registration_public) === 1,
    judgeScoresPublic: Number(row.judge_scores_public) === 1,
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    registrationStart: row.registration_start || '',
    registrationEnd: row.registration_end || '',
    location: row.location || '',
    organizer: row.organizer || '',
    description: row.description || '',
    coverUrl: row.cover_url || '',
    maxPlayers: row.max_players || 0,
    registrationFee: row.registration_fee || 0,
    groupCount: row.group_count || 0,
    playerCount: row.player_count || 0,
    judgeCount: row.judge_count || 0,
    approvedPlayerCount: row.approved_player_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPublicCompetition(row: any) {
  const value = mapCompetition(row);
  return { ...value, playerCount: value.registrationPublic ? Number(row.active_player_count || 0) : null,
    approvedPlayerCount: value.registrationPublic ? value.approvedPlayerCount : null };
}

export function mapGroup(row: any) {
  return {
    id: row.id,
    key: String(row.id),
    competitionId: row.competition_id,
    name: row.name,
    code: row.code || '',
    category: row.category || '',
    ageRange: row.age_range || '',
    danceType: row.dance_type || '',
    entryType: row.entry_type || 'solo',
    sortOrder: row.sort_order || 0,
    maxPlayers: row.max_players || 0,
    registrationFee: Number(row.registration_fee || 0),
    scoreRuleId: row.score_rule_id || null,
    scoreRuleName: row.score_rule_name || '',
    scoringStatus: row.scoring_status || 'unlocked',
    status: row.status || 'active',
    playerCount: row.player_count || 0,
    judgeCount: row.judge_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlayer(row: any) {
  return {
    id: row.id,
    key: String(row.id),
    competitionId: row.competition_id,
    competitionName: row.competition_name || '',
    groupId: row.group_id || null,
    groupName: row.group_name || '',
    memberId: row.member_id || 0,
    orderId: row.order_id || 0,
    playerNo: row.player_no || '',
    sequenceNo: Number(row.sequence_no || 0),
    musicFileId: Number(row.music_file_id || 0),
    performanceTitle: row.performance_title || '',
    name: row.name,
    phone: row.phone || '',
    gender: row.gender || '',
    birthday: row.birthday || '',
    organization: row.organization || '',
    teacher: row.teacher || '',
    status: row.status || 'pending',
    auditStatus: row.audit_status || 'pending',
    paidStatus: row.paid_status || 'unpaid',
    scoreStatus: row.score_status || 'not_started',
    remark: row.remark || '',
    scoreCount: row.score_count || 0,
    judgeCount: row.judge_count || 0,
    registeredAt: row.registered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapJudge(row: any) {
  return {
    id: row.id,
    key: String(row.id),
    memberId: row.member_id || 0,
    name: row.name,
    phone: row.phone || '',
    title: row.title || '',
    organization: row.organization || '',
    bio: row.bio || '',
    accountUserId: row.account_user_id || 0,
    status: row.status || 'active',
    authEnabled: Boolean(row.auth_enabled),
    assignedGroupCount: row.assigned_group_count || 0,
    scoreCount: row.score_count || 0,
    lastLoginAt: row.last_login_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapScoreRule(row: any) {
  return {
    id: row.id,
    key: String(row.id),
    competitionId: row.competition_id || null,
    name: row.name,
    totalScore: row.total_score || 100,
    criteriaJson: row.criteria_json || '[]',
    dropHighLow: Boolean(row.drop_high_low),
    judgeAnonymous: Boolean(row.judge_anonymous),
    abnormalThreshold: row.abnormal_threshold || 15,
    decimalPlaces: row.decimal_places || 2,
    publishMode: row.publish_mode || 'review_then_publish',
    status: row.status || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function safeJsonParse<T>(value: unknown, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export function mapScore(row: any) {
  return {
    id: row.id,
    key: String(row.id),
    competitionId: row.competition_id,
    groupId: row.group_id,
    groupName: row.group_name || '',
    playerId: row.player_id,
    playerName: row.player_name || '',
    playerNo: row.player_no || '',
    judgeId: row.judge_id,
    judgeName: row.judge_name || '',
    ruleId: row.rule_id || null,
    rawScore: Number(row.raw_score || 0),
    criteriaScores: safeJsonParse<Record<string, number>>(row.criteria_scores_json, {}),
    calculatedScore: Number(row.calculated_score || 0),
    publishedScore: row.published_score == null ? null : Number(row.published_score),
    scoreStatus: row.score_status || 'draft',
    isAbnormal: Boolean(row.is_abnormal),
    abnormalReason: row.abnormal_reason || '',
    submittedAt: row.submitted_at || '',
    reviewedAt: row.reviewed_at || '',
    publishedAt: row.published_at || '',
    version: row.version || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRanking(row: any) {
  return {
    id: row.id,
    key: String(row.id),
    competitionId: row.competition_id,
    groupId: row.group_id,
    groupName: row.group_name || '',
    playerId: row.player_id,
    playerName: row.player_name || '',
    playerNo: row.player_no || '',
    organization: row.organization || '',
    rawTotal: Number(row.raw_total || 0),
    calculatedTotal: Number(row.calculated_total || 0),
    manualTotal: row.manual_total == null ? null : Number(row.manual_total),
    manualReason: row.manual_reason || '',
    manualUpdatedBy: row.manual_updated_by || '',
    manualUpdatedAt: row.manual_updated_at || '',
    publishedTotal: row.published_total == null ? null : Number(row.published_total),
    rankNo: row.rank_no || 0,
    status: row.status || 'draft',
    scoreCount: row.score_count || 0,
    judgeCount: row.judge_count || 0,
    abnormalCount: row.abnormal_count || 0,
    recalculatedAt: row.recalculated_at || '',
    publishedAt: row.published_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getRuleForGroup(db: any, groupId: number, ruleId?: number | null) {
  const group = db.prepare('SELECT * FROM event_groups WHERE id = ?').get(groupId);
  const explicitRuleId = Number(ruleId || group?.score_rule_id || 0);
  let row = explicitRuleId ? db.prepare('SELECT * FROM event_score_rules WHERE id = ?').get(explicitRuleId) : null;
  if (!row && group?.competition_id) {
    const competitionRules = db.prepare('SELECT * FROM event_score_rules WHERE competition_id = ? ORDER BY id ASC').all(group.competition_id);
    if (competitionRules.length === 1) row = competitionRules[0];
    else if (competitionRules.length > 1) {
      row = {
        ...competitionRules[0],
        total_score: competitionRules.reduce((sum: number, item: any) => sum + Number(item.total_score || 0), 0),
        criteria_json: JSON.stringify(competitionRules.flatMap((item: any) => safeJsonParse(item.criteria_json, []))),
        drop_high_low: competitionRules.some((item: any) => Boolean(item.drop_high_low)) ? 1 : 0,
      };
    }
  }
  return row || {
    id: null,
    total_score: 100,
    criteria_json: '[]',
    drop_high_low: 0,
    abnormal_threshold: 15,
    decimal_places: 2,
  };
}

export function calculateScore(rule: any, criteriaScores: Record<string, unknown>, rawScore: number) {
  const criteria = safeJsonParse<Array<{ name?: string; score?: number }>>(rule.criteria_json, []);
  for (const [key, input] of Object.entries(criteriaScores || {})) {
    const value = Number(input);
    if (input === null || input === '' || !Number.isFinite(value) || value < 0) throw new Error('分项评分必须是非负数字');
    const criterion = criteria.find((item: any, index: number) => [item.name, String(item.id ?? item.key ?? `${rule.id || 'rule'}-${index}`)].includes(key));
    if (criteria.length && !criterion) throw new Error('未知评分项');
    if (criterion && value > Number((criterion as any).maxScore ?? criterion.score ?? 0)) throw new Error(`${criterion.name || key}超过单项上限`);
  }
  if (!Number.isFinite(rawScore)) throw new Error('评分必须是有效数字');
  const criteriaTotal = criteria.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const values = Object.values(criteriaScores || {})
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const criteriaSum = values.length ? values.reduce((sum, value) => sum + value, 0) : 0;
  const score = values.length ? criteriaSum : rawScore;
  const totalScore = Number(rule.total_score || criteriaTotal || 100);
  const decimalPlaces = Math.max(0, Math.min(4, Number(rule.decimal_places ?? 2)));
  if (score < 0) throw new Error('评分不能小于 0');
  if (score > totalScore) throw new Error(`评分不能超过总分 ${totalScore}`);
  if (criteriaTotal > 0 && criteriaSum > criteriaTotal) throw new Error(`分项评分不能超过 ${criteriaTotal}`);
  return Number(score.toFixed(decimalPlaces));
}

export function markAbnormalScore(db: any, groupId: number, playerId: number, judgeId: number, score: number, threshold: number) {
  const peers = db.prepare(`
    SELECT calculated_score AS value
    FROM event_scores s
    WHERE s.group_id = ?
      AND s.player_id = ?
      AND s.judge_id != ?
      AND s.score_status IN ('submitted', 'reviewed', 'published')
      AND NOT EXISTS (
        SELECT 1
        FROM event_scores newer
        WHERE newer.group_id = s.group_id
          AND newer.player_id = s.player_id
          AND newer.judge_id = s.judge_id
          AND newer.version > s.version
          AND newer.score_status IN ('submitted', 'reviewed', 'published')
      )
  `).all(groupId, playerId, judgeId);
  if (peers.length < 2) return { isAbnormal: false, reason: '' };
  const average = peers.reduce((sum: number, row: any) => sum + Number(row.value || 0), 0) / peers.length;
  const diff = Math.abs(score - average);
  if (diff <= threshold) return { isAbnormal: false, reason: '' };
  return {
    isAbnormal: true,
    reason: `与其他评委均分相差 ${diff.toFixed(2)}，超过阈值 ${threshold}`,
  };
}

export { recalculateGroupRankings, rerankGroupRankings } from '@/lib/server/event-ranking';
