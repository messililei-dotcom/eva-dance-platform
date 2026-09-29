import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const cache = read('src/lib/server/vod-play-cache.ts');
const playRoute = read('src/app/api/mini/video/[id]/play/route.ts');

test('VOD playback URLs are briefly reused to keep Macau manifests warm', () => {
  assert.match(cache, /10 \* 60 \* 1000/);
  assert.match(cache, /Map<string, CacheEntry>/);
  assert.match(cache, /promise: Promise<VodPlayOption\[\]>/);
  assert.match(cache, /playOptionsCache\.delete\(key\)/);
  assert.match(playRoute, /getCachedVodPlayOptions/);
  assert.doesNotMatch(playRoute, /getVodPlayOptions\(String\(video\.vod_video_id\)\)/);
});
