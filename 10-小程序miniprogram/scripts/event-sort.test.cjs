const test = require('node:test');
const assert = require('node:assert/strict');
const {sortEventsNewestFirst} = require('../shared/event-sort');
test('newest competition comes first regardless of published or finished status', () => {
 const input=[{id:1,startDate:'2024-09-01',status:'published'},{id:2,startDate:'2026-08-01',status:'finished'},{id:3,startDate:'2026-12-01',status:'published'}];
 assert.deepEqual(sortEventsNewestFirst(input).map(x=>x.id),[3,2,1]);assert.deepEqual(input.map(x=>x.id),[1,2,3]);
});
test('same date uses descending competition ID and missing dates come last',()=>{
 const input=[{id:9,startDate:''},{id:2,startDate:'2026-10-01'},{id:4,start_date:'2026-10-01'},{id:8,startDate:'invalid'}];
 assert.deepEqual(sortEventsNewestFirst(input).map(x=>x.id),[4,2,9,8]);
});
test('member registrations sort by competition date and competition ID',()=>{
 assert.deepEqual(sortEventsNewestFirst([{id:90,competitionId:2,startDate:'2026-10-01'},{id:1,competitionId:3,startDate:'2026-10-01'}]).map(x=>x.competitionId),[3,2]);
 assert.deepEqual(sortEventsNewestFirst(null),[]);
});
