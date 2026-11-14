import assert from 'node:assert/strict';
import test from 'node:test';
import { enterCourseStageFullscreen, courseFullscreenElement, exitCourseStageFullscreen, orientCourseFullscreen, unlockCourseOrientation } from '../src/lib/course-stage-fullscreen.ts';

test('fullscreen prefers the stage and falls back without replacing media', async () => {
  let standard = 0, prefixed = 0;
  const stage = {requestFullscreen: async () => standard++, webkitRequestFullscreen: async () => prefixed++};
  assert.equal(await enterCourseStageFullscreen(stage), 'native');
  assert.equal(standard, 1); assert.equal(prefixed, 0);
  assert.equal(await enterCourseStageFullscreen(stage, true), 'page');
  assert.equal(standard, 1);
  assert.equal(await enterCourseStageFullscreen({requestFullscreen: async () => {throw Error('denied');}}), 'page');
  assert.equal(await enterCourseStageFullscreen({}), 'page');
});
test('WebKit entry, state and exit use the same prefixed API path', async () => {
  let entered = 0, exited = 0;
  const stage = {webkitRequestFullscreen: () => entered++};
  assert.equal(await enterCourseStageFullscreen(stage), 'native');
  const doc = {fullscreenElement:null, webkitFullscreenElement:stage, webkitExitFullscreen: () => exited++};
  assert.equal(courseFullscreenElement(doc), stage);
  await exitCourseStageFullscreen(doc);
  assert.equal(entered,1); assert.equal(exited,1);
});
test('standard exit rejects honestly and never enters another fullscreen', async () => {
  let exited = 0;
  await exitCourseStageFullscreen({fullscreenElement:{},exitFullscreen:async()=>exited++});
  assert.equal(exited,1);
  await assert.rejects(exitCourseStageFullscreen({fullscreenElement:{},exitFullscreen:async()=>{throw Error('denied');}}), /denied/);
  assert.equal(courseFullscreenElement({}),null);
});
test('both directions lock explicitly; denial and absent APIs return a usable fallback', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'screen');
  const calls = [];
  try {
    Object.defineProperty(globalThis,'screen',{configurable:true,value:{orientation:{lock:async value=>calls.push(value),unlock:()=>calls.push('unlock')}}});
    assert.equal(await orientCourseFullscreen('landscape'),true);
    assert.equal(await orientCourseFullscreen('portrait'),true);
    unlockCourseOrientation();
    assert.deepEqual(calls,['landscape','portrait','unlock']);
    screen.orientation.lock=async()=>{throw Error('not allowed');};
    assert.equal(await orientCourseFullscreen('landscape'),false);
    screen.orientation={};
    assert.equal(await orientCourseFullscreen('portrait'),false);
    assert.doesNotThrow(unlockCourseOrientation);
  } finally {
    if(previous)Object.defineProperty(globalThis,'screen',previous);else delete globalThis.screen;
  }
});
