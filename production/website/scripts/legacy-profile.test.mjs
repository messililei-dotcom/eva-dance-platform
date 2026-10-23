import assert from 'node:assert/strict';
import test from 'node:test';
import { getIOSVersion, shouldUseLegacyProfile } from '../src/lib/legacy-browser.ts';

test('iOS 15.6 使用兼容版个人中心', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.75';
  assert.deepEqual(getIOSVersion(ua), { major: 15, minor: 6 });
  assert.equal(shouldUseLegacyProfile(ua), true);
});

test('iOS 16.3 使用兼容版，iOS 16.4 及以上使用完整版', () => {
  assert.equal(shouldUseLegacyProfile('Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X)'), true);
  assert.equal(shouldUseLegacyProfile('Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)'), false);
  assert.equal(shouldUseLegacyProfile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), false);
});

test('非 iOS 设备不切换兼容页', () => {
  assert.equal(shouldUseLegacyProfile('Mozilla/5.0 (Linux; Android 14)'), false);
  assert.equal(shouldUseLegacyProfile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), false);
});
