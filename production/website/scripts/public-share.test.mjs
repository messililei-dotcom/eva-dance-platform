import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicShareUrl } from '../src/lib/public-share.ts';
test('lesson keeps only public series and video selection', () => {
 assert.equal(publicShareUrl('https://www.swod.com.cn/courses/10/videos?source=platform&video=535&token=secret&code=oauth#player','https://www.swod.com.cn/courses/10'), 'https://www.swod.com.cn/courses/10/videos?source=platform&video=535');
});
test('legacy course IDs retain their original semantics', () => {
 assert.equal(publicShareUrl('https://www.swod.com.cn/courses/10/videos?video=535&source=other'), 'https://www.swod.com.cn/courses/10/videos?video=535');
});
test('private pages use public landing, never login or member query', () => {
 assert.equal(publicShareUrl('https://www.swod.com.cn/dashboard/profile?token=x','https://www.swod.com.cn/'), 'https://www.swod.com.cn/');
});
test('article and product identities survive while tracking is stripped', () => {
 for(const path of ['/dance-circle/news-1','/shop/products/sku-1']) assert.equal(publicShareUrl('https://www.swod.com.cn'+path+'?from=timeline#detail'), 'https://www.swod.com.cn'+path);
});
test('invalid lesson IDs and foreign canonical URLs are rejected', () => {
 assert.equal(publicShareUrl('https://www.swod.com.cn/courses/10/videos?video=javascript:abc'), 'https://www.swod.com.cn/courses/10/videos');
 assert.equal(publicShareUrl('https://www.swod.com.cn/', 'https://attacker.example/path'), 'https://www.swod.com.cn/');
});
