import test from 'node:test';
import assert from 'node:assert/strict';
import { activeMobileTab } from '../src/lib/mobile-app-navigation.ts';
test('personal results retain the account tab while public events use the event tab',()=>{
 assert.equal(activeMobileTab('/dashboard/events'),'profile');assert.equal(activeMobileTab('/events/2026'),'events');assert.equal(activeMobileTab('/events-news/archive'),'events');
});
test('course deep links, period balances and store deep links retain their primary tab',()=>{
 assert.equal(activeMobileTab('/courses/71/videos'),'academy');assert.equal(activeMobileTab('/offline/900001'),'offline');assert.equal(activeMobileTab('/shop/orders'),'shop');assert.equal(activeMobileTab('/my-courses'),'profile');
});
test('brand content remains accessible without a false selected primary tab',()=>{
 assert.equal(activeMobileTab('/about'),null);assert.equal(activeMobileTab('/contact'),null);assert.equal(activeMobileTab('/'),'academy');
});
