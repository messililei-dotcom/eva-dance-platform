const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Execute the actual React effect with a deterministic media element and clock.
const source = fs.readFileSync(path.join(__dirname, '../src/components/media/AdaptiveCourseVideo.tsx'), 'utf8');
const effect = source.slice(source.indexOf('  useEffect(() => {') + '  useEffect(() => {'.length, source.indexOf('  }, [src, videoRef]);'))
  .replace(/: Hls \| null/g, '').replace(/: \(\(\) => void\) \| null/g, '');
function mount({ native = true } = {}) {
  let nextTimer = 0;
  const timers = new Map();
  const listeners = new Map();
  const video = {
    currentTime: 321, paused: false, ended: false, readyState: 2, loads: 0,
    appendChild() {}, canPlayType: () => native ? 'probably' : '',
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler); },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); },
    load() { this.loads++; this.currentTime = 0; },
    play() { this.paused = false; return Promise.resolve(); },
  };
  let starts = 0;
  class Hls {
    static isSupported() { return true; }
    static Events = { ERROR: 'error' };
    loadSource() {} attachMedia() {} on() {} stopLoad() {} destroy() {}
    startLoad() { starts++; }
  }
  const cleanup = vm.runInNewContext(`(function() {${effect}})()`, {
    videoRef: { current: video }, src: 'https://example.test/lesson.m3u8', Hls,
    isHlsSource: () => true, remotePlaybackSourceType: () => 'application/vnd.apple.mpegurl',
    stopAndReleaseCourseMedia() {}, HTMLMediaElement: { HAVE_FUTURE_DATA: 3 }, ErrorTypes: {},
    document: { createElement: () => ({ dataset: {}, remove() {} }) },
    window: { setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout(id) { timers.delete(id); } },
  });
  video.currentTime = 321; // Already watching, initial load is complete.
  const initialLoads = video.loads;
  return { video, cleanup, emit(name) { for (const fn of listeners.get(name) || []) fn(); },
    tick() { const pending = [...timers.values()]; timers.clear(); for (const fn of pending) fn(); },
    reloads: () => video.loads - initialLoads, starts: () => starts };
}
test('native HLS network stall never clears the current frame or jumps to zero', () => {
  const player = mount();
  player.emit('waiting'); player.tick();
  assert.equal(player.reloads(), 0, 'ordinary buffering must not call video.load() and reset to zero');
  assert.equal(player.video.currentTime, 321);
  player.emit('playing'); player.emit('stalled'); player.tick();
  assert.equal(player.video.currentTime, 321);
  player.cleanup();
});
test('HLS.js can retry a stalled network without resetting the media element', () => {
  const player = mount({ native: false });
  player.emit('waiting'); player.tick();
  assert.equal(player.starts(), 1);
  assert.equal(player.reloads(), 0);
  assert.equal(player.video.currentTime, 321);
  player.cleanup();
});
test('healthy playback and teardown cancel a pending retry', () => {
  const player = mount({ native: false });
  player.emit('waiting'); player.emit('playing'); player.tick();
  assert.equal(player.starts(), 0);
  player.emit('waiting'); player.cleanup(); player.tick();
  assert.equal(player.starts(), 0);
});
