import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const auth = read('src/app/api/mini/_auth.ts');
const bindPhone = read('src/app/api/mini/member/bind-phone/route.ts');
const wechatCallback = read('src/app/api/wechat/oauth/callback/route.ts');
const profile = read('src/app/dashboard/profile/page.tsx');
const wechatProfile = read('src/app/api/mini/member/wechat-profile/route.ts');

test('微信用户绑定手机号必须验证短信验证码', () => {
  assert.match(profile, /studentApi\.sendCode\(bindPhone, bindCountryCode\)/);
  assert.match(profile, /studentApi\.bindPhone\(bindPhone, bindCode, bindCountryCode\)/);
  assert.doesNotMatch(profile, /studentApi\.updateMember\(member\.id,\s*\{[\s\S]*phone: bindPhone/);
  assert.match(bindPhone, /MiniSmsCode/);
  assert.match(bindPhone, /getAuthenticatedMemberId\(request\)/);
});

test('手机用户绑定已有微信时执行统一账号合并', () => {
  assert.match(wechatCallback, /mergeMemberAccounts\(db, currentMember\.id, wechatMember\.id\)/);
  assert.match(wechatCallback, /createMemberDeviceSession/);
});

test('账号合并迁移课程和学习数据并保留较高进度', () => {
  for (const table of [
    'CourseAuthorization',
    'CourseOrder',
    'Certificate',
    'StudyNote',
    'VideoBookmark',
    'VideoProgress',
    'PracticeCheckin',
    'event_players',
  ]) {
    assert.match(auth, new RegExp(table));
  }
  assert.match(auth, /progress=MAX\(target\.progress/);
  assert.match(auth, /status='inactive'/);
  assert.match(auth, /merged_into:/);
});

test('微信资料更新必须验证当前登录会话', () => {
  assert.match(wechatProfile, /getAuthenticatedMemberId\(request\)/);
  assert.doesNotMatch(wechatProfile, /getMemberId/);
});
