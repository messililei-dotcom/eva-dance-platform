import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => mocks[name], module, module.exports);
  return module.exports;
}
const policy = load('../src/lib/admin-feature-access.ts');
const { competitionOwner } = load('../src/app/api/event/_competition-owner.ts', {
  '@/lib/admin-feature-access': policy, './_access': { eventActor: request => request.actor },
});
const users = [{id: 1, username:'lilei', role:'admin', status:'active'},
  {id:2, username:'event', role:'event_admin',status:'active'},
  {id:3, username:'teacher',role:'teacher',status:'active'},
  {id:4, username:'disabled',role:'event_admin',status:'disabled'}];
const db = { prepare: () => ({get: id => users.find(user => user.id === id)}) };
test('ownership omitted preserves current owner for any actor', () => {
  assert.deepEqual(competitionOwner({actor:users[1]}, db, {}, 9), {id:9});
});
test('only super administrator may explicitly assign an enabled event administrator', () => {
  assert.deepEqual(competitionOwner({actor:users[0]}, db, {ownerUserId:2}, 1), {id:2});
  for (const actor of [null, users[1], users[2], {role:'admin',username:'ordinary'}]) {
    assert.equal(competitionOwner({actor}, db, {ownerUserId:2}, 1).status, 403);
  }
  for (const ownerUserId of [0,-1,1.5,3,4,99,'invalid',null]) {
    assert.equal(competitionOwner({actor:users[0]}, db, {ownerUserId}, 1).status, 400);
  }
});
