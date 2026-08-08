import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import ts from 'typescript';

async function loadIdentityModule() {
  const sourcePath = new URL('../src/lib/server/wechat-identity.ts', import.meta.url);
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace(/^import type .*?;\s*$/m, '');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swod-wechat-identity-'));
  const modulePath = path.join(tempDir, 'wechat-identity.mjs');
  fs.writeFileSync(modulePath, output);
  return import(pathToFileURL(modulePath).href);
}

function openTestDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE Member (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT '',
    phone TEXT,
    source TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    wx_openid TEXT DEFAULT '',
    wx_unionid TEXT DEFAULT '',
    wx_nickname TEXT DEFAULT '',
    wx_name TEXT DEFAULT '',
    wx_avatar_url TEXT DEFAULT '',
    wx_profile_synced_at DATETIME,
    avatar TEXT DEFAULT ''
  )`);
  return db;
}

test('同一 UnionID 的小程序和网站 OpenID 归入同一会员', async () => {
  const identity = await loadIdentityModule();
  const db = openTestDb();
  const memberId = Number(db.prepare(
    "INSERT INTO Member (name, phone) VALUES ('测试会员', '13800138000')"
  ).run().lastInsertRowid);

  identity.bindWechatIdentity(db, memberId, {
    channel: 'mini_program',
    appId: 'mini-app',
    openid: 'mini-openid',
    unionid: 'shared-unionid',
  });
  const resolved = identity.resolveWechatMember(db, {
    channel: 'website',
    appId: 'website-app',
    openid: 'website-openid',
    unionid: 'shared-unionid',
  });
  assert.equal(Number(resolved.member.id), memberId);

  identity.bindWechatIdentity(db, memberId, {
    channel: 'website',
    appId: 'website-app',
    openid: 'website-openid',
    unionid: 'shared-unionid',
  });
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM WechatIdentity WHERE member_id=?').get(memberId).count,
    2,
  );
  db.close();
});

test('不同 UnionID 禁止自动绑定到同一会员', async () => {
  const identity = await loadIdentityModule();
  const db = openTestDb();
  const memberId = Number(db.prepare(
    "INSERT INTO Member (name, wx_unionid) VALUES ('冲突会员', 'union-a')"
  ).run().lastInsertRowid);

  assert.throws(() => identity.bindWechatIdentity(db, memberId, {
    channel: 'official_account',
    appId: 'official-app',
    openid: 'official-openid',
    unionid: 'union-b',
  }), /另一微信身份/);
  db.close();
});

test('会员归并时保留各应用身份并记录审计', async () => {
  const identity = await loadIdentityModule();
  const db = openTestDb();
  const targetId = Number(db.prepare(
    "INSERT INTO Member (name, wx_unionid) VALUES ('主会员', 'union-a')"
  ).run().lastInsertRowid);
  const sourceId = Number(db.prepare(
    "INSERT INTO Member (name, wx_unionid) VALUES ('待归并会员', 'union-a')"
  ).run().lastInsertRowid);
  identity.bindWechatIdentity(db, sourceId, {
    channel: 'store',
    appId: 'store-app',
    openid: 'store-openid',
    unionid: 'union-a',
  });

  identity.moveWechatIdentities(db, targetId, sourceId);
  assert.equal(
    db.prepare('SELECT member_id FROM WechatIdentity WHERE app_id=?').get('store-app').member_id,
    targetId,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM WechatIdentityAudit WHERE action='member_merged'").get().count,
    1,
  );
  db.close();
});

