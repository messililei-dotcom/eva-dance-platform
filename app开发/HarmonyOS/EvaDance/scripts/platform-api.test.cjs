const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.resolve(__dirname, '../../../../10-统一平台admin-platform/node_modules/typescript'));

function fixture() {
  const vault = { value: undefined, wait: undefined, async read(){return this.value;}, async save(value){if(value && this.wait)await this.wait;this.value=value;} };
  class FakeVault { async read(){return vault.read();} async save(value){return vault.save(value);} }

  const calls = [], redirects = [], sessions = [];
  const replies = [];
  const response = async (transport, request) => {
    calls.push({ transport, ...request });
    const next = replies.shift() || { status: 200, data: { success: true, data: {} } };
    if (next.wait) await next.wait;
    return next;
  };
  const http = {
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE', PUT: 'PUT' },
    InterceptorType: { REDIRECTION: 1 }, HttpDataType: { STRING: 1 },
    HttpInterceptorChain: class {
      addChain(chain) { redirects.push(...chain); return true; }
      apply() { return true; }
    },
    createHttp: () => ({
      async request(url, options) {
        const next = await response('http', { url, options });
        return { responseCode: next.status, result: JSON.stringify(next.data) };
      }, destroy() {},
    }),
  };
  const rcp = {
    Request: class {
      constructor(url, method, headers, content) { Object.assign(this, { url, method, headers, content }); }
    },
    createSession(configuration) {
      const session = { configuration, closed: false,
        async fetch(request) {
          const next = await response('rcp', request);
          return { statusCode: next.status, body: new ArrayBuffer(1), toString: () => JSON.stringify(next.data) };
        }, close() { this.closed = true; },
      };
      sessions.push(session); return session;
    },
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../entry/src/main/ets/services/PlatformApi.ets'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => {
    if (name === '@kit.NetworkKit') return { http };
    if (name === '@kit.RemoteCommunicationKit') return { rcp };
    if (name === '@kit.ArkTS') return { util: {} };
    if (name.endsWith('HuksVault')) return {HuksVault: FakeVault};
    throw new Error('Unexpected dependency: ' + name);
  }, module, module.exports);
  const api = new module.exports.PlatformApi();
  api.vault = new FakeVault();
  api.credentials = { token: 'fixture-a', refreshToken: 'fixture-refresh', memberId: 1, sessionId: 'fixture-session', expiresAt: 0 };
  return { api, vault, calls, replies, sessions, redirects, publicRead:module.exports.publicRead, coverImageURL: module.exports.coverImageURL,
    externalURLAllowed: module.exports.externalURLAllowed };
}

test('cancel during protected credential write restores the previous session on disk', async()=>{
  const f=fixture();const original=f.api.credentials;let release;let active=true;
  f.vault.wait=new Promise(resolve=>{release=resolve;});
  f.replies.push({status:200,data:{success:true,data:{token:'new-access',refreshToken:'new-refresh',memberId:9,sessionId:'new-session'}}});
  const pending=f.api.loginWithPassword('13800000000','fixture-password',()=>active);
  await new Promise(resolve=>setImmediate(resolve));active=false;release();
  await assert.rejects(pending,/已取消/);assert.equal(f.api.credentials,original);assert.equal(JSON.parse(f.vault.value).memberId,original.memberId);
});
test('logout during protected credential write cannot restore an account on restart', async()=>{
  const f=fixture();let release;f.vault.wait=new Promise(resolve=>{release=resolve;});
  f.replies.push({status:200,data:{success:true,data:{token:'new-access',refreshToken:'new-refresh',memberId:9,sessionId:'new-session'}}});
  const pending=f.api.loginWithPassword('13800000000','fixture-password');
  await new Promise(resolve=>setImmediate(resolve));f.api.clear();release();
  await assert.rejects(pending,/已取消|已切换/);assert.equal(f.api.credentials,undefined);assert.equal(f.vault.value,'');
});

test('external link policy permits the filing query and retains the existing trusted destinations', () => {
  const { externalURLAllowed } = fixture();
  for (const url of ['https://beian.miit.gov.cn/', 'https://www.swod.com.cn/privacy', 'https://www.swod.com.cn/terms', 'https://admin.swod.com.cn/api/certificates/verify/1']) {
    assert.equal(externalURLAllowed(url), true, url);
  }
  for (const url of ['https://beian.miit.gov.cn.evil.example/', 'https://beian.miit.gov.cn/other', 'https://other.example/', 'http://www.swod.com.cn/privacy', 'https://admin.swod.com.cn/other']) {
    assert.equal(externalURLAllowed(url), false, url);
  }
});

test('member password login uses the review-capable app endpoint and replaces the session', async () => {
  const f = fixture();
  f.replies.push({ status: 200, data: { success: true, data: { token: 'review-token', refreshToken: 'review-refresh', memberId: 5364, sessionId: 'fixture-session' } } });
  await f.api.loginWithPassword('19999990001', 'fixture-secret');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://admin.swod.com.cn/api/app/v1/auth/password-login');
  assert.equal(f.calls[0].options.header['x-client-platform'], 'harmony');
  assert.deepEqual(JSON.parse(f.calls[0].options.extraData), { phone: '19999990001', password: 'fixture-secret', deviceName: '伊娃东方舞 HarmonyOS' });
  assert.equal(f.api.credentials.memberId, 5364);
  assert.equal(f.api.credentials.token, 'review-token');
});

test('carrier login sends only the operator token and accepts server-owned identity', async () => {
  const f = fixture();
  f.replies.push({ status: 200, data: { success: true, data: { token: 'carrier-access', refreshToken: 'carrier-refresh', memberId: 2, sessionId: 'fixture-session' } } });
  await f.api.loginWithCarrier('operator-issued-token');
  assert.equal(f.calls[0].url, 'https://admin.swod.com.cn/api/app/v1/auth/one-tap');
  assert.deepEqual(JSON.parse(f.calls[0].options.extraData), { accessToken: 'operator-issued-token', deviceName: 'SWOD HarmonyOS' });
  assert.equal(f.api.credentials.memberId, 2);
});

test('a late carrier login response cannot restore a cleared account', async () => {
  const f = fixture(); let release;
  const wait = new Promise(resolve => { release = resolve; });
  f.replies.push({ wait, status: 200, data: { success: true, data: { token: 'late-access', refreshToken: 'late-refresh', memberId: 2, sessionId: 'fixture-session' } } });
  const pending = f.api.loginWithCarrier('operator-issued-token');
  f.api.clear(); release();
  await assert.rejects(pending, /账号已切换/);
  assert.equal(f.api.credentials, undefined);
});

test('an incomplete carrier response never creates a logged-in account', async () => {
  const f = fixture(); f.api.clear();
  f.replies.push({ status: 200, data: { success: true, data: { token: 'missing-refresh', memberId: 2, sessionId: 'fixture-session' } } });
  await assert.rejects(f.api.loginWithCarrier('operator-issued-token'), /登录响应无效/);
  assert.equal(f.api.credentials, undefined);
});

test('course covers resolve server-relative URLs without accepting unsafe schemes or hosts', () => {
  const { coverImageURL } = fixture();
  const relative = '/api/course/series/cover/%E5%85%A8%E5%8A%9B-1792289355493.jpg';
  assert.equal(coverImageURL(relative), 'https://admin.swod.com.cn' + relative);
  assert.equal(coverImageURL('https://admin.swod.com.cn/cover.jpg'), 'https://admin.swod.com.cn/cover.jpg');
  for (const invalid of ['', '//other.example/cover.jpg', '/\\other.example/a', '/%2e%2e/a', '/a/../b', 'http://example.com/a', 'file:///a', 'javascript:alert(1)']) {
    assert.equal(coverImageURL(invalid), '', invalid);
  }
});

test('PATCH uses native RCP with bearer auth, no redirect and no shared cache', async () => {
  const f = fixture();
  await f.api.request('/member/messages/1/read', 'PATCH', {}, true);
  assert.equal(f.calls[0].transport, 'rcp');
  assert.equal(f.calls[0].method, 'PATCH');
  assert.equal(f.calls[0].headers.Authorization, 'Bearer fixture-a');
  assert.equal(f.calls[0].headers['Cache-Control'], 'no-store');
  assert.equal(f.sessions[0].configuration.requestConfiguration.transfer.autoRedirect, false);
  assert.equal(f.sessions[0].configuration.requestConfiguration.transfer.timeout.transferMs, 20000);
  assert.ok(f.sessions[0].closed);
});

test('PATCH redirect is rejected and its session is closed', async () => {
  const f = fixture(); f.replies.push({ status: 302, data: {} });
  await assert.rejects(f.api.request('/member/messages/1/read', 'PATCH', {}, true), e => e.status === 302);
  assert.equal(f.calls.length, 1); assert.ok(f.sessions[0].closed);
});

test('PATCH 401 refreshes through the existing API before retrying with the renewed token', async () => {
  const f = fixture();
  f.replies.push({ status: 401, data: { error: 'expired' } },
    { status: 200, data: { success: true, data: { ...f.api.credentials, token: 'fixture-b' } } },
    { status: 200, data: { success: true, data: {} } });
  await f.api.request('/member/messages/1/read', 'PATCH', {}, true);
  assert.equal(f.calls[1].url, 'https://admin.swod.com.cn/api/app/v1/auth/refresh');
  assert.equal(f.calls[2].headers.Authorization, 'Bearer fixture-b');
  assert.ok(f.sessions.every(s => s.closed));
});

test('logout during PATCH prevents credential refresh and replay', async () => {
  const f = fixture(); let release;
  const wait = new Promise(resolve => { release = resolve; });
  f.replies.push({ status: 401, data: { error: 'expired' }, wait });
  const pending = f.api.request('/member/messages/1/read', 'PATCH', {}, true);
  f.api.clear(); release();
  await assert.rejects(pending, e => e.status === 401);
  assert.equal(f.calls.length, 1); assert.equal(f.api.credentials, undefined);
});

test('native client has no administrator login or request transport', () => {
  const f = fixture();
  assert.equal(typeof f.api.loginStaff, 'undefined');
  assert.equal(typeof f.api.staffRequest, 'undefined');
  assert.equal(f.calls.length, 0);
});

test('invalid PATCH paths are rejected before starting a network session', async () => {
  const f = fixture();
  for (const value of ['//elsewhere/path', '/event/../member', '/event/%2fmember']) {
    await assert.rejects(f.api.request(value, 'PATCH', {}, true), e => e.status === 400);
  }
  assert.equal(f.calls.length, 0); assert.equal(f.sessions.length, 0);
});

test('existing GET transport retains cache and redirect protection', async () => {
  const f = fixture(); await f.api.request('/member/authorized-series', 'GET', undefined, true);
  assert.equal(f.calls[0].options.usingCache, false);
  assert.equal(await f.redirects[0].interceptorHandle({}, {}), false);
});

for (const method of ['sms', 'password', 'carrier']) {
  for (const reason of ['account changed', 'login screen closed']) {
    test(method + ' login cannot commit a delayed response after ' + reason, async () => {
      const f = fixture(); let release; let current = true;
      const original = f.api.credentials;
      const wait = new Promise(resolve => { release = resolve; });
      f.replies.push({ status: 200, wait, data: { success: true, data: {
        token: 'late-token', refreshToken: 'late-refresh', memberId: 99, sessionId: 'fixture-session'
      } } });
      const active = () => current;
      const pending = method === 'sms' ? f.api.login('13800000000', '123456', active) :
        method === 'password' ? f.api.loginWithPassword('13800000000', 'fixture-secret', active) :
        f.api.loginWithCarrier('operator-issued-fixture', active);
      if (reason === 'account changed') f.api.clear(); else current = false;
      release();
      await assert.rejects(pending, /登录已取消或账号已切换/);
      assert.equal(f.api.credentials, reason === 'account changed' ? undefined : original);
      assert.equal(f.calls.length, 1);
    });
  }
}

test('only public group and player GETs use public transport; judge, malformed routes and writes remain private',()=>{const f=fixture();for(const path of ['/events/7/groups/2','/events/7/groups/2/players/9']){assert.equal(f.publicRead(path,'GET'),true);assert.equal(f.publicRead(path,'POST'),false);}for(const path of ['/events/7/judge','/events/7/groups/0','/events/7/groups/2/players/9/edit','/member/events'])assert.equal(f.publicRead(path,'GET'),false);});
