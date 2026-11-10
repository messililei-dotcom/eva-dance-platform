const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('activation claims clients without duplicate navigation and preserves unrelated caches', async () => {
  const handlers = {}, deleted = [];
  let navigations = 0, claimed = 0;
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self: { addEventListener: (name, fn) => handlers[name] = fn, clients: {
      claim: async () => claimed++, matchAll: async () => [{ url: '/', navigate: async () => navigations++ }],
    } },
    caches: { keys: async () => ['swod-pwa-v1-static', 'another-app-cache'], delete: async key => deleted.push(key) },
  });
  let completion;
  handlers.activate({ waitUntil: promise => completion = promise });
  await completion;
  assert.equal(claimed, 1);
  assert.equal(navigations, 0);
  assert.deepEqual(deleted, ['swod-pwa-v1-static']);
});

test('running PWA checks updates on foreground and reconnect and removes listeners', async () => {
  const effects = [], wh = {}, dh = {};
  let updates = 0, reloads = 0, controllerChange;
  const registration = { update: async () => updates++, addEventListener() {}, removeEventListener() {} };
  const serviceWorker = { controller: {}, register: async () => registration,
    addEventListener: (name, fn) => controllerChange = fn, removeEventListener() {} };
  const source = ts.transpileModule(fs.readFileSync('src/components/PWAProvider.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: name => name === 'react' ? { useEffect: fn => effects.push(fn) }
      : name.includes('pwa-auth-flow') ? { isStandalonePwa: () => false }
      : name.includes('student-auth') ? { getStudentSession: () => null, STUDENT_AUTH_CHANGED_EVENT: 'auth' }
      : { flushLearningProgress() {} },
    navigator: { serviceWorker },
    window: { isSecureContext: true, location: { reload: () => reloads++ },
      addEventListener: (name, fn) => wh[name] = fn, removeEventListener: name => delete wh[name] },
    document: { visibilityState: 'visible', addEventListener: (name, fn) => dh[name] = fn,
      removeEventListener: name => delete dh[name] },
  });
  exports.default();
  const cleanup = effects[1]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates, 1);
  assert.equal(typeof wh.online, 'function');
  assert.equal(typeof dh.visibilitychange, 'function');
  wh.online(); dh.visibilitychange();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates, 3);
  controllerChange(); controllerChange();
  assert.equal(reloads, 1);
  cleanup();
  assert.equal(wh.online, undefined);
  assert.equal(dh.visibilitychange, undefined);
});

test('private pages, APIs, videos and writes bypass service worker cache', () => {
  const handlers = {};
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    URL, self: { location: { origin: 'https://www.swod.com.cn' }, addEventListener: (name, fn) => handlers[name] = fn },
  });
  for (const path of ['/api/student/entitlements', '/courses/123', '/dashboard/profile', '/profile', '/my-courses', '/login', '/register', '/video.mp4']) {
    handlers.fetch({ request: { method: 'GET', url: `https://www.swod.com.cn${path}`, mode: path.endsWith('.mp4') ? 'cors' : 'navigate', destination: path.endsWith('.mp4') ? 'video' : 'document' },
      respondWith() { assert.fail(`intercepted ${path}`); } });
  }
  handlers.fetch({ request: { method: 'POST' }, respondWith() { assert.fail('intercepted write'); } });
});
