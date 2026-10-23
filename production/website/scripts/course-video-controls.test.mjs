import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isIntentionalVerticalPlaybackGesture,
  playbackLevelFromVerticalDrag,
} from '../src/lib/course-video-controls.ts';

test('vertical drag raises values upward and clamps them to the allowed range', () => {
  assert.equal(playbackLevelFromVerticalDrag(0.5, 300, 240, 200, 0, 1), 1);
  assert.equal(playbackLevelFromVerticalDrag(0.5, 300, 420, 200, 0, 1), 0);
  assert.equal(playbackLevelFromVerticalDrag(1, 300, 270, 200, 0.4, 1.4), 1.25);
});

test('gesture intent keeps taps and horizontal movement separate from vertical controls', () => {
  assert.equal(isIntentionalVerticalPlaybackGesture(0, 6), false);
  assert.equal(isIntentionalVerticalPlaybackGesture(20, 14), false);
  assert.equal(isIntentionalVerticalPlaybackGesture(5, 14), true);
  assert.equal(isIntentionalVerticalPlaybackGesture(8, -24), true);
});

test('player keeps the default playback source and renders its label without a select box', async () => {
  const source = await readFile(new URL('../src/app/courses/[id]/videos/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /const initialUrl = normalizeVodPlaybackUrl\(playData\.video_url \|\| options\[0\]\?\.url \|\| ''\)/);
  assert.match(source, /setQualityLabel\(initialQuality\?\.label \|\| '标清'\)/);
  assert.match(source, /当前清晰度：\$\{qualityLabel\}/);
  assert.doesNotMatch(source, /aria-label="选择视频清晰度"/);
  assert.match(source, /aria-label="切换视频清晰度"/);
  assert.match(source, /onClick=\{\(\) => changeQuality\(option\.value\)\}/);
  assert.match(source, /pendingQualitySwitchRef\.current/);
  assert.match(source, /onPointerDown=\{startPlaybackGesture\}/);
  assert.match(source, /touchAction: 'pan-x'/);
  assert.doesNotMatch(source, /className="absolute bottom-\[18%\]/);
  assert.match(source, /<span>进度 \{completionPercent\}%<\/span>/);
  assert.match(source, />\s*续播\s*<\/button>/);
  assert.doesNotMatch(source, /继续上一次学习/);
});

test('mobile toolbar stays on one row and search receives remaining width', async () => {
  const source = await readFile(new URL('../src/app/courses/[id]/videos/page.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: 2\.5rem max-content minmax\(0, 1fr\)/);
  assert.match(css, /\.course-video-toolbar-actions \{[\s\S]*?flex-wrap: nowrap !important/);
  assert.match(css, /\.course-video-toolbar-search \{[\s\S]*?grid-column: auto;[\s\S]*?min-width: 0/);
  assert.doesNotMatch(css, /\.course-video-toolbar-search \{[\s\S]*?grid-column: 1 \/ -1/);
  assert.doesNotMatch(source, /focus-within:ring/);
  assert.match(css, /\.course-video-toolbar-search input:focus \{[\s\S]*?outline: none !important;[\s\S]*?box-shadow: none !important/);
});

test('lesson switching stays local and the active catalogue position is preserved', async () => {
  const source = await readFile(new URL('../src/app/courses/[id]/videos/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /window\.history\.replaceState\(window\.history\.state, '', nextHref\)/);
  assert.doesNotMatch(source, /scrollToLearningTop/);
  assert.match(source, /aria-current=\{active \? 'true' : undefined\}/);
  assert.match(source, /const active = \(chapter\.videos \|\| \[\]\)\.some/);
});

test('player provides previous, next, autoplay countdown, cancellation and loop modes', async () => {
  const source = await readFile(new URL('../src/app/courses/[id]/videos/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label="播放上一节"/);
  assert.match(source, /aria-label="播放下一节"/);
  assert.match(source, />\s*取消连播\s*<\/button>/);
  assert.match(source, /type PlaybackMode = 'sequential' \| 'single-loop' \| 'course-loop'/);
  assert.match(source, /PLAYBACK_MODE_STORAGE_KEY/);
  assert.match(source, /onEnded=\{\(event\) => handlePlaybackEnded\(event\.currentTarget, activeVideoId\)\}/);
  assert.match(source, /saveProgress\(true, true, \{/);
  assert.match(source, /videoId: activeVideoId,[\s\S]*?currentTime: event\.currentTarget\.currentTime/);
  assert.match(source, /showVideoActions \|\| autoplayCountdown/);
});

test('custom controls toggle with the native player and button clicks do not hide the layer', async () => {
  const source = await readFile(new URL('../src/app/courses/[id]/videos/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /const toggleVideoActions = useCallback/);
  assert.match(source, /if \(visible\) return false/);
  assert.match(source, /event\.target\.closest\('button'\)\) return/);
  assert.match(source, /toggleVideoActions\(\)/);
  assert.doesNotMatch(source, /onPointerDown=\{revealVideoActions\}/);
  assert.doesNotMatch(source, /onPointerMove=\{revealVideoActions\}/);
  assert.doesNotMatch(source, /group-hover:pointer-events-auto/);
});

test('fullscreen keeps native controls and speed choices stay within the approved set', async () => {
  const source = await readFile(new URL('../src/app/courses/[id]/videos/page.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  assert.match(source, /const PLAYBACK_RATE_OPTIONS = \[0\.75, 1, 1\.25, 2\] as const/);
  assert.match(source, /video\.controls = true/);
  assert.match(source, /if \(document\.fullscreenElement === stage && document\.exitFullscreen\)[\s\S]*?await document\.exitFullscreen\(\)[\s\S]*?return;/);
  assert.match(source, /Never turn an exit failure into a second fullscreen/);
  assert.match(source, /if \(stage\.requestFullscreen\)/);
  assert.match(source, /else if \(video\.requestFullscreen\)/);
  assert.ok(source.indexOf('if (stage.requestFullscreen)') < source.indexOf('else if (video.requestFullscreen)'));
  assert.match(source, /isCourseFullscreen \? '退出全屏播放' : '横屏全屏播放'/);
  assert.match(source, /video\.defaultPlaybackRate = playbackRate/);
  assert.match(source, /video\.playbackRate = playbackRate/);
  assert.match(source, /aria-label="调整播放速度"/);
  assert.match(css, /\.course-video-player-card video:fullscreen,[\s\S]*?height: 100dvh;[\s\S]*?object-fit: contain/);
});

test('player switches between front-facing and mirrored playback without replacing the source', async () => {
  const source = await readFile(new URL('../src/app/courses/[id]/videos/page.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  assert.match(source, /const \[isMirrored, setIsMirrored\] = useState\(false\)/);
  assert.match(source, /const toggleMirrorPlayback = \(\) =>/);
  assert.match(source, /setIsMirrored\(mirrored => !mirrored\)/);
  assert.match(source, /aria-pressed=\{isMirrored\}/);
  assert.match(source, /\{isMirrored \? '镜面' : '正面'\}/);
  assert.match(source, /transform: isMirrored \? 'scaleX\(-1\)' : undefined/);
  assert.match(source, /isMirrored \? 'course-video-mirrored' : ''/);
  assert.match(css, /\.course-video-mirrored::\-webkit-media-controls-panel \{[\s\S]*?transform: scaleX\(-1\)/);
});
