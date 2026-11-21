const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const ts = require(path.join(root, 'node_modules/typescript'));
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }
).outputText, filename);
const test = require('node:test');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swod-account-'));
process.env.ADMIN_DB_PATH = path.join(temp, 'fixture.db');
process.env.ADMIN_SESSION_SECRET = 'isolated-phone-regression';
const { withDb, createMemberDeviceSession, getAuthenticatedMemberId, memberToken } = require(path.join(root, 'src/app/api/mini/_helpers.ts'));
const { openAdminDb } = require(path.join(root, 'src/lib/server/admin-db.ts'));
const { POST } = require(path.join(root, 'src/app/api/mini/member/phone/route.ts'));
const url = 'https://localhost/api/mini/member/phone';
const phone = '13000001001';
const request = (session, data = {}) => new Request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: 'Bearer '+session.token, Cookie: '__Host-eva_device='+session.deviceSecret } : {}),
  },
  body: JSON.stringify(data)
});
const confirm = (session, phone, code = '123456') => POST(request(session, { phone, code, member_id: 9999 }));
const seed = (db, id, number, expires = '+5 minutes') => db.prepare(`INSERT OR REPLACE INTO MiniProfilePhoneCode
  (member_id, phone, code, expires_at) VALUES (?,?, '123456',datetime('now','localtime',?))`).run(id, number, expires);
const db = openAdminDb();
test('verified WeChat profile binding merges into the original phone account', async (t) => {
  t.after(() => {
    db.close();
    fs.rmSync(temp, { recursive: true });
  });
  db.exec(`CREATE TABLE Member (id INTEGER PRIMARY KEY, name TEXT, phone TEXT UNIQUE, status TEXT DEFAULT 'active', remark TEXT, merged_to_member_id INTEGER DEFAULT 0);
    CREATE TABLE CourseAuthorization (member_id INTEGER, series_id INTEGER, status TEXT, expire_at TEXT, phone TEXT, wx_openid TEXT, wx_unionid TEXT);
    CREATE TABLE CourseOrder (member_id INTEGER, series_id INTEGER);
    CREATE TABLE shop_online_orders (member_id INTEGER, request_key TEXT, status TEXT, UNIQUE(member_id, request_key));
    CREATE TABLE event_players (member_id INTEGER, submitted_by_member_id INTEGER);
    CREATE TABLE OfflineEntitlement (member_id INTEGER, course_id INTEGER, status TEXT);
    CREATE TABLE CourseSeries (id INTEGER PRIMARY KEY, name TEXT, status TEXT, sort_order INTEGER, created_at TEXT);
    CREATE TABLE OnlineCourse (id INTEGER, series_id INTEGER, status TEXT, sort_order INTEGER);
    CREATE TABLE CourseVideo (id INTEGER, course_id INTEGER, status TEXT, sort_order INTEGER);`);
  withDb(() => {});
  const create = (phone, openid = '') => Number(db.prepare('INSERT INTO Member(name,phone,wx_openid) VALUES (?,?,?)')
    .run('Fixture', phone, openid).lastInsertRowid);
  const get = id => db.prepare('SELECT * FROM Member WHERE id=?').get(id);
  const issue = id => createMemberDeviceSession(db, get(id), request(), 'wechat');
  const target = create(phone);
  const source = create(null);
  db.prepare("INSERT INTO WechatIdentity (member_id, channel, app_id, openid) VALUES (?, 'official_account','fixture','source-openid')").run(source);
  const previous = issue(source);
  const targetPrevious = issue(target);
  db.exec(`ALTER TABLE VideoProgress ADD COLUMN phone TEXT;
    ALTER TABLE VideoProgress ADD COLUMN wx_openid TEXT;
    ALTER TABLE VideoProgress ADD COLUMN wx_unionid TEXT;
    ALTER TABLE VideoProgress ADD COLUMN wx_name TEXT;`);
  db.prepare("INSERT INTO CourseAuthorization (member_id,series_id,status,phone) VALUES (?,1,'active',?),(?,2,'active',''),(?,3,'revoked','')").run(target,phone,source,source);
  db.prepare("INSERT INTO CourseOrder VALUES (?,4)").run(source);
  db.prepare("INSERT INTO shop_online_orders VALUES (?,'checkout','pending')").run(source);
  db.prepare("INSERT INTO event_players VALUES (?,?)").run(target, source);
  db.prepare("INSERT INTO OfflineEntitlement VALUES (?,2,'active')").run(source);
  db.prepare("INSERT INTO VideoProgress(member_id,video_id,progress) VALUES (?,1,10),(?,1,25)").run(target,source);
  assert.equal((await confirm(null, phone)).status,401);
  assert.equal((await confirm(previous, phone)).status,400);
  seed(db, source, phone, '-1 minute');
  assert.equal((await confirm(previous, phone)).status,400);
  seed(db, source, phone);
  assert.equal((await confirm(previous, phone, '999999')).status,400);
  assert.equal(get(source).status,'active');
  const result = await confirm(previous, phone);
  const data = (await result.json()).data;
  assert.equal(result.status,200, 'WeChat-only profile should bind a pre-existing phone account');
  assert.equal(data.member.id,target);
  assert.equal(data.phone,'+86'+phone);
  assert.equal(get(target).phone, '+86' + phone);
  assert.match(result.headers.get('Cache-Control'),/private.*no-store/);
  assert.match(result.headers.get('Set-Cookie'),/__Host-eva_session=/);
  assert.equal(getAuthenticatedMemberId(request({token:data.token,deviceSecret:previous.deviceSecret})),target);
  assert.equal(getAuthenticatedMemberId(request(previous)),0);
  assert.equal(getAuthenticatedMemberId(request(targetPrevious)),0);
  assert.equal(getAuthenticatedMemberId(request({token:memberToken({id:source}),deviceSecret:''})),0);
  assert.equal(db.prepare('SELECT member_id FROM WechatIdentity').get().member_id,target);
  assert.deepEqual(db.prepare('SELECT member_id, status FROM CourseAuthorization ORDER BY series_id').all(),[
    {member_id:target,status:'active'}, {member_id:target,status:'active'}, {member_id:target,status:'revoked'}]);
  assert.equal(db.prepare('SELECT member_id FROM CourseOrder').get().member_id,target);
  assert.deepEqual(db.prepare('SELECT member_id, status FROM shop_online_orders').get(), { member_id: target, status: 'pending' });
  assert.equal(db.prepare('SELECT submitted_by_member_id FROM event_players').get().submitted_by_member_id, target);
  assert.equal(db.prepare('SELECT member_id FROM OfflineEntitlement').get().member_id, target);
  assert.deepEqual(db.prepare('SELECT member_id,progress FROM VideoProgress').all(),[{member_id:target,progress:25}]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM MiniProfilePhoneCode').get().n,0);
  const next = {token:data.token,deviceSecret:previous.deviceSecret};
  assert.equal((await confirm(next,phone)).status,400);
  const source2 = create(null,'source2');
  const session2 = issue(source2);
  seed(db, source2, phone);
  assert.equal((await confirm(session2,phone)).status,409);
  assert.equal(get(source2).status,'active');
  const otherPhone = '13000001002';
  create(otherPhone);
  seed(db, target, otherPhone);
  assert.equal((await confirm(next,otherPhone)).status,409);
  const unused = '13000001003';
  seed(db, target, unused);
  assert.equal((await confirm(next,unused)).status,200);
  assert.equal(get(target).phone, '+86' + unused);

  const rollbackPhone = '13000001004';
  const rollbackTarget = create(rollbackPhone);
  const rollbackSource = create(null, 'rollback-wechat');
  seed(db, rollbackSource, rollbackPhone);
  db.exec(`CREATE TRIGGER reject_phone_change BEFORE UPDATE OF phone_country_code ON Member
    WHEN OLD.id=${rollbackTarget} BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;`);
  assert.equal((await confirm(issue(rollbackSource), rollbackPhone)).status, 500);
  assert.equal(get(rollbackSource).status, 'active');
  assert.equal(get(rollbackSource).wx_openid, 'rollback-wechat');
  assert.equal(get(rollbackTarget).wx_openid, '');
});
