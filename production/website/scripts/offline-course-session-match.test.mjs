import assert from 'node:assert/strict';
import test from 'node:test';

import { courseRecordMatches, getCourseStatus } from '../src/lib/course-match.ts';

const platformCourse = {
  id: '125',
  title: '国际技巧超魔班',
  description: '',
  fullDescription: '',
  price: 0,
  image: '',
  category: 'offline',
  type: '集训',
  instructor: '伊娃',
  duration: '20课次',
  level: '全级别',
  outline: [],
  officialMatchKey: '20',
};

test('platform periods match their parent course through the canonical course key', () => {
  assert.equal(courseRecordMatches({
    id: 132,
    name: '国际技巧超魔班（2026）',
    officialMatchKey: '20',
    subType: '2026年第一期',
  }, platformCourse), true);
});

test('records from another platform course do not match', () => {
  assert.equal(courseRecordMatches({
    id: 123,
    name: 'AlidaLin林亦洛大师班',
    officialMatchKey: '22',
    subType: '2027年',
  }, platformCourse), false);
});

test('inactive and past periods are closed while future active periods stay open', () => {
  assert.equal(getCourseStatus({ status: 'inactive' }), 'ended');
  assert.equal(getCourseStatus({ status: 'active', endDate: '2020-01-01' }), 'ended');
  assert.equal(getCourseStatus({ status: 'active', endDate: '2099-01-01' }), 'open');
  assert.equal(getCourseStatus({
    status: 'active',
    startDate: '2027-03-06',
    endDate: '2026-03-25',
  }), 'open');
});
