import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { courseProgressDuration } from '../src/lib/course-progress-duration.ts';

test('a shorter lesson keeps its own media duration after switching from a long lesson', () => {
  assert.equal(courseProgressDuration(319.44, 1160, 1160), 319);
});
test('metadata not loaded falls back to this lesson saved duration', () => {
  assert.equal(courseProgressDuration(NaN, 319, 1160), 319);
  assert.equal(courseProgressDuration(Infinity, 0, 319), 319);
  assert.equal(courseProgressDuration(NaN, 0, NaN), 0);
});

test('fullscreen state is false before the player mounts, not null equals null', () => {
  const source = readFileSync(new URL('../src/app/courses/[id]/videos/video-client.tsx', import.meta.url), 'utf8');
  const body = source.match(/const syncFullscreenState = \(\) => \{([\s\S]*?)\n    \};/)[1];
  const sync = new Function('document', 'playerStageRef', 'isFallbackFullscreen', 'setIsCourseFullscreen', body);
  let actual;
  const stage = {};
  for (const [fullscreenElement, current, fallback, expected] of [
    [null, null, false, false], [null, stage, false, false],
    [stage, stage, false, true], [null, stage, true, true],
  ]) {
    sync({ fullscreenElement }, { current }, fallback, value => { actual = value; });
    assert.equal(actual, expected);
  }
});
