import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getMobileCourseVideoPath,
  isMobileOrTabletUserAgent,
} from '../src/lib/mobile-course-navigation.ts';

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const androidTablet = 'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const modernIpad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

test('recognizes phones, Android tablets, and modern iPadOS', () => {
  assert.equal(isMobileOrTabletUserAgent(iphone), true);
  assert.equal(isMobileOrTabletUserAgent(androidTablet), true);
  assert.equal(isMobileOrTabletUserAgent(modernIpad), true);
  assert.equal(isMobileOrTabletUserAgent(desktop), false);
});

test('mobile and tablet course introductions go directly to the video player', () => {
  assert.equal(getMobileCourseVideoPath('/courses/12', iphone), '/courses/12/videos');
  assert.equal(getMobileCourseVideoPath('/courses/D2/', modernIpad), '/courses/D2/videos');
});

test('desktop course introductions and non-introduction routes stay unchanged', () => {
  assert.equal(getMobileCourseVideoPath('/courses/12', desktop), null);
  assert.equal(getMobileCourseVideoPath('/courses', iphone), null);
  assert.equal(getMobileCourseVideoPath('/courses/12/videos', iphone), null);
  assert.equal(getMobileCourseVideoPath('/offline/12', iphone), null);
});
