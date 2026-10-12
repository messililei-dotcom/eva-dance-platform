const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, req = require) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports;
}
const summary = load('src/lib/event-entry-summary.ts');
function setup({ auth = true, allowed = true } = {}) {
  let forwarded;
  const route = load('src/app/api/event/entry-summary/route.ts', name => {
    if (name === '../players/route') return { GET: async request => {
      forwarded = request;
      if (!allowed) return Response.json({ success: false, error: '无权限查看' }, { status: 403 });
      return Response.json({ success: true, data: [
        { id: 9, memberId: 1, name: '同一选手', groupId: 3, groupName: '成人 · 专业东方舞独舞', registrationFee: 299.99, registeredAt: '2026-10-11T02:00:00Z' },
        { id: 2, memberId: 1, name: '同一选手', groupId: 4, groupName: '成人 · 专业融合舞独舞', registrationFee: 100.01, registeredAt: '2026-10-11T01:00:00Z' },
        { id: 8, memberId: 2, name: '另一选手', groupId: 3, registrationFee: 150, registeredAt: '2026-10-11T01:30:00Z' },
      ] });
    } };
    if (name.endsWith('event-entry-summary')) return summary;
    if (name === '../_db') return { hasAuth: () => auth, cleanText: value => String(value || '').trim(), jsonError: (error, status = 400) => Response.json({ success: false, error }, { status }), unauthorized: () => Response.json({ success: false }, { status: 401 }) };
    throw Error(name);
  });
  return { route, forwarded: () => forwarded };
}
const request = (query = 'competitionId=7') => new Request('https://admin.test/api/event/entry-summary?' + query, { headers: { authorization: 'Bearer staff-fixture' } });
test('member and anonymous callers do not reach management registrations', async () => {
  const s = setup({ auth: false }); assert.equal((await s.route.GET(request())).status, 401); assert.equal(s.forwarded(), undefined);
});
test('summary preserves event ownership denial and rejects malformed identifiers', async () => {
  const s = setup({ allowed: false }); assert.equal((await s.route.GET(request())).status, 403);
  for (const id of ['', '-1', '1 OR 1=1', '0', '1/2']) assert.equal((await s.route.GET(request('competitionId=' + encodeURIComponent(id)))).status, 400);
});
test('number complete authorized registrations before group, search, or paging filters', async () => {
  const s = setup(); const response = await s.route.GET(request('competitionId=7&keyword=另一选手&groupId=3&pageSize=1'));
  const payload = await response.json();
  assert.equal(payload.data.players.length, 3); assert.equal(payload.data.contestants.length, 2);
  assert.deepEqual(payload.data.players.map(p => [p.id, p.programNumber, p.contestantNumber]), [[2, '节目001', '选手001'], [8, '节目002', '选手002'], [9, '节目003', '选手001']]);
  assert.equal(payload.data.contestants[0].totalRegistrationFee, 400);
  assert.equal(payload.data.players[2].groupName, '成人 · 专业东方舞独舞');
  assert.equal(new URL(s.forwarded().url).search, '?competitionId=7');
  assert.equal(s.forwarded().headers.get('authorization'), 'Bearer staff-fixture');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});
