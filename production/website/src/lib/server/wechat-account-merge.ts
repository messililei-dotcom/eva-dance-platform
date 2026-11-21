import { createHash, randomBytes } from 'node:crypto';
import { cleanText, memberAccountAvailable } from '@/app/api/mini/_helpers';
import type { AdminDb } from './admin-db';
import { findPhoneMembers } from './event-phone-member';
import { resolveWechatMember, type WechatIdentityInput, WechatIdentityConflictError } from './wechat-identity';
import type { WechatOAuthMode } from './wechat-oauth-state';

type MergeMember = Record<string, unknown> & { id: number };
type PendingMerge = {
  sourceId: number;
  phone: string;
  identity: WechatIdentityInput;
  mode: WechatOAuthMode;
  next: string;
};

export function verifiedWechatMergePhone(db: AdminDb, targetId: number, sourceId: number, identity: WechatIdentityInput) {
  const lookup = db.prepare('SELECT * FROM Member WHERE id=?');
  const target = lookup.get<MergeMember>(targetId);
  const source = lookup.get<MergeMember>(sourceId);
  const available = (row: MergeMember) => row.status === 'active' && !Number(row.merged_to_member_id)
    && !/member_id\s*=\s*\d+|\[merged_into:\d+\]/i.test(cleanText(row.remark))
    && memberAccountAvailable(db, row.id);
  const phone = cleanText(target?.phone);
  if (!target || !source || targetId === sourceId || !available(target) || !available(source)
    || !phone || cleanText(source.phone) || cleanText(source.phone_national_number)
    || cleanText(target.wx_openid) || cleanText(target.wx_unionid)
    || db.prepare('SELECT 1 FROM WechatIdentity WHERE member_id=? LIMIT 1').get(targetId)) {
    throw new WechatIdentityConflictError('两个账号的登录方式有冲突，请联系客服核对');
  }
  const owners = findPhoneMembers(db, phone) as MergeMember[];
  const { candidateIds } = resolveWechatMember(db, identity);
  const duplicateUnion = identity.unionid && db.prepare(`SELECT 1 FROM Member m
    LEFT JOIN WechatIdentity wi ON wi.member_id=m.id
    WHERE m.id<>? AND m.status='active' AND (m.wx_unionid=? OR wi.unionid=?) LIMIT 1`)
    .get(sourceId, identity.unionid, identity.unionid);
  if (owners.length !== 1 || owners[0].id !== targetId || duplicateUnion
    || candidateIds.length !== 1 || candidateIds[0] !== sourceId) {
    throw new WechatIdentityConflictError('账号归属存在冲突，请联系客服核对');
  }
  return phone;
}

function ensureChallenges(db: AdminDb) {
  db.exec(`CREATE TABLE IF NOT EXISTS WechatMergeChallenge (
    token_hash TEXT PRIMARY KEY, target_id INTEGER NOT NULL, session_id TEXT NOT NULL,
    expires_at_ms INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(target_id, session_id)
  )`);
}

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createWechatMergeChallenge(db: AdminDb, targetId: number, sessionId: string, data: PendingMerge) {
  ensureChallenges(db);
  const now = Date.now();
  const token = randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM WechatMergeChallenge WHERE expires_at_ms<=? OR (target_id=? AND session_id=?)')
    .run(now, targetId, sessionId);
  db.prepare('INSERT INTO WechatMergeChallenge VALUES (?,?,?,?,?)')
    .run(hash(token), targetId, sessionId, now + 10 * 60 * 1000, JSON.stringify(data));
  return token;
}

// Called within the same write transaction as the member and ownership changes.
export function takeWechatMergeChallenge(db: AdminDb, targetId: number, sessionId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  ensureChallenges(db);
  const digest = hash(token);
  const row = db.prepare(`SELECT payload FROM WechatMergeChallenge
    WHERE token_hash=? AND target_id=? AND session_id=? AND expires_at_ms>?`)
    .get<{ payload: string }>(digest, targetId, sessionId, Date.now());
  if (!row) return null;
  db.prepare('DELETE FROM WechatMergeChallenge WHERE token_hash=?').run(digest);
  return JSON.parse(row.payload) as PendingMerge;
}
