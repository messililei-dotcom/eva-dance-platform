import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { normalizeEventMemberPhone, syncEventPlayerToMember } from '../src/lib/server/event-member-sync.ts';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE Member (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      phone_national_number TEXT,
      gender TEXT DEFAULT '',
      birthday TEXT DEFAULT '',
      level TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      register_date TEXT DEFAULT '',
      country TEXT DEFAULT '',
      province TEXT DEFAULT '',
      city TEXT DEFAULT '',
      address TEXT DEFAULT '',
      source TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      merged_to_member_id INTEGER DEFAULT 0
    );
  `);
  return db;
}

test('姓名和国内区号手机号同时一致时复用已有学员', () => {
  const db = fixture();
  db.prepare("INSERT INTO Member (name,phone,source) VALUES ('已有学员','13800138000','phone_login')").run();
  const result = syncEventPlayerToMember(db, { name: '已有学员', phone: '+86 138-0013-8000', legacyUid: 12 });
  assert.equal(result.memberId, 1);
  assert.equal(result.matchedBy, 'name_phone');
  assert.equal(db.prepare('SELECT COUNT(*) count FROM Member').get().count, 1);
  const member = db.prepare('SELECT * FROM Member WHERE id=1').get();
  assert.equal(member.name, '已有学员');
  assert.equal(member.source, 'phone_login');
  assert.match(member.remark, /赛事参赛学员/);
  assert.match(member.remark, /legacy_event_uid=12/);
  db.close();
});

test('同一代报名手机号下的不同姓名不会合并', () => {
  const db = fixture();
  const first = syncEventPlayerToMember(db, { name: 'Jjuni', phone: '15607809187', legacyUid: 599 });
  const second = syncEventPlayerToMember(db, { name: 'Hyeri Lee', phone: '15607809187', legacyUid: 1585 });
  const third = syncEventPlayerToMember(db, { name: 'Baek Song', phone: '15607809187', legacyUid: 1985 });
  assert.notEqual(first.memberId, second.memberId);
  assert.notEqual(second.memberId, third.memberId);
  assert.deepEqual(db.prepare('SELECT name,phone FROM Member ORDER BY id').all(), [
    { name: 'Jjuni', phone: null },
    { name: 'Hyeri Lee', phone: null },
    { name: 'Baek Song', phone: null },
  ]);
  db.close();
});

test('历史 uid 导入重复执行保持幂等', () => {
  const db = fixture();
  const first = syncEventPlayerToMember(db, { name: '无手机选手', legacyUid: 'legacy-9' });
  const second = syncEventPlayerToMember(db, { name: '无手机选手', legacyUid: 'legacy-9' });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.memberId, first.memberId);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM Member').get().count, 1);
  db.close();
});

test('已合并且姓名一致的 member_id 自动归入微信主 member', () => {
  const db = fixture();
  db.prepare("INSERT INTO Member (id,name,phone) VALUES (1,'微信主账号','13900139000')").run();
  db.prepare("INSERT INTO Member (id,name,phone,merged_to_member_id,status) VALUES (2,'手机旧账号','13900139001',1,'merged')").run();
  const result = syncEventPlayerToMember(db, { memberId: 2, name: '微信主账号' });
  assert.equal(result.memberId, 1);
  assert.equal(result.matchedBy, 'member_id');
  db.close();
});

test('明显无效手机号不会作为手机号身份写入', () => {
  assert.equal(normalizeEventMemberPhone('123'), '');
  const db = fixture();
  const result = syncEventPlayerToMember(db, { name: '测试选手', phone: '123', legacyUid: 'bad-phone-1' });
  assert.equal(result.created, true);
  assert.equal(db.prepare('SELECT phone FROM Member WHERE id=?').get(result.memberId).phone, null);
  db.close();
});

test('兼容没有合并字段的旧版 Member 表', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE Member (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,remark TEXT)');
  db.prepare("INSERT INTO Member (name,phone) VALUES ('旧表学员','13700137000')").run();
  const result = syncEventPlayerToMember(db, { name: '旧表学员', phone: '13700137000' });
  assert.equal(result.memberId, 1);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM Member').get().count, 1);
  db.close();
});
