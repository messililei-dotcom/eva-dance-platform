import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeSearchQuery,
  rankSearchResults,
  scoreSearchCandidate,
} from '../src/lib/site-search.ts';

const candidates = [
  {
    id: 'course',
    kind: 'online-course',
    title: '西米技巧系统课',
    description: '系统学习东方舞西米',
    href: '/courses/10',
  },
  {
    id: 'lesson',
    kind: 'lesson',
    title: '第八节：直立西米三位脚的发力',
    description: '西米技巧系统课',
    href: '/courses/10/videos?video=8',
  },
  {
    id: 'news',
    kind: 'news',
    title: '夏季课程结业报道',
    description: '学员完成西米与旋转训练',
    href: '/dance-circle/summer',
    date: '2026-07-01',
  },
];

test('normalizes full-width text and caps query length', () => {
  assert.equal(normalizeSearchQuery('  ＳＷＯＤ   西米  '), 'swod 西米');
  assert.equal(normalizeSearchQuery('西'.repeat(80)).length, 50);
});

test('finds course, lesson and news content', () => {
  const results = rankSearchResults(candidates, '西米');
  assert.deepEqual(new Set(results.map((item) => item.kind)), new Set(['online-course', 'lesson', 'news']));
  assert.equal(results[0].id, 'course');
});

test('supports multi-word matching across fields', () => {
  const result = scoreSearchCandidate(candidates[1], '直立 发力');
  assert.ok(result > 0);
});

test('drops unrelated results and respects result limits', () => {
  assert.equal(rankSearchResults(candidates, '不存在的关键词').length, 0);
  assert.equal(rankSearchResults(candidates, '西米', 2).length, 2);
});
