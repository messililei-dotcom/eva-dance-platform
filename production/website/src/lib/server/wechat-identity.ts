import type { AdminDb } from '@/lib/server/admin-db';

export type WechatIdentityChannel =
  | 'mini_program'
  | 'official_account'
  | 'website'
  | 'store'
  | 'legacy';

export type WechatIdentityInput = {
  appId: string;
  channel: WechatIdentityChannel;
  openid: string;
  unionid?: string;
  nickname?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
};

type MemberRow = Record<string, any> & { id: unknown; phone?: unknown };

function text(value: unknown) {
  return String(value ?? '').normalize('NFC').trim();
}

function memberById(db: AdminDb, memberId: unknown) {
  const id = Number(memberId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.prepare('SELECT * FROM Member WHERE id=? LIMIT 1').get<MemberRow>(id) || null;
}

export class WechatIdentityConflictError extends Error {
  constructor(message = '该微信身份已绑定其他会员，请联系客服核对') {
    super(message);
    this.name = 'WechatIdentityConflictError';
  }
}

export function ensureWechatIdentityTables(db: AdminDb) {
  db.prepare(`CREATE TABLE IF NOT EXISTS WechatIdentity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    channel TEXT NOT NULL,
    app_id TEXT NOT NULL,
    openid TEXT NOT NULL,
    unionid TEXT NOT NULL DEFAULT '',
    nickname TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '',
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS WechatIdentityAudit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL DEFAULT 0,
    related_member_id INTEGER NOT NULL DEFAULT 0,
    action TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT '',
    app_id TEXT NOT NULL DEFAULT '',
    openid_suffix TEXT NOT NULL DEFAULT '',
    unionid_suffix TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_wechat_identity_app_openid ON WechatIdentity(app_id, openid)');
  db.exec("CREATE INDEX IF NOT EXISTS idx_wechat_identity_unionid ON WechatIdentity(unionid) WHERE unionid<>''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_wechat_identity_member ON WechatIdentity(member_id, channel, app_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_wechat_identity_audit_member ON WechatIdentityAudit(member_id, created_at)');
}

function suffix(value: string) {
  return value ? value.slice(-8) : '';
}

export function auditWechatIdentity(
  db: AdminDb,
  action: string,
  memberId: unknown,
  input: Partial<WechatIdentityInput> = {},
  relatedMemberId: unknown = 0,
  detail = '',
) {
  ensureWechatIdentityTables(db);
  db.prepare(
    `INSERT INTO WechatIdentityAudit (
       member_id, related_member_id, action, channel, app_id,
       openid_suffix, unionid_suffix, detail
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(memberId) || 0,
    Number(relatedMemberId) || 0,
    text(action),
    text(input.channel),
    text(input.appId),
    suffix(text(input.openid)),
    suffix(text(input.unionid)),
    text(detail).slice(0, 500),
  );
}

export function resolveWechatMember(db: AdminDb, inputValue: WechatIdentityInput) {
  ensureWechatIdentityTables(db);
  const input = {
    ...inputValue,
    appId: text(inputValue.appId),
    openid: text(inputValue.openid),
    unionid: text(inputValue.unionid),
  };
  if (!input.appId || !input.openid) throw new Error('微信身份参数不完整');

  const exact = db.prepare(
    `SELECT m.*
     FROM WechatIdentity wi
     JOIN Member m ON m.id=wi.member_id
     WHERE wi.app_id=? AND wi.openid=?
     LIMIT 1`
  ).get<MemberRow>(input.appId, input.openid);
  if (exact) return { member: exact, candidateIds: [Number(exact.id)], matchedBy: 'identity' as const };

  const candidates = new Map<number, MemberRow>();
  const legacyOpenid = db.prepare(
    `SELECT * FROM Member
     WHERE wx_openid=? AND status<>'inactive'
     ORDER BY CASE WHEN COALESCE(phone,'')<>'' THEN 0 ELSE 1 END, id
     LIMIT 1`
  ).get<MemberRow>(input.openid);
  if (legacyOpenid) candidates.set(Number(legacyOpenid.id), legacyOpenid);

  if (input.unionid) {
    const rows = db.prepare(
      `SELECT DISTINCT m.*
       FROM Member m
       LEFT JOIN WechatIdentity wi ON wi.member_id=m.id
       WHERE m.status<>'inactive'
         AND (wi.unionid=? OR m.wx_unionid=?)
       ORDER BY CASE WHEN COALESCE(m.phone,'')<>'' THEN 0 ELSE 1 END, m.id`
    ).all<MemberRow>(input.unionid, input.unionid);
    for (const row of rows) candidates.set(Number(row.id), row);
  }

  const rows = [...candidates.values()];
  return {
    member: rows[0] || null,
    candidateIds: rows.map(row => Number(row.id)),
    matchedBy: legacyOpenid ? 'legacy_openid' as const : rows.length ? 'unionid' as const : 'none' as const,
  };
}

export function bindWechatIdentity(db: AdminDb, memberIdValue: unknown, inputValue: WechatIdentityInput) {
  ensureWechatIdentityTables(db);
  const memberId = Number(memberIdValue);
  const member = memberById(db, memberId);
  if (!member) throw new Error('待绑定的会员不存在');

  const input = {
    ...inputValue,
    appId: text(inputValue.appId),
    channel: inputValue.channel,
    openid: text(inputValue.openid),
    unionid: text(inputValue.unionid),
    nickname: text(inputValue.nickname),
    avatarUrl: text(inputValue.avatarUrl),
  };
  if (!input.appId || !input.openid) throw new Error('微信身份参数不完整');

  const existing = db.prepare(
    'SELECT * FROM WechatIdentity WHERE app_id=? AND openid=? LIMIT 1'
  ).get<Record<string, any>>(input.appId, input.openid);
  if (existing && Number(existing.member_id) !== memberId) throw new WechatIdentityConflictError();
  if (existing && input.unionid && text(existing.unionid) && text(existing.unionid) !== input.unionid) {
    throw new WechatIdentityConflictError('微信开放平台身份发生变化，请联系客服核对');
  }

  const conflictingUnion = input.unionid
    ? db.prepare(
      `SELECT unionid FROM WechatIdentity
       WHERE member_id=? AND unionid<>'' AND unionid<>?
       LIMIT 1`
    ).get<{ unionid?: string }>(memberId, input.unionid)
    : null;
  const legacyUnion = text(member.wx_unionid);
  if (conflictingUnion || (input.unionid && legacyUnion && legacyUnion !== input.unionid)) {
    throw new WechatIdentityConflictError('当前会员已绑定另一微信身份，请联系客服核对');
  }

  const metadataJson = inputValue.metadata ? JSON.stringify(inputValue.metadata).slice(0, 4000) : '';
  db.prepare(
    `INSERT INTO WechatIdentity (
       member_id, channel, app_id, openid, unionid, nickname, avatar_url,
       metadata_json, first_seen_at, last_seen_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'), datetime('now','localtime'), datetime('now','localtime'))
     ON CONFLICT(app_id, openid) DO UPDATE SET
       member_id=excluded.member_id,
       channel=excluded.channel,
       unionid=CASE WHEN excluded.unionid<>'' THEN excluded.unionid ELSE WechatIdentity.unionid END,
       nickname=CASE WHEN excluded.nickname<>'' THEN excluded.nickname ELSE WechatIdentity.nickname END,
       avatar_url=CASE WHEN excluded.avatar_url<>'' THEN excluded.avatar_url ELSE WechatIdentity.avatar_url END,
       metadata_json=CASE WHEN excluded.metadata_json<>'' THEN excluded.metadata_json ELSE WechatIdentity.metadata_json END,
       last_seen_at=datetime('now','localtime'),
       updated_at=datetime('now','localtime')`
  ).run(
    memberId,
    input.channel,
    input.appId,
    input.openid,
    input.unionid,
    input.nickname,
    input.avatarUrl,
    metadataJson,
  );

  const shouldSetLegacyOpenid = !text(member.wx_openid) || input.channel === 'mini_program';
  db.prepare(
    `UPDATE Member
     SET wx_openid=CASE WHEN ?=1 THEN ? ELSE wx_openid END,
         wx_unionid=CASE WHEN ?<>'' THEN ? ELSE wx_unionid END,
         wx_nickname=CASE WHEN ?<>'' THEN ? ELSE wx_nickname END,
         wx_name=CASE WHEN ?<>'' THEN ? ELSE wx_name END,
         avatar=CASE WHEN ?<>'' THEN ? ELSE avatar END,
         wx_avatar_url=CASE WHEN ?<>'' THEN ? ELSE wx_avatar_url END,
         wx_profile_synced_at=datetime('now','localtime')
     WHERE id=?`
  ).run(
    shouldSetLegacyOpenid ? 1 : 0,
    input.openid,
    input.unionid,
    input.unionid,
    input.nickname,
    input.nickname,
    input.nickname,
    input.nickname,
    input.avatarUrl,
    input.avatarUrl,
    input.avatarUrl,
    input.avatarUrl,
    memberId,
  );
  auditWechatIdentity(db, existing ? 'refreshed' : 'bound', memberId, input);
  return memberById(db, memberId) as MemberRow;
}

export function moveWechatIdentities(db: AdminDb, targetIdValue: unknown, sourceIdValue: unknown) {
  ensureWechatIdentityTables(db);
  const targetId = Number(targetIdValue);
  const sourceId = Number(sourceIdValue);
  if (!targetId || !sourceId || targetId === sourceId) return;

  const targetUnions = db.prepare(
    "SELECT DISTINCT unionid FROM WechatIdentity WHERE member_id=? AND unionid<>''"
  ).all<{ unionid: string }>(targetId).map(row => text(row.unionid));
  const sourceUnions = db.prepare(
    "SELECT DISTINCT unionid FROM WechatIdentity WHERE member_id=? AND unionid<>''"
  ).all<{ unionid: string }>(sourceId).map(row => text(row.unionid));
  if (targetUnions.length && sourceUnions.some(value => !targetUnions.includes(value))) {
    throw new WechatIdentityConflictError('两个会员绑定了不同微信身份，已停止自动合并');
  }

  db.prepare('UPDATE WechatIdentity SET member_id=?, updated_at=datetime(\'now\',\'localtime\') WHERE member_id=?')
    .run(targetId, sourceId);
  auditWechatIdentity(db, 'member_merged', targetId, {}, sourceId);
}
