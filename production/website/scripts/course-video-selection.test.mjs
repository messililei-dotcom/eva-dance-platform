import assert from 'node:assert/strict';
import test from 'node:test';

import { findCourseVideoSelection } from '../src/lib/course-video-selection.ts';

const videos = [
  { id: 120, material_id: 1594, name: '较早课节' },
  { id: 1594, material_id: 2215, name: '第753节' },
];

test('an exact video ID wins over an earlier material ID collision', () => {
  assert.equal(findCourseVideoSelection(videos, '1594')?.name, '第753节');
});

test('legacy material-ID links remain supported when no video ID matches', () => {
  assert.equal(findCourseVideoSelection(videos, '2215')?.name, '第753节');
});

test('missing selections return null', () => {
  assert.equal(findCourseVideoSelection(videos, '9999'), null);
});
