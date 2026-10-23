import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../src/app/enroll/page.tsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../src/app/api/public/offline-courses/route.ts', import.meta.url), 'utf8');

test('报名页使用免费咨询报名文案并读取数字化平台线下课程', () => {
  assert.match(page, />\s*免费咨询报名\s*</);
  assert.match(page, /getPublicOfflineCourseOptions\(\)/);
  assert.match(page, /course\.source_id \|\| course\.sourceId \|\| course\.platformCourseId \|\| course\.id/);
  assert.match(page, /课程列表实时同步自伊娃东方舞数字化平台/);
  assert.match(page, /请选择线下课程/);
  assert.match(page, /courses\.map/);
});

test('免费咨询通过官网同源接口提交姓名、手机号和咨询项目', () => {
  assert.match(page, /courseId: formData\.courseId/);
  assert.match(api, /fetch\('\/api\/public\/enroll'/);
  assert.match(api, /courseId: string \| number/);
  assert.match(api, /fetch\('\/api\/public\/offline-courses'/);
  assert.match(route, /Array\.isArray\(payload\)/);
  assert.match(route, /success: true, data: courses/);
});
