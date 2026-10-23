import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeWechatLoginHandoff,
  consumeWechatLoginHandoff,
  createWechatLoginHandoff,
} from '../src/lib/server/wechat-login-handoff.ts';
import { getBetterSqlite3 } from '../src/lib/server/admin-db.ts';

function testDb() {
  const Database = getBetterSqlite3();
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE WechatLoginHandoff (
    id TEXT PRIMARY KEY,
    poll_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    session_id TEXT NOT NULL DEFAULT '',
    session_token TEXT NOT NULL DEFAULT '',
    device_secret TEXT NOT NULL DEFAULT '',
    session_expires_at_ms INTEGER NOT NULL DEFAULT 0,
    member_id INTEGER NOT NULL DEFAULT 0,
    member_json TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    created_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    completed_at_ms INTEGER NOT NULL DEFAULT 0,
    consumed_at_ms INTEGER NOT NULL DEFAULT 0
  )`);
  return db;
}

test('PWA handoff delivers a completed WeChat session exactly once', () => {
  const db = testDb();
  const handoff = createWechatLoginHandoff(db);
  assert.deepEqual(consumeWechatLoginHandoff(db, handoff.id, handoff.pollToken), { status: 'pending' });
  assert.equal(consumeWechatLoginHandoff(db, handoff.id, 'wrong-token').status, 'invalid');

  const session = {
    id: 'device-session-id',
    memberId: 135,
    token: 'member-session-token',
    deviceSecret: 'device-secret',
    expiresAt: Date.now() + 60_000,
  };
  assert.equal(completeWechatLoginHandoff(db, handoff.id, session, { id: 135, name: '伊娃学员' }), true);
  const completed = consumeWechatLoginHandoff(db, handoff.id, handoff.pollToken);
  assert.equal(completed.status, 'completed');
  if (completed.status === 'completed') {
    assert.equal(completed.session.token, session.token);
    assert.equal(completed.member.name, '伊娃学员');
  }
  assert.equal(consumeWechatLoginHandoff(db, handoff.id, handoff.pollToken).status, 'consumed');
  db.close();
});
