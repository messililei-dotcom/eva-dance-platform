import crypto from 'crypto';
import type { AdminDb } from '@/lib/server/admin-db';
import type { MemberDeviceSession } from '@/app/api/mini/_helpers';

const HANDOFF_TTL_MS = 10 * 60 * 1000;
const HANDOFF_RETENTION_MS = 24 * 60 * 60 * 1000;

type HandoffRow = {
  id: string;
  poll_hash: string;
  status: string;
  session_id: string;
  session_token: string;
  device_secret: string;
  session_expires_at_ms: number;
  member_id: number;
  member_json: string;
  error_message: string;
  expires_at_ms: number;
  consumed_at_ms: number;
};

function tokenHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cleanup(db: AdminDb, now: number) {
  db.prepare(
    `DELETE FROM WechatLoginHandoff
     WHERE expires_at_ms<? OR consumed_at_ms BETWEEN 1 AND ?`
  ).run(now - HANDOFF_RETENTION_MS, now - HANDOFF_RETENTION_MS);
}

export function createWechatLoginHandoff(db: AdminDb) {
  const now = Date.now();
  cleanup(db, now);
  const id = crypto.randomUUID();
  const pollToken = crypto.randomBytes(32).toString('base64url');
  db.prepare(
    `INSERT INTO WechatLoginHandoff (
       id, poll_hash, status, created_at_ms, expires_at_ms
     ) VALUES (?, ?, 'pending', ?, ?)`
  ).run(id, tokenHash(pollToken), now, now + HANDOFF_TTL_MS);
  return { id, pollToken, expiresAt: now + HANDOFF_TTL_MS };
}

export function completeWechatLoginHandoff(
  db: AdminDb,
  id: string,
  session: MemberDeviceSession,
  member: Record<string, unknown>,
) {
  if (!id) return false;
  const now = Date.now();
  const result = db.prepare(
    `UPDATE WechatLoginHandoff
     SET status='completed', session_id=?, session_token=?, device_secret=?,
         session_expires_at_ms=?, member_id=?, member_json=?, completed_at_ms=?
     WHERE id=? AND status='pending' AND consumed_at_ms=0 AND expires_at_ms>?`
  ).run(
    session.id,
    session.token,
    session.deviceSecret,
    session.expiresAt,
    session.memberId,
    JSON.stringify(member),
    now,
    id,
    now,
  );
  return Number(result.changes || 0) === 1;
}

export function failWechatLoginHandoff(db: AdminDb, id: string, message: string) {
  if (!id) return;
  db.prepare(
    `UPDATE WechatLoginHandoff
     SET status='failed', error_message=?, completed_at_ms=?
     WHERE id=? AND status='pending' AND consumed_at_ms=0`
  ).run(String(message || '微信登录失败').slice(0, 200), Date.now(), id);
}

export type WechatLoginHandoffResult =
  | { status: 'pending' }
  | { status: 'expired' | 'invalid' | 'consumed' }
  | { status: 'failed'; message: string }
  | {
      status: 'completed';
      member: Record<string, unknown>;
      session: MemberDeviceSession;
    };

export function consumeWechatLoginHandoff(
  db: AdminDb,
  id: string,
  pollToken: string,
): WechatLoginHandoffResult {
  const now = Date.now();
  cleanup(db, now);
  const row = db.prepare(
    `SELECT id, poll_hash, status, session_id, session_token, device_secret,
            session_expires_at_ms, member_id, member_json, error_message,
            expires_at_ms, consumed_at_ms
     FROM WechatLoginHandoff WHERE id=? LIMIT 1`
  ).get<HandoffRow>(id);
  if (!row || !pollToken || !safeEqual(row.poll_hash, tokenHash(pollToken))) return { status: 'invalid' };
  if (Number(row.expires_at_ms) <= now) return { status: 'expired' };
  if (Number(row.consumed_at_ms) > 0) return { status: 'consumed' };
  if (row.status === 'failed') return { status: 'failed', message: row.error_message || '微信登录失败' };
  if (row.status !== 'completed') return { status: 'pending' };

  const claimed = db.prepare(
    `UPDATE WechatLoginHandoff SET status='consumed', consumed_at_ms=?
     WHERE id=? AND status='completed' AND consumed_at_ms=0`
  ).run(now, id);
  if (Number(claimed.changes || 0) !== 1) return { status: 'consumed' };

  let member: Record<string, unknown> = { id: row.member_id };
  try {
    const parsed = JSON.parse(row.member_json || '{}');
    if (parsed && typeof parsed === 'object') member = parsed;
  } catch {}

  return {
    status: 'completed',
    member,
    session: {
      id: row.session_id,
      memberId: Number(row.member_id),
      token: row.session_token,
      deviceSecret: row.device_secret,
      expiresAt: Number(row.session_expires_at_ms),
    },
  };
}
