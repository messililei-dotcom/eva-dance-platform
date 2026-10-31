const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.resolve(__dirname, '../../../../10-统一平台admin-platform/node_modules/typescript'));
const moduleFixture = { exports: {} };
const source = fs.readFileSync(path.resolve(__dirname, '../entry/src/main/ets/services/EventPresentation.ets'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
new Function('module','exports',compiled.outputText)(moduleFixture,moduleFixture.exports);
const {eventCount,eventAggregate,eventDates,eventState}=moduleFixture.exports;
test('hidden and missing counts remain unknown, while a real zero stays zero',()=>{
 for(const value of [null,undefined,-1,NaN,Infinity,1.5]) assert.equal(eventCount(value),'未公开');
 assert.equal(eventCount(0),'0');
 assert.equal(eventAggregate([{playerCount:null}],true),'未公开');
 assert.equal(eventAggregate([{groupCount:0}],false),'—');
 assert.equal(eventAggregate([{approvedPlayerCount:0,playerCount:4}],true),'0');
});
test('the complete Shanghai end date stays open and expires the next day',()=>{
 const row={registrationStatus:'open',endDate:'2026-11-29'};
 assert.equal(eventState(row,Date.parse('2026-11-29T12:00:00Z')),'报名中');
 assert.equal(eventState(row,Date.parse('2026-11-29T16:00:00Z')),'已结束');
 assert.equal(eventDates({startDate:'2026-11-29',endDate:'2026-11-29'}),'2026-11-29');
});
test('cancelled and registration windows take priority over the open switch',()=>{
 const now=Date.parse('2026-11-29T12:00:00Z');
 assert.equal(eventState({status:'cancelled',registrationStatus:'open'},now),'已取消');
 assert.equal(eventState({registrationStatus:'open',registrationStart:'2026-12-01'},now),'报名未开始');
 assert.equal(eventState({registrationStatus:'open',registrationEnd:'2026-11-28'},now),'报名已截止');
 assert.equal(eventState({registrationStatus:'closed'},now),'报名未开放');
});

test('database local timestamps use Shanghai instead of device timezone',()=>{
 const now=Date.parse('2026-11-29T12:00:00Z');
 assert.equal(eventState({registrationStatus:'open',registrationStart:'2026-11-29 21:00:00'},now),'报名未开始');
 assert.equal(eventState({registrationStatus:'open',registrationEnd:'2026-11-29 19:59:59'},now),'报名已截止');
});
