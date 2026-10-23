import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const learningPage = read('src/app/courses/[id]/videos/page.tsx');
const courseCatalog = read('src/app/api/learn/series/[id]/_public-course-catalog.ts');
const proxy = read('src/proxy.ts');
const ecosystem = read('ecosystem.config.js');

test('course catalog, playback, progress, and notes use the same platform data source', () => {
  assert.match(learningPage, /\/api\/learn\/series\/\$\{encodeURIComponent\(String\(learningSeriesId\)\)\}\/catalog-live/);
  assert.match(learningPage, /\/api\/learn\/video\/\$\{encodeURIComponent\(activeVideoId\)\}\/play/);
  assert.match(learningPage, /\/api\/learn\/video\/\$\{encodeURIComponent\(activeVideoId\)\}\/progress/);
  assert.match(learningPage, /\/api\/learn\/notes\?member_id=/);

  assert.doesNotMatch(learningPage, /\/api\/mini\/video\//);
  assert.doesNotMatch(learningPage, /\/api\/mini\/notes/);
});

test('Macau learning traffic avoids public origin hairpins and caches only public data', () => {
  assert.match(ecosystem, /STUDENT_API_URL: envValue\('INTERNAL_STUDENT_API_URL'\) \|\| 'http:\/\/127\.0\.0\.1:3003\/api'/);
  assert.match(courseCatalog, /forwardCredentials: false/);
  assert.doesNotMatch(courseCatalog, /revalidateSeconds:/);
  assert.match(courseCatalog, /private, no-store, max-age=0, must-revalidate/);
  assert.match(proxy, /\/courses\\\/\[\^\/\]\+\\\/videos/);
  assert.match(proxy, /\/courses\(\?:\\\.json\)\?/);
  assert.match(proxy, /public, max-age=0, s-maxage=300/);
});
