import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getHistorySwipeDirection,
  HISTORY_SWIPE_MAX_DURATION_MS,
  HISTORY_SWIPE_MIN_DISTANCE,
} from '../src/lib/mobile-history-swipe.ts';

const layout = fs.readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');

test('right and left horizontal swipes map to browser back and forward', () => {
  assert.equal(getHistorySwipeDirection({ deltaX: 96, deltaY: 12, durationMs: 300 }), 'back');
  assert.equal(getHistorySwipeDirection({ deltaX: -96, deltaY: 12, durationMs: 300 }), 'forward');
});

test('short, slow, and mostly vertical gestures do not navigate', () => {
  assert.equal(getHistorySwipeDirection({ deltaX: HISTORY_SWIPE_MIN_DISTANCE - 1, deltaY: 0, durationMs: 300 }), null);
  assert.equal(getHistorySwipeDirection({ deltaX: 120, deltaY: 0, durationMs: HISTORY_SWIPE_MAX_DURATION_MS + 1 }), null);
  assert.equal(getHistorySwipeDirection({ deltaX: 90, deltaY: 80, durationMs: 300 }), null);
});

test('the mobile history gesture is mounted once in the global site shell', () => {
  assert.match(layout, /import MobileHistorySwipe from '@\/components\/MobileHistorySwipe'/);
  assert.equal((layout.match(/<MobileHistorySwipe\s*\/>/g) || []).length, 1);
});
