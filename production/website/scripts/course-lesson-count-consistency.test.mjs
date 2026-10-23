import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { alignCourseLessonCountText } from '../src/lib/course-lesson-count.ts';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const listRoute = read('src/app/api/platform-courses/route.ts');
const detailRoute = read('src/app/api/platform-courses/[id]/route.ts');
const publicSeries = read('src/app/api/mini/public/series/route.ts');
const player = read('src/app/courses/[id]/videos/page.tsx');
const homeCourses = read('src/components/sections/VideoCoursesSection.tsx');
const coursesPage = read('src/app/courses/page.tsx');

test('all public lesson counts only include published unified-platform lessons', () => {
  assert.match(listRoute, /series_id=cs\.id AND status='published'/);
  assert.match(listRoute, /published\.status='published' AND oc\.status='published'/);
  assert.match(detailRoute, /series_id=\? AND status='published'/);
  assert.match(publicSeries, /series_id=cs\.id AND status='published'/);
});

test('website cards, details, and catalogs use live unified-platform data', () => {
  assert.match(homeCourses, /fetch\('\/api\/platform-courses'/);
  assert.match(coursesPage, /getPlatformDuration/);
  assert.doesNotMatch(coursesPage, /desc: '\d+节/);
  assert.match(player, /\/api\/learn\/series\/.*\/catalog-live/);
});

test('descriptive copy follows the live lesson count', () => {
  assert.equal(
    alignCourseLessonCountText('本课程共包含54节系统训练视频课程。', 63),
    '本课程共包含63节系统训练视频课程。',
  );
});
