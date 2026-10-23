import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCourseVideoHref,
  getPlatformSeriesIdForLegacyCourse,
  LEGACY_COURSE_SERIES_MAPPINGS,
} from '../src/lib/course-series-ids.ts';

const expectedMappings = new Map([
  ['1', 1],
  ['2', 10],
  ['3', 3],
  ['4', 4],
  ['5', 5],
  ['6', 6],
  ['7', 12],
  ['8', 7],
  ['9', 14],
  ['10', 8],
  ['11', 15],
  ['12', 16],
  ['13', 17],
  ['14', 18],
  ['15', 19],
  ['16', null],
  ['17', null],
  ['D1', null],
  ['D2', 26],
  ['D3', 23],
  ['D4', 21],
]);

test('all 21 historic video entries have an explicit mapping decision', () => {
  assert.equal(LEGACY_COURSE_SERIES_MAPPINGS.length, 21);
  assert.deepEqual(
    new Map(LEGACY_COURSE_SERIES_MAPPINGS.map((item) => [item.legacyCourseId, item.platformSeriesId])),
    expectedMappings,
  );
});

for (const [legacyCourseId, platformSeriesId] of expectedMappings) {
  test(`legacy entry ${legacyCourseId} resolves without numeric-ID collision`, () => {
    assert.equal(getPlatformSeriesIdForLegacyCourse(legacyCourseId), platformSeriesId);
    const href = getCourseVideoHref({ courseId: legacyCourseId });

    if (platformSeriesId === null) {
      assert.equal(href, `/courses/${legacyCourseId}/videos`);
      return;
    }

    assert.equal(href, `/courses/${platformSeriesId}/videos?source=platform`);
  });
}

test('an explicit platform series ID wins over a legacy mapping', () => {
  assert.equal(
    getCourseVideoHref({ courseId: 7, legacyCourseId: 8, platformSeriesId: 7, videoId: 99 }),
    '/courses/7/videos?source=platform&video=99',
  );
});

