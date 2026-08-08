import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const page = read('src/app/(admin)/members/page.tsx');
const directory = read('src/app/api/members/directory/route.ts');

test('学员页使用正确统计卡和万元格式', () => {
  assert.match(page, /累计消费/);
  assert.match(page, /toFixed\(2\).*万/);
  assert.doesNotMatch(page, /title="高价值学员"/);
  assert.doesNotMatch(page, /title="人均消费"/);
});

test('学员列表显示统一身份字段', () => {
  assert.match(page, /title: 'Member ID'/);
  assert.match(page, /title: '微信ID'/);
  assert.doesNotMatch(page, /title: '最近活动'/);
  assert.match(directory, /wx_openid/);
  assert.match(directory, /wx_unionid/);
});

