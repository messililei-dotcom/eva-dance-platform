import type { AdminDb } from './admin-db';

export const GROWTH_LEVELS = [
  { no: 1, name: '初舞学员', min: 0, next: 1000 },
  { no: 2, name: '律动学员', min: 1000, next: 5000 },
  { no: 3, name: '舞韵学员', min: 5000, next: 15000 },
  { no: 4, name: '资深舞者', min: 15000, next: 40000 },
  { no: 5, name: '卓越舞者', min: 40000, next: null },
] as const;

export const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || 'Asia/Shanghai';
export const EVENT_REGISTRATION_POINTS = 100;
export const EVENT_RANK_POINTS: Record<number, number> = { 1: 100, 2: 50, 3: 20 };
export const EVENT_RANK_LABELS: Record<number, string> = { 1: '冠军', 2: '亚军', 3: '季军' };

type GrowthEvent = {
  userId: number;
  eventType: string;
  pointsDelta: number;
  sourceType: string;
  sourceId: string | number;
  idempotencyKey: string;
  description: string;
  operatorId?: string | number | null;
  occurredAt?: string;
};

function tableExists(db: AdminDb, table: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function dateKey(value: unknown) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '';
}

function safeDateTime(value: unknown) {
  const text = String(value || '').trim();
  return dateKey(text) ? text : new Date().toISOString();
}

function memberExists(db: AdminDb, memberId: number) {
  return Boolean(db.prepare('SELECT id FROM Member WHERE id=?').get(memberId));
}

export function levelForExperience(value: unknown) {
  const experience = Math.max(0, Math.floor(Number(value) || 0));
  return [...GROWTH_LEVELS].reverse().find(level => experience >= level.min) || GROWTH_LEVELS[0];
}

export function formatLevel(levelNo: number, levelName?: string) {
  const level = GROWTH_LEVELS.find(item => item.no === Number(levelNo)) || GROWTH_LEVELS[0];
  return `${levelName || level.name} Lv.${level.no}`;
}

export function formatAcademyAge(startedAt: unknown, now = new Date()) {
  const startKey = dateKey(startedAt);
  if (!startKey) return { text: '尚未开始', days: 0, months: 0, years: 0 };
  const [year, month, day] = startKey.split('-').map(Number);
  const nowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(nowParts.map(part => [part.type, Number(part.value)]));
  const startUtc = Date.UTC(year, month - 1, day);
  const nowUtc = Date.UTC(values.year, values.month - 1, values.day);
  const days = Math.max(0, Math.floor((nowUtc - startUtc) / 86400000));
  let months = (values.year - year) * 12 + values.month - month;
  if (values.day < day) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const text = months < 1
    ? '新学员'
    : years < 1
      ? `${months}个月`
      : `${years}年${remainingMonths ? `${remainingMonths}个月` : ''}`;
  return { text, days, months, years };
}

export function ensureGrowthTables(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS StudentGrowthSummary (
      user_id INTEGER PRIMARY KEY,
      experience_total INTEGER NOT NULL DEFAULT 0 CHECK(experience_total >= 0),
      level_no INTEGER NOT NULL DEFAULT 1 CHECK(level_no BETWEEN 1 AND 5),
      level_name TEXT NOT NULL DEFAULT '初舞学员',
      academy_started_at TEXT DEFAULT NULL,
      academy_started_source TEXT DEFAULT '',
      academy_override_at TEXT DEFAULT NULL,
      academy_override_source TEXT DEFAULT '',
      online_authorized_courses INTEGER NOT NULL DEFAULT 0,
      online_completed_lessons INTEGER NOT NULL DEFAULT 0,
      offline_completed_hours INTEGER NOT NULL DEFAULT 0,
      completed_courses INTEGER NOT NULL DEFAULT 0,
      total_learning_days INTEGER NOT NULL DEFAULT 0,
      current_streak_days INTEGER NOT NULL DEFAULT 0,
      longest_streak_days INTEGER NOT NULL DEFAULT 0,
      last_learning_at TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ExperienceLedger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      points_delta INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      operator_id TEXT DEFAULT NULL,
      occurred_at TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS LevelChangeLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      old_level INTEGER NOT NULL,
      new_level INTEGER NOT NULL,
      experience_total INTEGER NOT NULL,
      change_reason TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS AcademyStartAudit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      old_started_at TEXT DEFAULT NULL,
      new_started_at TEXT NOT NULL,
      source TEXT NOT NULL,
      evidence TEXT NOT NULL,
      reason TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS GrowthRecalculationRun (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL,
      member_count INTEGER NOT NULL DEFAULT 0,
      event_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      detail TEXT DEFAULT '',
      operator_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_experience_ledger_idempotency ON ExperienceLedger(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_experience_ledger_user ON ExperienceLedger(user_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_experience_ledger_event ON ExperienceLedger(event_type, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_experience_ledger_source ON ExperienceLedger(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_level_change_user ON LevelChangeLog(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_growth_level ON StudentGrowthSummary(level_no, last_learning_at);
    CREATE INDEX IF NOT EXISTS idx_growth_academy_start ON StudentGrowthSummary(academy_started_at);
  `);
  const summaryColumns = db.prepare('PRAGMA table_info(StudentGrowthSummary)').all<{ name: string }>().map(row => row.name);
  if (!summaryColumns.includes('online_authorized_courses')) {
    db.prepare('ALTER TABLE StudentGrowthSummary ADD COLUMN online_authorized_courses INTEGER NOT NULL DEFAULT 0').run();
  }
}

function learningDates(db: AdminDb, memberId: number) {
  return db.prepare(`
    SELECT learning_date
    FROM (
      SELECT source_type, source_id, MIN(substr(occurred_at, 1, 10)) AS learning_date,
             SUM(points_delta) AS net_points
      FROM ExperienceLedger
      WHERE user_id=? AND event_type IN ('online_lesson','offline_checkin','reversal')
        AND source_type IN ('video_progress','consume_record')
      GROUP BY source_type, source_id
      HAVING net_points > 0
    )
    WHERE learning_date <> ''
    GROUP BY learning_date
    ORDER BY learning_date
  `).all<{ learning_date: string }>(memberId).map(row => row.learning_date);
}

function streakStats(dates: string[]) {
  let current = 0;
  let longest = 0;
  let segmentStart = '';
  const segments: Array<{ start: string; end: string; length: number }> = [];
  let previous = 0;
  dates.forEach((value, index) => {
    const stamp = Date.parse(`${value}T00:00:00Z`);
    if (!index || stamp - previous !== 86400000) {
      if (current) segments.push({ start: segmentStart, end: dates[index - 1], length: current });
      current = 1;
      segmentStart = value;
    } else {
      current += 1;
    }
    longest = Math.max(longest, current);
    previous = stamp;
  });
  if (current) segments.push({ start: segmentStart, end: dates[dates.length - 1], length: current });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(new Date());
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(new Date(Date.now() - 86400000));
  const last = dates[dates.length - 1] || '';
  return { current: last === today || last === yesterday ? current : 0, longest, segments };
}

function academyStartCandidate(db: AdminDb, memberId: number, overrideAt?: string | null, overrideSource?: string | null) {
  const candidates: Array<{ at: string; source: string }> = [];
  if (overrideAt && dateKey(overrideAt)) candidates.push({ at: dateKey(overrideAt), source: overrideSource || 'admin' });
  if (tableExists(db, 'Payment')) {
    const row = db.prepare(`
      SELECT MIN(COALESCE(NULLIF(date,''), created_at)) AS at FROM Payment
      WHERE memberId=? AND COALESCE(amount,0)>0
        AND lower(COALESCE(paymentStatus,'paid')) IN ('paid','completed','success','settled')
    `).get<{ at?: string }>(memberId);
    if (row?.at) candidates.push({ at: dateKey(row.at), source: 'purchase' });
  }
  if (tableExists(db, 'CourseOrder')) {
    const row = db.prepare(`SELECT MIN(COALESCE(paid_at,created_at)) AS at FROM CourseOrder WHERE member_id=? AND amount>0 AND status='paid'`).get<{ at?: string }>(memberId);
    if (row?.at) candidates.push({ at: dateKey(row.at), source: 'purchase' });
  }
  if (tableExists(db, 'CourseAuthorization')) {
    const row = db.prepare(`
      SELECT MIN(granted_at) AS at FROM CourseAuthorization
      WHERE member_id=? AND status='active'
        AND (expire_at IS NULL OR expire_at='' OR datetime(expire_at)>=datetime('now','localtime'))
    `).get<{ at?: string }>(memberId);
    if (row?.at) candidates.push({ at: dateKey(row.at), source: 'purchase' });
  }
  if (tableExists(db, 'VideoProgress')) {
    const row = db.prepare(`SELECT MIN(COALESCE(last_play_at,created_at)) AS at FROM VideoProgress WHERE member_id=? AND completed=1`).get<{ at?: string }>(memberId);
    if (row?.at) candidates.push({ at: dateKey(row.at), source: 'online_learning' });
  }
  if (tableExists(db, 'ConsumeRecord')) {
    const row = db.prepare(`SELECT MIN(COALESCE(NULLIF(consumeDate,''),created_at)) AS at FROM ConsumeRecord WHERE memberId=? AND count>0`).get<{ at?: string }>(memberId);
    if (row?.at) candidates.push({ at: dateKey(row.at), source: 'offline_checkin' });
  }
  return candidates.filter(item => item.at).sort((a, b) => a.at.localeCompare(b.at))[0] || null;
}

function groupedPositiveSourceCount(db: AdminDb, memberId: number, sourceType: string) {
  return Number(db.prepare(`
    SELECT COUNT(*) AS count FROM (
      SELECT source_id FROM ExperienceLedger WHERE user_id=? AND source_type=?
      GROUP BY source_id HAVING SUM(points_delta)>0
    )
  `).get<{ count: number }>(memberId, sourceType)?.count || 0);
}

function offlineHours(db: AdminDb, memberId: number) {
  if (!tableExists(db, 'ConsumeRecord')) return groupedPositiveSourceCount(db, memberId, 'consume_record');
  return Math.max(0, Number(db.prepare('SELECT COALESCE(SUM(count),0) AS count FROM ConsumeRecord WHERE memberId=?').get<{ count: number }>(memberId)?.count || 0));
}

export function recalculateMemberGrowth(db: AdminDb, memberId: number, reason = '系统自动重算'): Record<string, any> {
  ensureGrowthTables(db);
  if (!memberExists(db, memberId)) throw new Error('学员不存在');
  const existing = db.prepare('SELECT * FROM StudentGrowthSummary WHERE user_id=?').get<Record<string, any>>(memberId);
  const ledgerTotal = Number(db.prepare('SELECT COALESCE(SUM(points_delta),0) AS total FROM ExperienceLedger WHERE user_id=?').get<{ total: number }>(memberId)?.total || 0);
  const experienceTotal = Math.max(0, Math.floor(ledgerTotal));
  const level = levelForExperience(experienceTotal);
  const dates = learningDates(db, memberId);
  const streak = streakStats(dates);
  const academy = academyStartCandidate(db, memberId, existing?.academy_override_at, existing?.academy_override_source);
  const onlineCompletedLessons = groupedPositiveSourceCount(db, memberId, 'video_progress');
  const completedCourses = groupedPositiveSourceCount(db, memberId, 'online_course');
  const onlineAuthorizedCourses = tableExists(db, 'CourseAuthorization')
    ? Number(db.prepare("SELECT COUNT(*) AS count FROM CourseAuthorization WHERE member_id=? AND status='active' AND (expire_at IS NULL OR expire_at='' OR datetime(expire_at)>=datetime('now','localtime'))").get<{ count: number }>(memberId)?.count || 0)
    : 0;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO StudentGrowthSummary (
      user_id, experience_total, level_no, level_name, academy_started_at, academy_started_source,
      academy_override_at, academy_override_source, online_authorized_courses, online_completed_lessons, offline_completed_hours,
      completed_courses, total_learning_days, current_streak_days, longest_streak_days,
      last_learning_at, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      experience_total=excluded.experience_total, level_no=excluded.level_no, level_name=excluded.level_name,
      academy_started_at=excluded.academy_started_at, academy_started_source=excluded.academy_started_source,
      academy_override_at=excluded.academy_override_at, academy_override_source=excluded.academy_override_source,
      online_authorized_courses=excluded.online_authorized_courses,
      online_completed_lessons=excluded.online_completed_lessons,
      offline_completed_hours=excluded.offline_completed_hours, completed_courses=excluded.completed_courses,
      total_learning_days=excluded.total_learning_days, current_streak_days=excluded.current_streak_days,
      longest_streak_days=MAX(StudentGrowthSummary.longest_streak_days,excluded.longest_streak_days),
      last_learning_at=excluded.last_learning_at, updated_at=excluded.updated_at
  `).run(
    memberId, experienceTotal, level.no, level.name, academy?.at || null, academy?.source || '',
    existing?.academy_override_at || null, existing?.academy_override_source || '', onlineAuthorizedCourses, onlineCompletedLessons,
    offlineHours(db, memberId), completedCourses, dates.length, streak.current,
    Math.max(Number(existing?.longest_streak_days || 0), streak.longest), dates[dates.length - 1] || null,
    existing?.created_at || now, now,
  );

  if (existing && Number(existing.level_no) !== level.no) {
    db.prepare(`INSERT INTO LevelChangeLog (user_id,old_level,new_level,experience_total,change_reason) VALUES (?,?,?,?,?)`)
      .run(memberId, Number(existing.level_no) || 1, level.no, experienceTotal, reason);
  }
  db.prepare('UPDATE Member SET level=? WHERE id=?').run(formatLevel(level.no, level.name), memberId);
  return getGrowthSummary(db, memberId)!;
}

export function insertExperienceEvent(db: AdminDb, event: GrowthEvent, recalculate = true) {
  ensureGrowthTables(db);
  if (!db.prepare('SELECT user_id FROM StudentGrowthSummary WHERE user_id=?').get(event.userId)) {
    recalculateMemberGrowth(db, event.userId, '成长档案初始化');
  }
  const result = db.prepare(`
    INSERT OR IGNORE INTO ExperienceLedger (
      user_id,event_type,points_delta,source_type,source_id,idempotency_key,
      description,operator_id,occurred_at
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    event.userId, event.eventType, Math.trunc(event.pointsDelta), event.sourceType,
    String(event.sourceId), event.idempotencyKey, event.description,
    event.operatorId === undefined || event.operatorId === null ? null : String(event.operatorId),
    safeDateTime(event.occurredAt),
  );
  if (result.changes && recalculate) recalculateMemberGrowth(db, event.userId, event.description);
  return Boolean(result.changes);
}

export function reconcileSourceExperience(db: AdminDb, input: {
  userId: number;
  sourceType: string;
  sourceId: string | number;
  targetPoints: number;
  positiveEventType: string;
  negativeEventType?: string;
  description: string;
  occurredAt?: string;
  operatorId?: string | number | null;
}) {
  ensureGrowthTables(db);
  const sourceId = String(input.sourceId);
  const current = Number(db.prepare(`
    SELECT COALESCE(SUM(points_delta),0) AS total FROM ExperienceLedger
    WHERE user_id=? AND source_type=? AND source_id=?
  `).get<{ total: number }>(input.userId, input.sourceType, sourceId)?.total || 0);
  const target = Math.max(0, Math.trunc(input.targetPoints));
  const delta = target - current;
  if (!delta) return false;
  const sequence = Number(db.prepare(`SELECT COUNT(*) AS count FROM ExperienceLedger WHERE user_id=? AND source_type=? AND source_id=?`).get<{ count: number }>(input.userId, input.sourceType, sourceId)?.count || 0) + 1;
  return insertExperienceEvent(db, {
    userId: input.userId,
    eventType: delta > 0 ? input.positiveEventType : input.negativeEventType || 'reversal',
    pointsDelta: delta,
    sourceType: input.sourceType,
    sourceId,
    idempotencyKey: `member:${input.userId}:${input.sourceType}:${sourceId}:net:${target}:v${sequence}`,
    description: input.description,
    operatorId: input.operatorId,
    occurredAt: input.occurredAt,
  }, false);
}

type EventPlayerGrowthRow = Record<string, any> & {
  id: number;
  member_id: number;
  competition_id: number;
  group_id: number;
  competition_name: string;
  group_name: string;
  rank_no?: number;
  ranking_status?: string;
  published_at?: string;
};

function eventPlayerGrowthRow(db: AdminDb, playerId: number): EventPlayerGrowthRow | null {
  if (!tableExists(db, 'event_players') || !tableExists(db, 'event_groups') || !tableExists(db, 'event_competitions')) return null;
  const rankingJoin = tableExists(db, 'event_rankings')
    ? `LEFT JOIN event_rankings r ON r.player_id=p.id AND r.group_id=p.group_id`
    : '';
  const rankingColumns = tableExists(db, 'event_rankings')
    ? `r.rank_no,r.status AS ranking_status,r.published_at`
    : `0 AS rank_no,'' AS ranking_status,'' AS published_at`;
  return db.prepare(`
    SELECT p.*,c.name AS competition_name,g.name AS group_name,${rankingColumns}
    FROM event_players p
    JOIN event_competitions c ON c.id=p.competition_id
    JOIN event_groups g ON g.id=p.group_id
    ${rankingJoin}
    WHERE p.id=?
  `).get<EventPlayerGrowthRow>(playerId) || null;
}

function validEventRegistration(row: EventPlayerGrowthRow | null) {
  if (!row?.member_id || !row.group_id) return false;
  const playerStatus = String(row.status || '').toLowerCase();
  return String(row.audit_status || '').toLowerCase() === 'approved'
    && !['cancelled', 'canceled', 'rejected', 'deleted'].includes(playerStatus);
}

function eventRankPoints(row: EventPlayerGrowthRow | null) {
  if (!validEventRegistration(row) || String(row?.ranking_status || '').toLowerCase() !== 'published') return 0;
  return EVENT_RANK_POINTS[Number(row?.rank_no || 0)] || 0;
}

function eventLabel(row: Pick<EventPlayerGrowthRow, 'competition_name' | 'group_name'>) {
  return [String(row.competition_name || '').trim(), String(row.group_name || '').trim()].filter(Boolean).join(' · ');
}

export function reconcileEventPlayerGrowth(db: AdminDb, playerId: number) {
  const row = eventPlayerGrowthRow(db, playerId);
  if (!row?.member_id || !memberExists(db, Number(row.member_id))) return false;
  const registrationPoints = validEventRegistration(row) ? EVENT_REGISTRATION_POINTS : 0;
  const rankPoints = eventRankPoints(row);
  const rankLabel = EVENT_RANK_LABELS[Number(row.rank_no || 0)] || `第 ${Number(row.rank_no || 0)} 名`;
  const registrationChanged = reconcileSourceExperience(db, {
    userId: Number(row.member_id), sourceType: 'event_registration', sourceId: row.id,
    targetPoints: registrationPoints, positiveEventType: 'event_registration', negativeEventType: 'reversal',
    description: registrationPoints ? `报名赛事组别：${eventLabel(row)}` : `赛事组别报名已撤销：${eventLabel(row)}`,
    occurredAt: row.registered_at || row.created_at,
  });
  const rankChanged = reconcileSourceExperience(db, {
    userId: Number(row.member_id), sourceType: 'event_placement', sourceId: row.id,
    targetPoints: rankPoints, positiveEventType: 'event_placement', negativeEventType: 'reversal',
    description: rankPoints ? `赛事成绩：${eventLabel(row)} · ${rankLabel}` : `赛事成绩奖励已撤销：${eventLabel(row)}`,
    occurredAt: row.published_at || row.updated_at,
  });
  if (registrationChanged || rankChanged) recalculateMemberGrowth(db, Number(row.member_id), '赛事经验变更');
  return registrationChanged || rankChanged;
}

export function reverseEventPlayerGrowth(db: AdminDb, input: {
  playerId: number;
  memberId: number;
  competitionName?: string;
  groupName?: string;
}) {
  if (!input.memberId || !memberExists(db, Number(input.memberId))) return false;
  const label = eventLabel({ competition_name: input.competitionName || '', group_name: input.groupName || '' });
  const registrationChanged = reconcileSourceExperience(db, {
    userId: Number(input.memberId), sourceType: 'event_registration', sourceId: input.playerId,
    targetPoints: 0, positiveEventType: 'event_registration', negativeEventType: 'reversal',
    description: `赛事组别报名已删除${label ? `：${label}` : ''}`,
  });
  const rankChanged = reconcileSourceExperience(db, {
    userId: Number(input.memberId), sourceType: 'event_placement', sourceId: input.playerId,
    targetPoints: 0, positiveEventType: 'event_placement', negativeEventType: 'reversal',
    description: `赛事成绩奖励已删除${label ? `：${label}` : ''}`,
  });
  if (registrationChanged || rankChanged) recalculateMemberGrowth(db, Number(input.memberId), '赛事报名删除');
  return registrationChanged || rankChanged;
}

export function reconcileEventGroupGrowth(db: AdminDb, groupId: number) {
  if (!tableExists(db, 'event_players')) return 0;
  let changed = 0;
  db.prepare('SELECT id FROM event_players WHERE group_id=? ORDER BY id').all<{ id: number }>(groupId).forEach(row => {
    if (reconcileEventPlayerGrowth(db, Number(row.id))) changed += 1;
  });
  return changed;
}

export function listMemberEventExperience(db: AdminDb, memberId: number) {
  if (!tableExists(db, 'event_players') || !tableExists(db, 'event_groups') || !tableExists(db, 'event_competitions')) return [];
  const rankingJoin = tableExists(db, 'event_rankings')
    ? `LEFT JOIN event_rankings r ON r.player_id=p.id AND r.group_id=p.group_id`
    : '';
  const rankingColumns = tableExists(db, 'event_rankings')
    ? `r.rank_no,r.status AS ranking_status,r.published_at`
    : `0 AS rank_no,'' AS ranking_status,'' AS published_at`;
  const rows = db.prepare(`
    SELECT p.*,c.name AS competition_name,g.name AS group_name,${rankingColumns}
    FROM event_players p
    JOIN event_competitions c ON c.id=p.competition_id
    JOIN event_groups g ON g.id=p.group_id
    ${rankingJoin}
    WHERE p.member_id=?
      AND lower(COALESCE(p.status,'')) NOT IN ('cancelled','canceled','rejected','deleted')
      AND lower(COALESCE(p.audit_status,''))!='rejected'
    ORDER BY datetime(COALESCE(NULLIF(c.start_date,''),p.registered_at)) DESC,p.id DESC
  `).all<EventPlayerGrowthRow>(memberId);
  return rows.map(row => {
    const registrationPoints = validEventRegistration(row) ? EVENT_REGISTRATION_POINTS : 0;
    const resultPoints = eventRankPoints(row);
    const rankNo = String(row.ranking_status || '').toLowerCase() === 'published' ? Number(row.rank_no || 0) : 0;
    return {
      player_id: Number(row.id),
      competition_id: Number(row.competition_id),
      competition_name: row.competition_name || '',
      group_id: Number(row.group_id),
      group_name: row.group_name || '',
      audit_status: row.audit_status || 'pending',
      registration_points: registrationPoints,
      rank_no: rankNo,
      result_label: rankNo ? (EVENT_RANK_LABELS[rankNo] || `第 ${rankNo} 名`) : '待公布',
      result_points: resultPoints,
      total_points: registrationPoints + resultPoints,
      registered_at: row.registered_at || row.created_at || '',
      published_at: row.published_at || '',
    };
  });
}

function isPaidStatus(value: unknown) {
  return ['paid', 'completed', 'success', 'settled'].includes(String(value || '').toLowerCase());
}

export function reconcileOfflinePayment(db: AdminDb, paymentId: number) {
  const payment = db.prepare('SELECT * FROM Payment WHERE id=?').get<Record<string, any>>(paymentId);
  if (!payment) return false;
  const target = isPaidStatus(payment.paymentStatus) && Number(payment.amount) > 0 ? Math.floor(Number(payment.amount)) : 0;
  const changed = reconcileSourceExperience(db, {
    userId: Number(payment.memberId), sourceType: 'offline_payment', sourceId: payment.id,
    targetPoints: target, positiveEventType: 'offline_purchase', negativeEventType: 'refund',
    description: target ? `线下课程实付 ${payment.amount} 元` : '线下课程付款撤销或退款',
    occurredAt: payment.date || payment.created_at,
  });
  if (changed) recalculateMemberGrowth(db, Number(payment.memberId), '线下课程付款变更');
  return changed;
}

export function reconcileCourseAuthorization(db: AdminDb, authorizationId: number) {
  ensureGrowthTables(db);
  const authorization = db.prepare(`
    SELECT ca.*,cs.name AS series_name,cs.price,cs.promo_price,
           (ca.status='active' AND (ca.expire_at IS NULL OR ca.expire_at='' OR datetime(ca.expire_at)>=datetime('now','localtime'))) AS is_valid,
           COALESCE(fi.amount,CASE WHEN cs.promo_price>0 THEN cs.promo_price ELSE cs.price END,0) AS snapshot_amount
    FROM CourseAuthorization ca
    JOIN CourseSeries cs ON cs.id=ca.series_id
    LEFT JOIN FinanceIncome fi ON fi.incomeNo=('AUTH-'||ca.id)
    WHERE ca.id=?
    ORDER BY fi.id DESC LIMIT 1
  `).get<Record<string, any>>(authorizationId);
  if (!authorization?.member_id) return false;
  const validAuthorization = Boolean(authorization.is_valid);
  const target = validAuthorization ? Math.max(0, Math.floor(Number(authorization.snapshot_amount) || 0)) : 0;
  const changed = reconcileSourceExperience(db, {
    userId: Number(authorization.member_id), sourceType: 'course_authorization', sourceId: authorization.id,
    targetPoints: target, positiveEventType: 'online_purchase', negativeEventType: 'reversal',
    description: target
      ? `线上课程授权消费：${authorization.series_name || authorization.series_id}，计价 ${authorization.snapshot_amount} 元`
      : `撤销线上课程授权：${authorization.series_name || authorization.series_id}`,
    occurredAt: authorization.granted_at || authorization.created_at,
  });
  if (changed) recalculateMemberGrowth(db, Number(authorization.member_id), '线上课程授权消费变更');
  return changed;
}

export function reconcileMemberAuthorizations(db: AdminDb, memberId: number) {
  if (!tableExists(db, 'CourseAuthorization')) return 0;
  let changed = 0;
  db.prepare('SELECT id FROM CourseAuthorization WHERE member_id=? ORDER BY id').all<{ id: number }>(memberId).forEach(row => {
    if (reconcileCourseAuthorization(db, Number(row.id))) changed += 1;
  });
  recalculateMemberGrowth(db, memberId, '线上课程授权消费重算');
  return changed;
}

export function reverseDeletedSource(db: AdminDb, userId: number, sourceType: string, sourceId: string | number, description: string) {
  const changed = reconcileSourceExperience(db, {
    userId, sourceType, sourceId, targetPoints: 0, positiveEventType: 'reversal',
    negativeEventType: sourceType.includes('payment') ? 'refund' : 'reversal', description,
  });
  if (changed) recalculateMemberGrowth(db, userId, description);
  return changed;
}

export function reconcileOfflineCheckin(db: AdminDb, consumeRecordId: number) {
  const row = db.prepare('SELECT * FROM ConsumeRecord WHERE id=?').get<Record<string, any>>(consumeRecordId);
  if (!row) return false;
  const target = Math.max(0, Math.floor(Number(row.count) || 0)) * 10;
  const changed = reconcileSourceExperience(db, {
    userId: Number(row.memberId), sourceType: 'consume_record', sourceId: row.id,
    targetPoints: target, positiveEventType: 'offline_checkin', negativeEventType: 'reversal',
    description: `线下课程核销 ${row.count} 课时`, occurredAt: row.consumeDate || row.created_at,
  });
  if (changed) {
    syncStreakRewards(db, Number(row.memberId));
    recalculateMemberGrowth(db, Number(row.memberId), '线下课时核销变更');
  }
  return changed;
}

export function canMemberStudyVideo(db: AdminDb, memberId: number, videoId: number) {
  const video = db.prepare(`
    SELECT cv.id, cv.is_free, oc.series_id, cs.is_free AS series_free
    FROM CourseVideo cv JOIN OnlineCourse oc ON oc.id=cv.course_id
    JOIN CourseSeries cs ON cs.id=oc.series_id
    WHERE cv.id=? AND cv.status='published' AND oc.status='published' AND cs.status='published'
  `).get<Record<string, any>>(videoId);
  if (!video) return false;
  if (Number(video.is_free) || Number(video.series_free)) return true;
  return Boolean(db.prepare(`
    SELECT id FROM CourseAuthorization
    WHERE member_id=? AND series_id=? AND status='active'
      AND (expire_at IS NULL OR expire_at='' OR datetime(expire_at)>=datetime('now','localtime'))
    LIMIT 1
  `).get(memberId, video.series_id));
}

export function recordOnlineLessonCompletion(db: AdminDb, memberId: number, videoId: number) {
  const progress = db.prepare(`SELECT * FROM VideoProgress WHERE member_id=? AND video_id=?`).get<Record<string, any>>(memberId, videoId);
  if (!progress || !Number(progress.completed)) return false;
  const changed = reconcileSourceExperience(db, {
    userId: memberId, sourceType: 'video_progress', sourceId: videoId, targetPoints: 1,
    positiveEventType: 'online_lesson', description: '首次完成线上有效课节',
    occurredAt: progress.last_play_at || progress.created_at,
  });
  const course = db.prepare('SELECT course_id FROM CourseVideo WHERE id=?').get<{ course_id: number }>(videoId);
  if (course?.course_id) awardCourseCompletionIfEligible(db, memberId, Number(course.course_id));
  syncStreakRewards(db, memberId);
  recalculateMemberGrowth(db, memberId, '线上课节完成');
  return changed;
}

export function awardCourseCompletionIfEligible(db: AdminDb, memberId: number, courseId: number) {
  const counts = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN EXISTS(
        SELECT 1 FROM VideoProgress vp WHERE vp.member_id=? AND vp.video_id=cv.id AND vp.completed=1
      ) THEN 1 ELSE 0 END) AS completed
    FROM CourseVideo cv WHERE cv.course_id=? AND cv.status='published'
  `).get<{ total: number; completed: number }>(memberId, courseId);
  if (!counts?.total || Number(counts.completed || 0) / Number(counts.total) < 0.9) return false;
  return reconcileSourceExperience(db, {
    userId: memberId, sourceType: 'online_course', sourceId: courseId, targetPoints: 2,
    positiveEventType: 'course_completed', description: '首次完成整门线上课程',
  });
}

export function syncStreakRewards(db: AdminDb, memberId: number) {
  ensureGrowthTables(db);
  const { segments } = streakStats(learningDates(db, memberId));
  let changed = false;
  segments.forEach(segment => {
    if (segment.length >= 7) {
      changed = insertExperienceEvent(db, {
        userId: memberId, eventType: 'streak_7', pointsDelta: 10,
        sourceType: 'learning_streak', sourceId: `7:${segment.start}`,
        idempotencyKey: `streak_7:${memberId}:${segment.start}`,
        description: '连续有效学习 7 天奖励', occurredAt: segment.end,
      }, false) || changed;
    }
    if (segment.length >= 30) {
      changed = insertExperienceEvent(db, {
        userId: memberId, eventType: 'streak_30', pointsDelta: 50,
        sourceType: 'learning_streak', sourceId: `30:${segment.start}`,
        idempotencyKey: `streak_30:${memberId}:${segment.start}`,
        description: '连续有效学习 30 天奖励', occurredAt: segment.end,
      }, false) || changed;
    }
  });
  return changed;
}

export function getGrowthSummary(db: AdminDb, memberId: number): Record<string, any> | null {
  ensureGrowthTables(db);
  let row = db.prepare('SELECT * FROM StudentGrowthSummary WHERE user_id=?').get<Record<string, any>>(memberId);
  if (!row && memberExists(db, memberId)) row = recalculateMemberGrowth(db, memberId);
  if (!row) return null;
  const level: (typeof GROWTH_LEVELS)[number] = GROWTH_LEVELS.find(item => item.no === Number(row.level_no)) || GROWTH_LEVELS[0];
  const nextLevel: (typeof GROWTH_LEVELS)[number] | null = GROWTH_LEVELS.find(item => item.no === level.no + 1) || null;
  const experience: number = Number(row.experience_total || 0);
  const progress = nextLevel
    ? Math.max(0, Math.min(100, Math.round(((experience - level.min) / (nextLevel.min - level.min)) * 100)))
    : 100;
  return {
    ...row,
    level_display: formatLevel(level.no, level.name),
    next_level_name: nextLevel?.name || '',
    next_level_threshold: nextLevel?.min || null,
    points_to_next_level: nextLevel ? Math.max(0, nextLevel.min - experience) : 0,
    level_progress_percent: progress,
    is_max_level: !nextLevel,
    academy_age: formatAcademyAge(row.academy_started_at),
  };
}

export function listGrowthLedger(db: AdminDb, memberId: number, limit = 100, offset = 0) {
  ensureGrowthTables(db);
  return db.prepare(`SELECT * FROM ExperienceLedger WHERE user_id=? ORDER BY datetime(occurred_at) DESC,id DESC LIMIT ? OFFSET ?`)
    .all(memberId, Math.min(Math.max(limit, 1), 500), Math.max(offset, 0));
}

export function adminAdjustExperience(db: AdminDb, input: {
  memberId: number; points: number; reason: string; operatorId: string | number;
}) {
  const reason = String(input.reason || '').trim();
  const points = Math.trunc(Number(input.points) || 0);
  if (!reason) throw new Error('人工调整必须填写原因');
  if (!points) throw new Error('调整经验不能为 0');
  const key = `admin_adjustment:${input.memberId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  insertExperienceEvent(db, {
    userId: input.memberId, eventType: 'admin_adjustment', pointsDelta: points,
    sourceType: 'admin_adjustment', sourceId: key, idempotencyKey: key,
    description: reason, operatorId: input.operatorId,
  });
  return getGrowthSummary(db, input.memberId);
}

export function adminSetAcademyStart(db: AdminDb, input: {
  memberId: number; startedAt: string; source: 'admin' | 'imported'; evidence: string;
  reason: string; operatorId: string | number;
}) {
  ensureGrowthTables(db);
  const startedAt = dateKey(input.startedAt);
  if (!startedAt) throw new Error('请填写有效的舞龄起始日期');
  if (!String(input.evidence || '').trim() || !String(input.reason || '').trim()) throw new Error('补录依据和操作原因均不能为空');
  const current = getGrowthSummary(db, input.memberId);
  db.prepare(`
    INSERT INTO StudentGrowthSummary (user_id,academy_override_at,academy_override_source)
    VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET academy_override_at=excluded.academy_override_at,
      academy_override_source=excluded.academy_override_source,updated_at=CURRENT_TIMESTAMP
  `).run(input.memberId, startedAt, input.source);
  db.prepare(`
    INSERT INTO AcademyStartAudit (user_id,old_started_at,new_started_at,source,evidence,reason,operator_id)
    VALUES (?,?,?,?,?,?,?)
  `).run(input.memberId, current?.academy_started_at || null, startedAt, input.source, input.evidence.trim(), input.reason.trim(), String(input.operatorId));
  return recalculateMemberGrowth(db, input.memberId, '管理员补录学院舞龄');
}

export function backfillMemberGrowth(db: AdminDb, memberId: number, apply = false) {
  ensureGrowthTables(db);
  const planned: Array<Record<string, any>> = [];
  if (tableExists(db, 'Payment')) {
    db.prepare('SELECT * FROM Payment WHERE memberId=?').all<Record<string, any>>(memberId).forEach(row => {
      const points = isPaidStatus(row.paymentStatus) && Number(row.amount) > 0 ? Math.floor(Number(row.amount)) : 0;
      if (points > 0) planned.push({ kind: 'offline_payment', id: row.id, points });
      if (apply) reconcileOfflinePayment(db, Number(row.id));
    });
  }
  if (tableExists(db, 'CourseAuthorization')) {
    db.prepare(`
      SELECT ca.id,ca.status,ca.expire_at,
             (ca.status='active' AND (ca.expire_at IS NULL OR ca.expire_at='' OR datetime(ca.expire_at)>=datetime('now','localtime'))) AS is_valid,
             COALESCE(fi.amount,CASE WHEN cs.promo_price>0 THEN cs.promo_price ELSE cs.price END,0) AS amount
      FROM CourseAuthorization ca JOIN CourseSeries cs ON cs.id=ca.series_id
      LEFT JOIN FinanceIncome fi ON fi.incomeNo=('AUTH-'||ca.id)
      WHERE ca.member_id=? GROUP BY ca.id
    `).all<Record<string, any>>(memberId).forEach(row => {
      const validAuthorization = Boolean(row.is_valid);
      const points = validAuthorization ? Math.max(0, Math.floor(Number(row.amount) || 0)) : 0;
      if (points > 0) planned.push({ kind: 'course_authorization', id: row.id, points });
      if (apply) reconcileCourseAuthorization(db, Number(row.id));
    });
  }
  if (tableExists(db, 'ConsumeRecord')) {
    db.prepare('SELECT * FROM ConsumeRecord WHERE memberId=? AND count>0').all<Record<string, any>>(memberId).forEach(row => {
      planned.push({ kind: 'offline_checkin', id: row.id, points: Number(row.count) * 10 });
      if (apply) reconcileOfflineCheckin(db, Number(row.id));
    });
  }
  if (tableExists(db, 'VideoProgress')) {
    db.prepare('SELECT * FROM VideoProgress WHERE member_id=? AND completed=1').all<Record<string, any>>(memberId).forEach(row => {
      planned.push({ kind: 'online_lesson', id: row.video_id, points: 1 });
      if (apply) recordOnlineLessonCompletion(db, memberId, Number(row.video_id));
    });
  }
  if (tableExists(db, 'event_players')) {
    db.prepare('SELECT id FROM event_players WHERE member_id=? ORDER BY id').all<{ id: number }>(memberId).forEach(player => {
      const row = eventPlayerGrowthRow(db, Number(player.id));
      if (validEventRegistration(row)) planned.push({ kind: 'event_registration', id: player.id, points: EVENT_REGISTRATION_POINTS });
      const rankPoints = eventRankPoints(row);
      if (rankPoints) planned.push({ kind: 'event_placement', id: player.id, points: rankPoints });
      if (apply) reconcileEventPlayerGrowth(db, Number(player.id));
    });
  }
  if (apply) {
    syncStreakRewards(db, memberId);
    recalculateMemberGrowth(db, memberId, '历史数据回算');
  }
  return { memberId, plannedEvents: planned.length, plannedPoints: planned.reduce((sum, row) => sum + Number(row.points || 0), 0) };
}

export function backfillAllGrowth(db: AdminDb, apply = false, operatorId: string | number | null = null) {
  ensureGrowthTables(db);
  const members = db.prepare("SELECT id FROM Member WHERE COALESCE(status,'active')!='deleted' ORDER BY id").all<{ id: number }>();
  const before = Number(db.prepare('SELECT COUNT(*) AS count FROM ExperienceLedger').get<{ count: number }>()?.count || 0);
  const errors: Array<{ memberId: number; error: string }> = [];
  let plannedEvents = 0;
  let plannedPoints = 0;
  members.forEach(member => {
    try {
      const result = backfillMemberGrowth(db, Number(member.id), apply);
      plannedEvents += result.plannedEvents;
      plannedPoints += result.plannedPoints;
    } catch (error: any) {
      errors.push({ memberId: Number(member.id), error: String(error?.message || error) });
    }
  });
  const after = Number(db.prepare('SELECT COUNT(*) AS count FROM ExperienceLedger').get<{ count: number }>()?.count || 0);
  const report = { mode: apply ? 'apply' : 'preview', memberCount: members.length, plannedEvents, plannedPoints, insertedEvents: after - before, errors };
  if (apply) db.prepare(`INSERT INTO GrowthRecalculationRun (mode,member_count,event_count,error_count,detail,operator_id) VALUES (?,?,?,?,?,?)`)
    .run('historical_backfill', members.length, after - before, errors.length, JSON.stringify(report), operatorId === null ? null : String(operatorId));
  return report;
}
