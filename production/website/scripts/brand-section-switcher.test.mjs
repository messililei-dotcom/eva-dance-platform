import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const switcher = read('src/components/BrandSectionSwitcher.tsx');
const aboutPage = read('src/app/about/page.tsx');
const shopPage = read('src/app/shop/storefront.tsx');

test('brand section switcher links culture and Eva selection in both directions', () => {
  assert.match(switcher, /label: '品牌文化', href: '\/about'/);
  assert.match(switcher, /label: '伊娃甄选', href: '\/shop\/selection'/);
  assert.match(switcher, /aria-label="品牌栏目选择"/);
  assert.match(switcher, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(aboutPage, /<BrandSectionSwitcher active="culture" \/>/);
  assert.match(shopPage, /<BrandSectionSwitcher active="selection" \/>/);
});
