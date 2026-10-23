import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const learningPage = fs.readFileSync(
  new URL('../src/app/courses/[id]/videos/page.tsx', import.meta.url),
  'utf8',
);
const coursesPage = fs.readFileSync(
  new URL('../src/app/courses/page.tsx', import.meta.url),
  'utf8',
);

test('course catalogue search is temporary and cannot hide lessons on a later visit', () => {
  assert.doesNotMatch(learningPage, /course-catalog-search:/);
  const storageCalls = learningPage.match(/localStorage\.(?:getItem|setItem|removeItem)\([^)]*\)/g) || [];
  for (const call of storageCalls) assert.match(call, /\(PLAYBACK_MODE_STORAGE_KEY(?:,|\))/);
  assert.match(learningPage, /\[catalogQuery, setCatalogQuery\] = useState\(''\)/);
  assert.match(learningPage, /setCatalogQuery\(''\);[\s\S]*setCatalogPage\(1\);/);
});

test('course wall omits the duplicate academy heading and course search control', () => {
  assert.doesNotMatch(coursesPage, /<h2[^>]*>[\s\S]*?线上学院[\s\S]*?<\/h2>/);
  assert.doesNotMatch(coursesPage, /打开课程搜索|关闭课程搜索|placeholder="搜索课程"/);
  assert.doesNotMatch(coursesPage, /searchOpen|searchQuery|visibleCourses|normalizedSearchQuery/);
});
