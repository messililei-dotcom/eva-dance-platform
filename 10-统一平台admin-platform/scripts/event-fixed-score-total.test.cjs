const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function setup(existing = false, auth = true) {
  const writes = [];
  const db = {
    prepare(sql) { return {
      all: () => existing ? [{ id: 7 }] : [],
      run(...args) { writes.push({ sql, args }); return { lastInsertRowid: 7 }; },
    }; },
    transaction: fn => fn,
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/app/api/event/score-rules/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    assert.equal(name, '../_db');
    return {
      hasAuth: () => auth,
      unauthorized: () => Response.json({ success: false }, { status: 401 }),
      jsonError: (error, status = 400) => Response.json({ success: false, error }, { status }),
      readEventBody: request => request.json(),
      cleanText: (value, fallback = '') => String(value || fallback).trim(),
      toNumber: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
      nowIso: () => '2026-11-13T00:00:00.000Z',
      withRequestEventDb: (_request, fn) => fn(db),
    };
  }, module, module.exports);
  const post = payload => module.exports.POST(new Request('https://admin.test/api/event/score-rules', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competitionId: 10, name: '赛事评分规则', ...payload }),
  }));
  return { post, writes };
}
test('reject changing the fixed total through either API field without writes', async () => {
  for (const field of ['totalScore', 'total_score']) for (const value of [0, 1, 9, 10.01, 20, 100, 'invalid']) {
    const s = setup(); assert.equal((await s.post({ [field]: value })).status, 400);
    assert.equal(s.writes.length, 0);
  }
});
test('new and existing rules always save a total of 10, including omitted total', async () => {
  for (const existing of [false, true]) for (const payload of [{}, { totalScore: 10 }, { total_score: 10 }]) {
    const s = setup(existing); assert.equal((await s.post(payload)).status, 200);
    const write = s.writes.find(item => /(?:INSERT INTO|UPDATE) event_score_rules/.test(item.sql));
    assert.equal(write.args[existing ? 1 : 2], 10);
    assert.ok(s.writes.some(item => item.sql.includes('UPDATE event_groups SET score_rule_id')));
  }
});
test('unauthenticated callers cannot change a rule', async () => {
  const s = setup(false, false); assert.equal((await s.post({ totalScore: 10 })).status, 401); assert.equal(s.writes.length, 0);
});
