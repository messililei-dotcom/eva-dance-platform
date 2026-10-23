import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { chooseWechatLogin, PWA_COURSES_PATH, PWA_LOGIN_SUCCESS_PATH } from '../src/lib/pwa-auth-flow.ts';

test('PWA opens on Online Academy and returns there after login', () => {
  assert.equal(PWA_COURSES_PATH, '/courses?source=pwa');
  assert.equal(PWA_LOGIN_SUCCESS_PATH, '/courses?source=pwa-login');
});

test('WeChat client uses official-account one-click OAuth', () => {
  assert.deepEqual(chooseWechatLogin({
    userAgent: 'Mozilla/5.0 MicroMessenger/8.0.50',
    isDesktop: false,
    qrEnabled: true,
    isStandalonePwa: false,
    miniAppEnabled: true,
  }), {
    available: true,
    mode: 'wechat',
    label: '微信一键登录',
  });
});

test('installed mobile PWA hands login off to the mini program outside WeChat', () => {
  assert.deepEqual(chooseWechatLogin({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Mobile/15E148 Safari/604.1',
    isDesktop: false,
    qrEnabled: true,
    isStandalonePwa: true,
    miniAppEnabled: true,
  }), {
    available: true,
    mode: 'mini',
    label: '微信一键登录',
  });
});

test('external browser never starts official-account OAuth without website-app config', () => {
  const result = chooseWechatLogin({
    userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/139 Mobile Safari/537.36',
    isDesktop: false,
    qrEnabled: false,
  });
  assert.equal(result.available, false);
  assert.equal(result.mode, 'wechat');
  assert.match(result.error || '', /验证码登录/);
});

test('installed PWA exposes a direct one-tap WeChat login action', () => {
  const navbar = fs.readFileSync(new URL('../src/components/Navbar_v2.tsx', import.meta.url), 'utf8');
  assert.match(navbar, /aria-label="微信一键登录"/);
  assert.match(navbar, /\/api\/wechat\/mini-handoff\/start/);
  assert.match(navbar, /window\.open\('about:blank', 'eva-wechat-login'\)/);
});
