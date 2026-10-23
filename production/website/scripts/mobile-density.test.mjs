import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const globals = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const scrollAnimation = fs.readFileSync(new URL('../src/components/ScrollAnimation.tsx', import.meta.url), 'utf8');

test('mobile heroes use the shared compact navigation-safe spacing', () => {
  assert.match(globals, /section:first-child\.pt-44[\s\S]*section:first-child\.pt-20[\s\S]*padding-top: calc\(env\(safe-area-inset-top\) \+ 4\.75rem\) !important;/);
  assert.match(globals, /section:first-child\.pb-24[\s\S]*section:first-child\.pb-10[\s\S]*padding-bottom: 2rem !important;/);
});

test('mobile content rhythm compacts section, card and stack whitespace', () => {
  assert.match(globals, /section\.py-20[\s\S]*section\.py-16[\s\S]*padding-top: 1\.75rem !important;/);
  assert.match(globals, /div\.min-h-screen\.py-12:not\(\.flex\)[\s\S]*padding-top: calc\(env\(safe-area-inset-top\) \+ 4\.75rem\) !important;/);
  assert.match(globals, /div\.py-20[\s\S]*padding-top: 1\.75rem !important;/);
  assert.match(globals, /\.site-main \.p-12[\s\S]*padding: 1rem !important;/);
  assert.match(globals, /\.site-main \.mt-14[\s\S]*margin-top: 1rem !important;/);
  assert.match(globals, /\.site-main \.space-y-10[\s\S]*margin-top: 1rem !important;/);
});

test('scroll content remains visible when a browser lacks IntersectionObserver', () => {
  assert.match(scrollAnimation, /typeof IntersectionObserver === 'undefined'[\s\S]*el\.classList\.add\('is-visible'\)/);
});
