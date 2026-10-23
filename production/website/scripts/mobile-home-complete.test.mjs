import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const homePage = read('src/app/page.tsx');
const globalStyles = read('src/app/globals.css');
const danceSection = read('src/components/sections/DanceCollectionSection.tsx');
const quickCardsSection = read('src/components/sections/QuickCardsSection.tsx');
const quickCardsConfig = read('src/config/navigation_v2.ts');
const sectionHeader = read('src/components/SectionHeader.tsx');
const offlineSection = read('src/components/sections/OfflineFeaturedSection.tsx');
const statsMapSection = read('src/components/sections/StatsMapSection.tsx');

const completeSections = [
  'StatsMapSection',
  'BrandStorySection',
  'QuickCardsSection',
  'PublicationSection',
  'EndorsementSection',
  'VideoCoursesSection',
  'DanceCollectionSection',
  'OfflineFeaturedSection',
  'DisciplesShowcaseSection',
  'LatestNewsSection',
  'CTASection',
];

test('mobile and desktop render the same complete homepage section set', () => {
  assert.match(homePage, /className="home-complete-shell"/);
  assert.doesNotMatch(homePage, /hidden md:block|mobile-home-shell|MobileLearningWindow/);

  for (const section of completeSections) {
    assert.match(homePage, new RegExp(`<${section}(?:\\s|\\/)`), `${section} should render on every viewport`);
  }
  assert.doesNotMatch(homePage, /StudentTransformationSection|她们的蜕变故事|学员蜕变/);
});

test('mobile homepage keeps every featured dance and all four quick cards visible', () => {
  assert.doesNotMatch(danceSection, /i\s*>=\s*2\s*\?\s*['"]hidden/);
  assert.match(quickCardsSection, /grid-cols-2/);
});

test('the first complete homepage section clears the fixed mobile navigation', () => {
  assert.match(globalStyles, /home-complete-shell[\s\S]*safe-area-inset-top[\s\S]*5\.25rem/);
});

test('brand pathway cards contain cultural, teaching, lineage and publishing content', () => {
  for (const content of [
    '东方舞文化根脉',
    'SWOD教学系统',
    '师资传承路径',
    '《东方舞技巧大全》',
  ]) {
    assert.match(quickCardsConfig, new RegExp(content));
  }
  assert.match(quickCardsSection, /品牌文化路径/);
  assert.match(quickCardsSection, /从文化理解走向教学传承/);
});

test('mobile section headers show their descriptions and use compact spacing', () => {
  assert.match(sectionHeader, /\{subtitle && \(/);
  assert.match(sectionHeader, /mb-4 md:mb-12/);
  assert.match(offlineSection, /py-6 md:py-12/);
  assert.match(offlineSection, /mb-4 grid grid-cols-2 gap-2\.5/);
});

test('mobile honors render as a fixed two-by-two grid without horizontal dragging', () => {
  assert.match(statsMapSection, /mb-5 grid grid-cols-2 gap-2/);
  assert.doesNotMatch(statsMapSection, /snap-x|snap-start|overflow-x-auto/);
});
