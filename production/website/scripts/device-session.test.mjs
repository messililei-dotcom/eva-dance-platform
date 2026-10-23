import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  parseMemberTokenExpiry,
  parseMemberTokenMemberId,
  STUDENT_SESSION_TTL_MS,
} from '../src/lib/student-session-client.ts';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const helpers = read('src/app/api/mini/_helpers.ts');
const phoneLogin = read('src/app/api/mini/student-login/route.ts');
const wechatLogin = read('src/app/api/wechat/oauth/callback/route.ts');
const bootstrap = read('src/components/StudentSessionBootstrap.tsx');
const studentApi = read('src/lib/student-api.ts');
const profilePage = read('src/app/dashboard/profile/page.tsx');
const refresh = read('src/app/api/mini/session/refresh/route.ts');
const auth = read('src/lib/student-auth.ts');
const proxy = read('src/proxy.ts');
const learnProxy = read('src/app/api/learn/_mini-proxy.ts');
const learnListProxy = read('src/app/api/learn/_helpers.ts');
const jsonProxy = read('src/app/api/_proxy.ts');
const ecosystem = read('ecosystem.config.js');
const legacyDashboardPages = [
  'src/app/dashboard/page.tsx',
  'src/app/dashboard/progress/page.tsx',
  'src/app/dashboard/courses/page.tsx',
  'src/app/dashboard/certificates/page.tsx',
].map(read);

test('两段式学员令牌可读取正确到期时间', () => {
  const expiresAt = Date.now() + STUDENT_SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ id: 930, exp: expiresAt })).toString('base64url');
  assert.equal(parseMemberTokenExpiry(`${payload}.signature`), expiresAt);
  assert.equal(parseMemberTokenMemberId(`${payload}.signature`), '930');
});

test('手机号与微信登录使用同一设备会话策略', () => {
  for (const source of [phoneLogin, wechatLogin]) {
    assert.match(source, /createMemberDeviceSession/);
    assert.match(source, /attachMemberSessionCookies/);
  }
  assert.match(phoneLogin, /'phone'/);
  assert.match(wechatLogin, /'wechat'/);
});

test('会话Cookie具备安全属性并采用72小时滑动期限', () => {
  assert.match(helpers, /3 \* 86400 \* 1000/);
  assert.match(helpers, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(helpers, /replaced_by_new_login/);
  assert.match(helpers, /absolute_expires_at_ms/);
});

test('新登录只替换当前设备会话，不会踢掉其他端', () => {
  assert.match(helpers, /WHERE member_id=\? AND device_hash=\? AND revoked_at_ms=0/);
  assert.doesNotMatch(helpers, /WHERE member_id=\? AND revoked_at_ms=0`\n\s*\)\.run\(now, memberId\)/);
});

test('客户端保留服务端返回的绝对到期时间', () => {
  assert.match(auth, /expiresAt\?: number/);
  assert.match(auth, /nextExpiry\(session\.token, session\.expiresAt\)/);
  assert.match(bootstrap, /expiresAt: Number\(payload\.data\.expiresAt \|\| 0\)/);
});

test('学员中心旧页面统一使用新会话，不再读取已删除的键', () => {
  for (const source of legacyDashboardPages) {
    assert.match(source, /getStudentSession/);
    assert.doesNotMatch(source, /localStorage\.getItem\('studentToken'\)/);
    assert.doesNotMatch(source, /localStorage\.getItem\('studentId'\)/);
  }
});

test('页面启动时静默续期，网络失败保留登录，明确未授权时清除登录', () => {
  assert.match(bootstrap, /\/api\/mini\/session\/refresh/);
  assert.match(bootstrap, /catch\(\(\) =>/);
  assert.match(bootstrap, /response\.status === 401/);
  assert.match(bootstrap, /clearStudentSession/);
});

test('业务请求遇到401时等待同一次续签并自动重试', () => {
  assert.match(studentApi, /sessionRefreshPromise/);
  assert.match(studentApi, /\/api\/mini\/session\/refresh/);
  assert.match(studentApi, /error instanceof StudentConnectionError && error\.failure\.type === 'auth'/);
  assert.match(studentApi, /return request<T>\(path, options, true\)/);
  assert.match(studentApi, /if \(authFailed && token\) clearAuth\(\)/);
});

test('设备会话确实失效时清理旧资料并返回登录页', () => {
  assert.match(profilePage, /failure\.type === 'auth'/);
  assert.match(profilePage, /studentApi\.clearAuth\(\)/);
  assert.match(profilePage, /router\.replace\('\/\?login=1&reason=session_expired'\)/);
});

test('主动退出会同时撤销服务端会话', () => {
  assert.match(auth, /\/api\/mini\/session\/logout/);
  assert.match(auth, /keepalive: true/);
});

test('课件代理同时转发令牌和设备 Cookie', () => {
  for (const source of [learnProxy, learnListProxy, jsonProxy]) {
    assert.match(source, /request\.headers\.get\('authorization'\)/);
    assert.match(source, /request\.headers\.get\('cookie'\)/);
    assert.match(source, /Cookie: cookie/);
  }
});

test('官网与统一平台使用同一会话签名密钥', () => {
  assert.match(ecosystem, /unifiedProductionEnv/);
  assert.match(ecosystem, /ADMIN_SESSION_SECRET: envValue\('ADMIN_SESSION_SECRET'\)/);
});

test('签名密钥轮换时仅凭有效设备会话安全换发令牌', () => {
  assert.match(helpers, /getRecoverableDeviceSessionMemberId/);
  assert.match(helpers, /timingSafeEqual/);
  assert.match(helpers, /revoked_at_ms=0/);
  assert.match(refresh, /getAuthenticatedMemberId\(request\)[\s\S]*getRecoverableDeviceSessionMemberId\(db, request\)/);
});

test('个人数据接口只信任已验证令牌，不接受 member_id 覆盖身份', () => {
  const memberIdHelper = helpers.match(
    /export function getMemberId\([\s\S]*?\n}\n\nexport function getMemberToken/,
  )?.[0] || '';
  assert.match(memberIdHelper, /getAuthenticatedMemberId\(request\)/);
  assert.doesNotMatch(memberIdHelper, /params\.get\('member_id'\)/);
  assert.match(auth, /parseMemberTokenMemberId/);
  assert.match(auth, /memberMatchesToken/);
});

test('所有 API 响应显式禁止浏览器和 CDN 缓存', () => {
  assert.match(proxy, /pathname\.startsWith\('\/api\/'\)/);
  assert.match(proxy, /private, no-store, no-cache, max-age=0, s-maxage=0/);
  assert.match(proxy, /Pragma/);
});
