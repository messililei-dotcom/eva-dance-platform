import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createWechatOAuthState,
  readWechatOAuthState,
} from '../src/lib/server/wechat-oauth-state.ts';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('binding OAuth state is signed and tied to the logged-in member', () => {
  const state = createWechatOAuthState({
    next: '/dashboard/profile',
    mode: 'wechat',
    purpose: 'bind',
    memberId: 135,
  });
  assert.deepEqual(readWechatOAuthState(state), {
    next: '/dashboard/profile',
    mode: 'wechat',
    purpose: 'bind',
    memberId: 135,
    ts: readWechatOAuthState(state).ts,
  });
  assert.throws(() => readWechatOAuthState(`${state.slice(0, -1)}x`), /无效/);
  assert.throws(() => createWechatOAuthState({ next: '/', mode: 'wechat', purpose: 'bind' }), /先登录/);
});

test('PWA OAuth state carries only a valid signed handoff id', () => {
  const handoffId = '8b3e20a8-88a7-4d07-a7bd-5a7e18317f30';
  const state = readWechatOAuthState(createWechatOAuthState({
    next: '/courses?source=pwa-login',
    mode: 'qr',
    purpose: 'login',
    handoffId,
  }));
  assert.equal(state.handoffId, handoffId);

  const invalid = readWechatOAuthState(createWechatOAuthState({
    next: '/courses',
    mode: 'qr',
    purpose: 'login',
    handoffId: 'not-a-handoff-id',
  }));
  assert.equal(invalid.handoffId, undefined);
});

test('explicit binding refuses a different member instead of merging accounts', async () => {
  const callback = await read('src/app/api/wechat/oauth/callback/route.ts');
  assert.match(callback, /purpose === 'bind' && resolved\.candidateIds\.some/);
  assert.match(callback, /该微信已绑定其他会员/);
  assert.match(callback, /WHERE member_id=\? AND app_id=\? AND openid<>\?/);
  assert.match(callback, /当前会员已绑定另一微信身份/);
  assert.match(callback, /purpose !== 'bind'[\s\S]*mergeMemberAccounts/);
});

test('profile exposes the binding action in the personal-data row', async () => {
  const profile = await read('src/app/dashboard/profile/page.tsx');
  assert.match(profile, /purpose=bind&mode=\$\{mode\}/);
  assert.match(profile, />\s*绑定微信\s*<\/button>/);
  assert.match(profile, /wechatBound \? \([\s\S]*已绑定/);
  assert.match(profile, /wechat_bind_error/);
});
