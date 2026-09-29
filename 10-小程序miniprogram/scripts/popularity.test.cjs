const test = require('node:test');
const assert = require('node:assert/strict');
const { popularityValue, stableStudentBase } = require('../shared/popularity');
test('student display preserves configured stable base while following backend counts', () => {
  const item = { id: 6, name: '课程', total_students: 37 };
  const base = stableStudentBase(item);
  assert.ok(base >= 500 && base <= 1000);
  assert.equal(popularityValue(item), 37 + base);
  assert.equal(popularityValue({...item, total_students: 38}), 38 + base);
  assert.equal(stableStudentBase(item), base);
  assert.equal(popularityValue({...item, student_display_base: 623}), 660);
});
