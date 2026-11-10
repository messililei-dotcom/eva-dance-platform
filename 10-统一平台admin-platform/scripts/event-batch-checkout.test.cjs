const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const ts = require('typescript');
const Database = require('better-sqlite3');

const root = resolve(__dirname, '..');
const website = resolve(root, '../production/website');
const cache = new Map();
function load(file, overrides = {}) {
  if (cache.has(file) && !Object.keys(overrides).length) return cache.get(file);
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  new Function('require', 'module', 'exports', outputText)(name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith('@/')) return load(resolve(file.startsWith(website) ? website : root, 'src', name.slice(2) + '.ts'));
    if (name.startsWith('.')) return load(resolve(dirname(file), name + '.ts'));
    return require(name);
  }, module, module.exports);
  if (!Object.keys(overrides).length) cache.set(file, module.exports);
  return module.exports;
}

function fixture(db) {
  const schema = load(resolve(root, 'src/app/api/event/_db.ts'), {
    '@/lib/server/admin-db': {}, '../_local-auth': {}, './_access': {}, '@/lib/server/event-ranking': {},
  });
  schema.ensureEventTables(db);
  db.exec(`
    CREATE TABLE Member(id INTEGER PRIMARY KEY, name TEXT, phone TEXT, status TEXT);
    INSERT INTO Member VALUES (1,'报名账号','13800000001','active'),(2,'其他参赛者','13800000002','active');
    INSERT INTO event_competitions(id,name,code,registration_status) VALUES (7,'舞蹈赛','E7','open');
    INSERT INTO event_groups(id,competition_id,name,registration_fee,max_players) VALUES
      (3,7,'甲组',10.25,1),(4,7,'乙组',20.15,1),(5,7,'免费组',0,1);
  `);
  const route = load(resolve(root, 'src/app/api/mini/events/[id]/register/route.ts'), {
    '@/lib/server/event-phone-member': load(resolve(root, 'src/lib/server/event-phone-member.ts')),
    '@/lib/event-phone': load(resolve(root, 'src/lib/event-phone.ts')),
    '@/lib/server/event-online': load(resolve(root, 'src/lib/server/event-online.ts')),
    '@/lib/server/event-music-upload': load(resolve(root, 'src/lib/server/event-music-upload.ts')),
    '../../../_helpers': { getMemberId: (_, request) => Number(request.headers.get('x-test-member')) },
    '../../../../event/_db': { ...schema, withEventDb: fn => fn(db) },
    '@/lib/server/inbox': { createPersonalMessage() {} },
  });
  const call = (body, actor = 1) => route.POST(new Request('https://event.test/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-member': String(actor) }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: '7' }) });
  return { call };
}

const entry = (groupId, phone = '13800000002') => ({ groupId, phone, name: '参赛者', performanceTitle: '节目' });

test('batch rejects a partial write and replays a committed submission after a lost response', async () => {
  const db = new Database(':memory:');
  try {
    const { call } = fixture(db);
    const bad = { entries: [entry(3), entry(999)], requestKey: 'batch-test-atomic-001' };
    assert.equal((await call(bad, 0)).status, 401);
    assert.equal((await call(bad)).status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_players').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_performances').get().n, 0);
    const good = { ...bad, entries: [entry(3), entry(4), entry(5)] };
    const created = await (await call(good)).json();
    assert.equal(created.success, true, created.error);
    assert.equal(created.data.registrations.length, 3);
    assert.equal(created.data.registrations[2].registrationFee, 0);
    db.exec("UPDATE event_competitions SET registration_status='closed'");
    const replay = await call(good);
    assert.equal(replay.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await replay.json(), created);
    assert.equal((await call({ ...good, entries: [entry(4)] })).status, 409);
    assert.equal((await call(good, 2)).status, 409);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_players').get().n, 3);
  } finally { db.close(); }
});

for (const [name, source] of [['admin', root], ['website', website]]) {
  test(name + ' checkout verifies the payer and allocation, then settles payment and refund per group', async () => {
    const db = new Database(':memory:');
    try {
      const { call } = fixture(db);
      const core = load(resolve(source, 'src/lib/server/shop-core.ts'));
      const events = load(resolve(source, 'src/lib/server/event-online.ts'));
      core.ensureShop(db);
      const response = await (await call({ entries: [entry(3), entry(4), entry(5)], requestKey: 'batch-test-checkout-001' })).json();
      assert.equal(response.success, true, response.error);
      const [first, second, free] = response.data.registrations.map(row => row.id);
      assert.throws(() => core.courseOffer(db, 'event', first, 2), /报名不存在/);
      const offer = core.courseOffer(db, 'event', second, 1);
      assert.equal(offer.priceFen, 3040);
      const input = { kind: 'event', targetId: first, provider: 'wechat', requestKey: 'combined-order-001', expectedTotalFen: 3040, eventItems: [[first, 1025], [second, 2015]] };
      assert.throws(() => core.createCourseOrder(db, 1, { ...input, eventItems: [[first, 2015], [second, 1025]] }), /报名费用/);
      const order = core.createCourseOrder(db, 1, input);
      assert.equal(core.createCourseOrder(db, 1, { ...input, targetId: second, requestKey: 'combined-order-002' }).id, order.id);
      assert.equal(events.eventPaymentOrder(db, second, ['pending']).id, order.id);
      assert.throws(() => events.recordRegistrationPayment(db, second, {
        kind: 'charge', amount: 20.15, method: 'wechat', paidAt: new Date().toISOString(), requestKey: 'manual-charge-001',
        onlineOrderId: order.id,
      }), /原在线订单/);
      assert.throws(() => core.settlePaid(db, order.id, 'wechat', 'transaction-1', 2015), /支付金额/);
      assert.equal(db.prepare('SELECT paid_amount FROM event_players WHERE id=?').get(first).paid_amount, 0);
      db.prepare("UPDATE event_players SET status='cancelled' WHERE id=?").run(second);
      assert.throws(() => core.settlePaid(db, order.id, 'wechat', 'transaction-1', 3040), /已取消/);
      assert.equal(core.orderById(db, order.id).status, 'pending');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_registration_payments').get().n, 0);
      db.prepare("UPDATE event_players SET status='approved' WHERE id=?").run(second);
      core.settlePaid(db, order.id, 'wechat', 'transaction-1', 3040);
      core.settlePaid(db, order.id, 'wechat', 'transaction-1', 3040);
      assert.equal(core.orderById(db, order.id).status, 'completed');
      assert.deepEqual(db.prepare('SELECT id,paid_amount FROM event_players ORDER BY id').all(), [
        { id: first, paid_amount: 10.25 }, { id: second, paid_amount: 20.15 }, { id: free, paid_amount: 0 },
      ]);
      db.prepare("UPDATE shop_online_orders SET status='refunding' WHERE id=?").run(order.id);
      core.settleRefund(db, order.id);
      core.settleRefund(db, order.id);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_registration_payments').get().n, 4);
      assert.deepEqual(db.prepare('SELECT paid_status FROM event_players ORDER BY id').all().map(row => row.paid_status), ['refunded','refunded','paid']);
    } finally { db.close(); }
  });
}
