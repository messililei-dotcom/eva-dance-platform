import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsManualInstall, requestPwaInstall } from '../src/lib/pwa-install.ts';
test('Huawei and Harmony browsers offer manual desktop guide', () => {
  for (const ua of ['HuaweiBrowser/7.7', 'Mozilla HarmonyOS', 'HUAWEI']) assert.equal(needsManualInstall(ua), true);
  assert.equal(needsManualInstall('Chrome/140'), false);
});
test('missing, rejected and stalled prompts show manual guide', async () => {
  assert.equal(await requestPwaInstall(null), 'manual');
  assert.equal(await requestPwaInstall({prompt: async () => {throw Error('unsupported');}}), 'manual');
  assert.equal(await requestPwaInstall({prompt: () => new Promise(() => {} )}, 5), 'manual');
});
test('accepted and dismissed native results are preserved', async () => {
  for (const outcome of ['accepted', 'dismissed']) assert.equal(await requestPwaInstall({prompt: async () => {}, userChoice: Promise.resolve({outcome})}), outcome);
});

test('fullscreen installed app retains PWA authentication behavior', async () => {
  const { isStandalonePwa } = await import('../src/lib/pwa-auth-flow.ts');
  const oldWindow = globalThis.window;
  globalThis.window = { matchMedia: query => ({ matches: query === '(display-mode: fullscreen)' }), navigator: {} };
  try { assert.equal(isStandalonePwa(), true); }
  finally { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; }
});
