import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);

test('event clients match the existing production endpoints and preserve request bodies and pagination', async () => {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name === '@/lib/logger' ? { devWarn() {} } : require(name), module, module.exports);
  const { api, eventApi } = module.exports;
  let request;
  api.defaults.adapter = async config => {
    request = config;
    return { status: 200, data: { success: true, data: [{ id: 1 }], total: 51, page: 2, pageSize: 20 }, config, headers: {} };
  };
  assert.deepEqual(await eventApi.listGroupJudges({ groupId: 4 }), [{ id: 1 }]);
  assert.equal(request.url, '/event/group-judges');
  assert.deepEqual(request.params, { groupId: 4 });
  assert.deepEqual(await eventApi.listEventMembers(), [{ id: 1 }]);
  assert.equal(request.url, '/event/members');
  const page = await eventApi.listPlayersPage({ page: 2, pageSize: 20 });
  assert.equal(page.total, 51);
  assert.equal(page.page, 2);
  await eventApi.verifyData({ page: 3 });
  assert.deepEqual(request.params, { page: 3 });
  const payload = { competitionId: 1, groupId: 4, ids: [3], judgeIds: [5], playerId: 3, finalScore: 90 };
  for (const [method, verb, path, action] of [
    ['batchCreatePlayers', 'post', '/event/players/batch'],
    ['batchUpdatePlayers', 'patch', '/event/players/batch'],
    ['batchDeletePlayers', 'delete', '/event/players/batch'],
    ['randomizePlayerSequence', 'patch', '/event/players/batch', 'randomize_sequence'],
    ['batchUpdateGroupJudges', 'patch', '/event/group-judges'],
    ['batchDeleteGroupJudges', 'delete', '/event/group-judges'],
    ['setManualFinalScore', 'patch', '/event/results', 'set_manual_score'],
    ['clearManualFinalScore', 'patch', '/event/results', 'clear_manual_score'],
  ]) {
    assert.deepEqual(await eventApi[method](payload), [{ id: 1 }]);
    assert.equal(request.method, verb);
    assert.equal(request.url, path);
    assert.deepEqual(JSON.parse(request.data), action ? { ...payload, action } : payload);
  }
  await eventApi.deleteCompetition(1);
  assert.equal(request.url, '/event/competitions/1');
  await eventApi.deleteGroup(4);
  assert.equal(request.url, '/event/groups/4');
  await eventApi.exportData();
  assert.equal(request.url, '/event/data-transfer');
});
