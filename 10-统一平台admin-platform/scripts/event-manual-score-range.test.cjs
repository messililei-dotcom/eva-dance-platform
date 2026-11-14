const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function setup(auth = true) {
  const writes = [];
  const db = {
    prepare(sql) { return {
      get() {
        if (sql.includes('FROM event_groups')) return { id: 1, competition_id: 10 };
        if (sql.includes('FROM event_players')) return { id: 2, group_id: 1, audit_status: 'approved', status: 'approved' };
        if (sql.includes('FROM event_rankings')) return { id: 3, raw_total: 10, calculated_total: 10 };
        throw Error('Unexpected query: ' + sql);
      },
      run(...args) { writes.push({ sql, args }); },
    }; },
    transaction(fn) { return fn; },
  };
  const module = { exports: {} };
  const source = fs.readFileSync('src/app/api/event/results/route.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '../_db') return {
      hasAuth: () => auth,
      unauthorized: () => Response.json({ success: false }, { status: 401 }),
      jsonError: (error, status = 400) => Response.json({ success: false, error }, { status }),
      readEventBody: request => request.json(),
      toNumber: value => Number(value) || 0,
      cleanText: (value, fallback = '') => String(value || fallback).trim(),
      nowIso: () => '2026-11-13T00:00:00.000Z',
      withRequestEventDb: (_request, fn) => fn(db),
      rerankGroupRankings: () => {}, mapRanking: row => row,
    };
    if (name.includes('event-player-avatars')) return {};
    if (name.endsWith('/inbox')) return {};
    throw Error('Unexpected dependency: ' + name);
  }, module, module.exports);
  const patch = (finalScore, action = 'set_manual_score') => module.exports.PATCH(new Request('https://admin.test/api/event/results', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId: 1, playerId: 2, action, finalScore, reason: 'Range regression test' }),
  }));
  return { patch, writes };
}
test('reject out-of-range manual final scores before any ranking or audit write', async () => {
  for (const value of [20, 10.01, 0, 0.99, -1, 'NaN', '', null, undefined]) {
    const s = setup(); const response = await s.patch(value);
    assert.equal(response.status, 400, 'must reject ' + String(value));
    assert.equal(s.writes.length, 0);
    assert.match((await response.json()).error, /1.*10/);
  }
});
test('accept boundaries and decimal manual scores while preserving audit writes', async () => {
  for (const value of [1, 8.75, 10]) {
    const s = setup(); assert.equal((await s.patch(value)).status, 200);
    const update = s.writes.find(item => item.sql.includes('SET calculated_total = ?, manual_total = ?'));
    assert.deepEqual(update.args.slice(0, 2), [value, value]);
    assert.ok(s.writes.some(item => item.sql.includes('INSERT INTO event_score_audit_logs')));
  }
});
test('clear manual override restores the stored judge average', async () => {
  const s = setup(); assert.equal((await s.patch(undefined, 'clear_manual_score')).status, 200);
  assert.ok(s.writes.some(item => item.sql.includes('SET calculated_total = raw_total, manual_total = NULL')));
});
test('unauthenticated callers cannot write a manual score', async () => {
  const s = setup(false); assert.equal((await s.patch(8)).status, 401); assert.equal(s.writes.length, 0);
});
