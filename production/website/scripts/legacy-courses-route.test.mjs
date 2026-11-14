import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/app/dashboard/courses/page.tsx', import.meta.url), 'utf8');

test('legacy courses entry redirects before rendering or requesting admin payments', () => {
  assert.match(source, /import\s*\{\s*redirect\s*\}\s*from\s*['"]next\/navigation['"]/);
  assert.doesNotMatch(source, /use client|\/api\/payments|\.map\(/);
  const route = new Function('redirect', source
    .replace(/import[^;]+;/g, '')
    .replace('export default function', 'return function'));
  const destinations = [];
  route((destination) => { destinations.push(destination); })();
  assert.deepEqual(destinations, ['/dashboard/profile#online-courses']);
});
