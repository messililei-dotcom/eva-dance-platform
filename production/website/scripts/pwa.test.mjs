import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
const worker = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const provider = fs.readFileSync(new URL('../src/components/PWAProvider.tsx', import.meta.url), 'utf8');

test('manifest exposes an installable standalone app', () => {
  assert.equal(manifest.display, 'standalone');
  assert.ok(!manifest.display_override?.includes('window-controls-overlay'));
  assert.equal(manifest.start_url, '/dashboard/profile?source=pwa');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('service worker keeps background cache refreshes alive and migrates old caches', () => {
  assert.match(worker, /const VERSION = 'swod-pwa-v[0-9]+[^']*'/);
  assert.match(worker, /const STATIC_CACHE = `\$\{VERSION\}-static`/);
  assert.match(worker, /const PAGE_CACHE = `\$\{VERSION\}-pages`/);
  assert.match(worker, /event\.waitUntil\(updateCache\)/);
  assert.match(worker, /await cache\.put\(request, copy\)/);
  assert.match(worker, /key !== STATIC_CACHE && key !== PAGE_CACHE/);
  assert.match(worker, /client\.navigate\(client\.url\)/);
});

test('all declared local assets exist', () => {
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(new URL(`../public${icon.src}`, import.meta.url)), icon.src);
  }
  assert.ok(fs.existsSync(new URL('../public/offline.html', import.meta.url)));
});

test('service worker excludes learning, authenticated and API surfaces', () => {
  for (const path of ['/api/', '/courses', '/dashboard', '/profile', '/my-courses', '/login', '/register']) {
    assert.match(worker, new RegExp(path.replaceAll('/', '\\/')));
  }
  assert.match(worker, /private\|no-store/);
  assert.match(worker, /notificationclick/);
});

test('an updated service worker reloads an already controlled page once', () => {
  assert.match(provider, /addEventListener\('controllerchange', handleControllerChange\)/);
  assert.match(provider, /if \(disposed \|\| refreshing \|\| !hadController\) return/);
  assert.match(provider, /window\.location\.reload\(\)/);
  assert.match(provider, /removeEventListener\('controllerchange', handleControllerChange\)/);
});

test('existing mobile PWA installs migrate the legacy course launch to personal home', () => {
  assert.match(provider, /current === PWA_COURSES_PATH/);
  assert.match(provider, /window\.location\.replace\(PWA_HOME_PATH\)/);
});
