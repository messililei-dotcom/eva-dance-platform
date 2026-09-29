import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

test('both API namespaces reject absent, forged, expired and member tokens', async () => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  const { NextRequest } = require('next/server');
  const { middleware } = load('../src/middleware.ts', {});
  const sign = (payload, local = true) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(encoded).digest('base64url');
    return `${local ? 'local.' : ''}${encoded}.${signature}`;
  };
  try {
    for (const namespace of ['api', 'local-api', 'legacy-student-api']) {
      for (const token of ['', 'forged', sign({ username: 'fixture', exp: Date.now() - 1000 }), sign({ memberId: 1, exp: Date.now() + 60000 }, false)]) {
        const response = await middleware(new NextRequest(`https://admin.swod.com.cn/${namespace}/payments/1`, { method: 'DELETE', headers: token ? { authorization: `Bearer ${token}` } : {} }));
        assert.equal(response.status, 401, `${namespace}: ${token ? 'invalid credential' : 'absent credential'}`);
        assert.match(response.headers.get('cache-control'), /no-store/);
      }
      const response = await middleware(new NextRequest(`https://admin.swod.com.cn/${namespace}/payments/1`, { headers: { authorization: `Bearer ${sign({ username: 'fixture', exp: Date.now() + 60000 })}` } }));
      assert.equal(response.headers.get('x-middleware-next'), '1');
    }
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  }
});

test('local login stops after five failed attempts without contacting the retired backend', async () => {
  let attempts = 0;
  const { POST } = load('../src/app/api/login/route.ts', {
    '../_local-auth': { isLocalAuthEnabled: () => true, localLogin: () => { attempts++; return null; } },
    '@/lib/server/admin-audit': { safelyRecordAdminAudit() {} },
  });
  const priorFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('must not contact retired backend'); };
  try {
    const request = () => new Request('https://admin.swod.com.cn/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '192.0.2.19' }, body: JSON.stringify({ username: 'fixture', password: 'fixture-invalid' }) });
    for (let n = 0; n < 5; n++) assert.equal((await POST(request())).status, 401);
    assert.equal((await POST(request())).status, 429);
    assert.equal(attempts, 5);
  } finally { globalThis.fetch = priorFetch; }
});

test('payment deletion requires permission, respects settlements, and atomically updates dependent records', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE Payment(id INTEGER PRIMARY KEY, memberId INTEGER, sales TEXT, date TEXT, voucherPath TEXT);
    INSERT INTO Payment VALUES(1,7,'fixture','2026-09-01','');
    CREATE TABLE ConsumeRecord(paymentId INTEGER); INSERT INTO ConsumeRecord VALUES(1);
    CREATE TABLE Orders(paymentId INTEGER); INSERT INTO Orders VALUES(1);
    CREATE TABLE Audit(label TEXT);`);
  let opens = 0, locked = false, reversals = 0, recalculations = 0;
  const db = { prepare: sql => sqlite.prepare(sql), close() {}, transaction: fn => () => { sqlite.exec('BEGIN'); try { const result = fn(); sqlite.exec('COMMIT'); return result; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
  const helpers = {
    requirePermission(request, permission) {
      assert.equal(permission, 'permPaymentDelete');
      const token = request.headers.get('authorization');
      if (token !== 'fixture-viewer' && token !== 'fixture-deleter') return Response.json({}, { status: 401 });
      return token === 'fixture-viewer' ? Response.json({}, { status: 403 }) : null;
    },
    authPayloadFromRequest: () => ({ username: 'fixture' }), openTrainingDb: () => { opens++; return db; },
    isCommissionSettlementLocked: () => locked, isSuperAdminRequest: () => false,
    deletePaymentOrder: (db, id) => db.prepare('DELETE FROM Orders WHERE paymentId=?').run(id),
    jsonError: (error, status) => Response.json({ error }, { status }),
  };
  const audit = { writeAdminAudit: (db, input) => db.prepare('INSERT INTO Audit VALUES(?)').run(input.label) };
  const canonical = load('../src/app/api/payments/[id]/route.ts', {
    '../../training-db': helpers, '../_voucher-files': { deletePaymentVoucherFile() {} }, '@/lib/server/admin-audit': audit,
    '@/lib/server/student-growth': { reverseDeletedSource() { reversals++; }, recalculateMemberGrowth() { recalculations++; } },
  });
  const legacy = load('../src/app/local-api/payments/[id]/route.ts', { '@/app/api/payments/[id]/route': canonical });
  assert.equal(legacy.DELETE, canonical.DELETE);
  const call = (authorization, id = '1') => legacy.DELETE(new Request('https://admin.swod.com.cn/local-api/payments/1', { method: 'DELETE', headers: authorization ? { authorization } : {} }), { params: Promise.resolve({ id }) });
  try {
    assert.equal((await call('')).status, 401);
    assert.equal((await call('forged')).status, 401);
    assert.equal((await call('fixture-viewer')).status, 403);
    assert.equal(opens, 0);
    locked = true;
    assert.equal((await call('fixture-deleter')).status, 403);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM Payment').get().n, 1);
    locked = false;
    assert.equal((await call('fixture-deleter')).status, 200);
    for (const table of ['Payment', 'ConsumeRecord', 'Orders']) assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0);
    assert.equal(reversals, 1);
    assert.equal(recalculations, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM Audit').get().n, 1);
    assert.equal((await call('fixture-deleter')).status, 404);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM Audit').get().n, 1);
  } finally { sqlite.close(); }
});
