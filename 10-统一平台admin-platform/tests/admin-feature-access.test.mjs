import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => mocks?.[name] ?? require(name), module, module.exports);
  return module.exports;
}
const policy = load('../src/lib/admin-feature-access.ts');
const { NextRequest } = require('next/server');
process.env.ADMIN_SESSION_SECRET = 'isolated-test-secret-for-feature-access';
process.env.NODE_ENV = 'production';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE User(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT,name TEXT,role TEXT,status TEXT);
    INSERT INTO User VALUES(1,'lilei','','超级管理员','admin','active'),
      (2,'yilin','','普通管理员','admin','active'),(3,'qiqi','','教师','teacher','active'),
      (4,'feifei_guyi','','赛事管理员','event_admin','active'),(5,'future_super','','明确超级管理员','super_admin','active');`);
  const db = { prepare: sql => sqlite.prepare(sql), exec: sql => sqlite.exec(sql), close() {} };
  const auth = load('../src/app/api/_local-auth.ts', { '@/lib/server/admin-db': { openAdminDb: () => db } });
  auth.ensureLocalAuthTables(db);
  const middleware = load('../src/middleware.ts', {
    './app/api/_local-auth': auth, './lib/admin-feature-access': policy,
  }).middleware;
  const tokens = Object.fromEntries(sqlite.prepare('SELECT * FROM User').all().map(user => [user.username, auth.createLocalToken(user)]));
  const request = (path, username, method = 'GET', cookie = false) => middleware(new NextRequest(`https://admin.swod.com.cn${path}`, {
    method, headers: username ? cookie ? { cookie: `admin_media_token=${encodeURIComponent(tokens[username])}` } : { authorization: `Bearer ${tokens[username]}` } : {}
  }));
  return { sqlite, auth, middleware, tokens, request };
}

test('navigation and landing pages distinguish the permanent super administrator from ordinary admins', () => {
  for (const user of [{username:'qiqi',role:'teacher'}, {username:'yilin',role:'admin'}]) {
    for (const path of policy.SUPER_ADMIN_PAGES) assert.equal(policy.canAccessAdminPage(user,path),false,path);
    assert.equal(policy.canAccessAdminPage(user,'/events/1'),false);
    assert.equal(policy.adminLandingPage(user),'/online-course/auth');
    for (const path of ['/online-course','/online-course/auth','/online-course/66','/training','/orders','/members','/bonus-commission','/finance']) assert.equal(policy.canAccessAdminPage(user,path),true,path);
  }
  assert.equal(policy.canAccessAdminPage(null,'/dashboard'),false);
  assert.equal(policy.canAccessAdminPage({username:'lilei',role:'admin',status:'inactive'},'/dashboard'),false);
  for (const user of [{username:'lilei',role:'admin'}, {username:'future_super',role:'super_admin'}]) {
    for (const path of [...policy.SUPER_ADMIN_PAGES,'/events/1']) assert.equal(policy.canAccessAdminPage(user,path),true,path);
    assert.equal(policy.canAccessAdminPage(user,'/live'),false);
  }
  assert.equal(policy.canAccessAdminPage({role:'event_admin'},'/events/1'),true);
  assert.equal(policy.canAccessAdminPage({role:'event_admin'},'/orders'),false);
});

test('restricted page requests enforce active database identity and cookie authentication before rendering', async () => {
  const f=fixture();
  try {
    for(const path of [...policy.SUPER_ADMIN_PAGES,'/permissions/nested','/events']) {
      assert.equal((await f.request(path,'lilei','GET',true)).headers.get('x-middleware-next'),'1',path);
      for(const username of ['qiqi','yilin']) assert.equal(new URL((await f.request(path,username,'GET',true)).headers.get('location')).pathname,'/online-course/auth',path);
    }
    for(const username of [null,'lilei','qiqi']) assert.equal((await f.request('/live',username)).status,404);
    assert.equal(new URL((await f.request('/dashboard',null)).headers.get('location')).pathname,'/login');
    assert.equal((await f.request('/events/123','feifei_guyi','GET',true)).headers.get('x-middleware-next'),'1');
    assert.equal(new URL((await f.request('/settings','feifei_guyi','GET',true)).headers.get('location')).pathname,'/events');
    f.sqlite.prepare("UPDATE User SET status='inactive' WHERE username='lilei'").run();
    assert.equal(new URL((await f.request('/dashboard','lilei')).headers.get('location')).pathname,'/login');
  } finally {f.sqlite.close();}
});

test('restricted APIs deny reads and writes for teachers/ordinary admins across both legacy aliases, without changing users', async () => {
  const f=fixture();
  try {
    const before=JSON.stringify(f.sqlite.prepare('SELECT * FROM User').all());
    for(const path of ['/api/dashboard/business','/api/dashboard/overview','/api/student-growth','/api/student-growth/1/adjust', '/api/access-records','/api/course/materials','/api/course/materials/1','/api/course/material-folders','/api/certificates','/api/certificates/batch','/api/users','/api/users/1/status','/api/event/competitions']) {
      for(const prefix of ['/api/','/local-api/','/legacy-student-api/']) {
        const alias=path.replace('/api/',prefix);
        for(const username of ['qiqi','yilin']) {
          assert.equal((await f.request(alias,username)).status,403,alias);
          if(path!=='/api/access-records') assert.equal((await f.request(alias,username,'POST')).status,403,alias);
        }
        assert.equal((await f.request(alias,null)).status,401,alias);
        assert.equal((await f.request(alias,'lilei')).headers.get('x-middleware-next'),'1',alias);
      }
    }
    assert.equal(JSON.stringify(f.sqlite.prepare('SELECT * FROM User').all()),before);
  } finally {f.sqlite.close();}
});

test('ordinary staff keep audits, course-bound previews, read-only material pickers and public/member routes', async () => {
  const f=fixture();
  try {
    for(const path of ['/api/course/material-picker','/api/course/material-picker/folders','/api/course/materials/1/file','/api/course/materials/1/thumbnail','/api/course/courses/1/materials','/api/course/authorizations','/api/orders/unified']) assert.equal((await f.request(path,'qiqi')).headers.get('x-middleware-next'),'1',path);
    assert.equal((await f.request('/api/access-records','qiqi','POST')).headers.get('x-middleware-next'),'1');
    assert.equal((await f.request('/api/access-records','feifei_guyi','POST')).headers.get('x-middleware-next'),'1');
    for(const path of ['/api/certificates/verify?q=test','/api/mini/public/home-stats','/api/mini/events']) assert.equal((await f.request(path,null)).headers.get('x-middleware-next'),'1',path);
    assert.equal((await f.request('/api/event/competitions','feifei_guyi')).headers.get('x-middleware-next'),'1');
    assert.equal((await f.request('/api/users','feifei_guyi')).status,403);
  } finally {f.sqlite.close();}
});

test('stale or forged privilege claims and expired sessions cannot reach protected pages/APIs', async () => {
  const f=fixture();
  try {
    f.tokens.qiqi=f.auth.createLocalToken({id:3,username:'qiqi',role:'super_admin'});
    assert.equal((await f.request('/api/users','qiqi')).status,401);
    assert.equal(new URL((await f.request('/permissions','qiqi')).headers.get('location')).pathname,'/login');
    f.sqlite.prepare("UPDATE User SET role='teacher' WHERE username='future_super'").run();
    assert.equal((await f.request('/api/users','future_super')).status,401);
    const expiredPayload=Buffer.from(JSON.stringify({id:1,username:'lilei',role:'admin',exp:Date.now()-1000})).toString('base64url');
    const signature=require('node:crypto').createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(expiredPayload).digest('base64url');
    f.tokens.lilei=`local.${expiredPayload}.${signature}`;
    assert.equal((await f.request('/api/users','lilei')).status,401);
    assert.equal(new URL((await f.request('/settings','lilei')).headers.get('location')).pathname,'/login');
    f.tokens.lilei=f.tokens.lilei.slice(0,-3)+'bad';
    assert.equal((await f.request('/api/users','lilei')).status,401);
  } finally {f.sqlite.close();}
});
