import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragScrollSpeed, lessonDropPosition, startDragScrollLoop } from '../src/lib/lesson-drag-sort.ts';

test('moves forward/backward with before/after insertion and preserves other pages', () => {
  const ids = Array.from({ length: 135 }, (_, i) => i + 1);
  assert.equal(lessonDropPosition(ids, 1, { id: 50, edge: 'after' }), 50);
  assert.equal(lessonDropPosition(ids, 1, { id: 50, edge: 'before' }), 49);
  assert.equal(lessonDropPosition(ids, 50, { id: 1, edge: 'before' }), 1);
  assert.equal(lessonDropPosition(ids, 51, { id: 100, edge: 'after' }), 100);
  assert.equal(lessonDropPosition(ids, 1, { id: 135, edge: 'after' }), 135);
  assert.equal(lessonDropPosition(ids, 50, { id: 50, edge: 'after' }), 50);
  assert.equal(lessonDropPosition(ids, 2, { id: 1, edge: 'after' }), 2);
  assert.equal(lessonDropPosition(ids, 1, { id: 2, edge: 'before' }), 1);
});

test('stationary pointer scrolls to page end for 30 seconds, reverses and stops on cancel', () => {
  let callback; let cancelled = false; let scrollTop = 0; let frames = 0;
  const pointer = { x: 50, y: 499 };
  const stop = startDragScrollLoop({
    getBounds: () => ({ top: 0, bottom: 500, left: 0, right: 100 }),
    getPointer: () => pointer,
    scrollBy: distance => { scrollTop = Math.max(0, Math.min(5500, scrollTop + distance)); },
    onFrame: () => { frames++; },
    requestFrame: fn => { callback = fn; return 1; },
    cancelFrame: () => { cancelled = true; },
  });
  for (let t = 0; t <= 30000; t += 16) callback(t);
  assert.equal(scrollTop, 5500);
  assert.ok(frames > 1000, 'target is recalculated without pointermove');
  pointer.y = 1;
  for (let t = 30016; t <= 42000; t += 16) callback(t);
  assert.equal(scrollTop, 0);
  pointer.x = 200; pointer.y = 499;
  callback(42016); assert.equal(scrollTop, 0, 'no scroll outside table horizontally');
  stop(); assert.equal(cancelled, true);
  const before = frames; callback(42032); assert.equal(frames, before);
});

test('center and outside positions do not scroll; edge speed increases toward boundary', () => {
  assert.equal(dragScrollSpeed(250, 0, 500), 0);
  assert.equal(dragScrollSpeed(501, 0, 500), 0);
  assert.equal(dragScrollSpeed(-1, 0, 500), 0);
  assert.ok(dragScrollSpeed(490, 0, 500) > dragScrollSpeed(450, 0, 500));
  assert.ok(dragScrollSpeed(10, 0, 500) < 0);
});
