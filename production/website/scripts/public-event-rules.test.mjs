import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const archive = [{ id: 'event-2026-100057', slug: 'event-2026-100057', title: '测试2026', date: '2026-08-27', dateRange: '2026-08-27 至 2026-08-31', registrationStatus: 'open' }];
function events(rows, failed = false) {
  return load('../src/lib/events-news.ts', {
    fs: { readFileSync: () => JSON.stringify(archive) },
    '@/lib/server/admin-db': { openAdminDb: () => { if (failed) throw new Error('fixture unavailable'); return { prepare: () => ({ all: () => rows }), close() {} }; } },
  });
}
test('expired events cannot remain open and unknown dates fail closed', () => {
  const { getEventStatus } = events([]);
  assert.equal(getEventStatus(archive[0], Date.parse('2026-09-06')), 'ended');
  assert.equal(getEventStatus({ ...archive[0], dateRange: '2026-09-30', date: '2026-09-30' }, Date.parse('2026-09-06')), 'registering');
  assert.equal(getEventStatus({ ...archive[0], registrationStatus: 'closed' }, Date.parse('2026-08-01')), 'ended');
  assert.equal(getEventStatus({ date: '', dateRange: '' }), 'ended');
});
test('confirmed fixture is absent from list and detail, including archive fallback', () => {
  for (const failed of [false, true]) {
    const data = events([], failed);
    assert.equal(data.getEventsNews().length, 0);
    assert.equal(data.getEventNewsBySlug('event-2026-100057'), undefined);
  }
});
test('legacy optimized cover requests redirect locally without server-side remote fetching', () => {
  const { NextRequest } = require('next/server');
  const { proxy } = load('../src/proxy.ts', { '@/lib/legacy-browser': { shouldUseLegacyProfile: () => false }, '@/lib/mobile-course-navigation': { getMobileCourseVideoPath: () => null } });
  const r = proxy(new NextRequest('https://www.swod.com.cn/_next/image?url=%2Fapi%2Fevents-news%2Fmedia%2Fevent-2024-18&w=640&q=75'));
  assert.equal(r.status, 307);
  assert.equal(r.headers.get('location'), 'https://www.swod.com.cn/api/events-news/media/event-2024-18');
  const external = proxy(new NextRequest('https://www.swod.com.cn/_next/image?url=https%3A%2F%2Fexample.com%2Fimage.jpg'));
  assert.equal(external.headers.get('x-middleware-next'), '1');
});
