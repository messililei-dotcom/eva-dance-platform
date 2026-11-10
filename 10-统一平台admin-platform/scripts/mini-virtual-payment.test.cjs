const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const Database = require('better-sqlite3');

test('sandbox signs the exact payload and verifies only an authenticated matching payment', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mini-xpay-'));
  const config = {
    appId: 'test-app', secret: 'test-secret', offerId: 'test-offer', appKey: 'fixture-key',
    productId: 'lesson-fixture', dbPath: join(directory, 'mini-virtual-sandbox.sqlite'),
    seriesId: 6, priceFen: 100, memberId: 12,
  };
  const sign = (key, value) => createHmac('sha256', key).update(value).digest('hex');
  const source = readFileSync(join(__dirname, '../src/lib/server/mini-virtual-payment.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  let order;
  let response = { status: 1 };
  let queries = 0;
  try {
    vm.runInNewContext(code, {
      exports, process: { env: {} }, URL, URLSearchParams, AbortSignal,
      require: name => {
        if (name === './admin-db') return { getBetterSqlite3: () => Database };
        if (name === './shop-core') return {
          ShopError: Error, courseOffer: () => ({ id: 6, name: '测试课程', priceFen: 100 }),
        };
        return require(name);
      },
      fetch: async (url, options) => {
        if (url.pathname === '/cgi-bin/stable_token') {
          assert.equal(JSON.parse(options.body).appid, config.appId);
          return { ok: true, json: async () => ({ access_token: 'fixture-token', expires_in: 7200 }) };
        }
        assert.equal(url.pathname, '/xpay/query_order');
        assert.equal(url.searchParams.get('pay_sig'), sign(config.appKey, url.pathname + '&' + options.body));
        assert.deepEqual(JSON.parse(options.body), { openid: 'member-12', env: 1, order_id: order.id });
        queries++;
        return { ok: true, json: async () => ({ errcode: 0, order: response }) };
      },
    });
    assert.equal(exports.sandboxConfig(), null);
    assert.equal(exports.sandboxQuote({}, config, 6).priceFen, 100);
    assert.throws(() => exports.sandboxQuote({}, { ...config, priceFen: 101 }, 6), /不一致/);

    order = exports.sandboxOrder(config, 'member-12');
    assert.equal(exports.sandboxOrder(config, 'member-12').id, order.id);
    const signed = exports.signSandboxOrder(config, order, 'fixture-session');
    assert.equal(signed.paySig, sign(config.appKey, 'requestVirtualPayment&' + signed.signData));
    assert.equal(signed.signature, sign('fixture-session', signed.signData));
    assert.deepEqual(JSON.parse(signed.signData), {
      offerId: 'test-offer', buyQuantity: 1, env: 1, currencyType: 'CNY',
      productId: 'lesson-fixture', goodsPrice: 100, outTradeNo: order.id, attach: 'swod-sandbox',
    });

    await assert.rejects(exports.verifySandboxOrder(config, order.id, 'other-member'), /不存在/);
    assert.equal(queries, 0);
    assert.equal(await exports.verifySandboxOrder(config, order.id, 'member-12'), 'pending');
    response = { status: 2, order_id: order.id, wx_order_id: 'wx-test', order_fee: 100, paid_fee: 99, env_type: 2, order_type: 0 };
    await assert.rejects(exports.verifySandboxOrder(config, order.id, 'member-12'), /不匹配/);
    response = { ...response, paid_fee: 100, env_type: 1 };
    await assert.rejects(exports.verifySandboxOrder(config, order.id, 'member-12'), /不匹配/);
    response = { ...response, env_type: 2 };
    assert.equal(await exports.verifySandboxOrder(config, order.id, 'member-12'), 'verified');
    assert.equal(await exports.verifySandboxOrder(config, order.id, 'member-12'), 'verified');
    assert.equal(queries, 4);
    const db = new Database(config.dbPath, { readonly: true });
    try {
      assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(), [{ name: 'MiniVirtualSandboxOrder' }]);
    } finally { db.close(); }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('sandbox HTTP endpoints enforce the allowlist, mini identity and course entitlement', async () => {
  const file = join(__dirname, '../src/app/api/mini/virtual-payment/[...path]/route.ts');
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const routes = {};
  const config = { memberId: 12, appId: 'fixture-app' };
  let enabled = false;
  let authorizedMember = 12;
  let alreadyOwnsCourse = false;
  let openid = 'fixture-openid';
  let sessions = 0;
  let signatures = 0;
  vm.runInNewContext(code, {
    exports: routes, URL, Response,
    require: name => {
      if (name === '../../_helpers') return {
        getMemberId: () => authorizedMember,
        withDb: callback => callback({ prepare: () => ({ get: () => ({ openid: 'fixture-openid' }) }) }),
      };
      if (name.includes('_authorization')) return { getActiveAuthorization: () => alreadyOwnsCourse };
      if (name.endsWith('shop-core')) return {
        ShopError: class ShopError extends Error {
          constructor(message, status) { super(message); this.status = status; }
        },
      };
      if (name.endsWith('mini-virtual-payment')) return {
        sandboxConfig: () => enabled ? config : null,
        sandboxQuote: () => ({ id: 21, priceFen: 29900 }),
        sandboxSession: () => { sessions++; return { openid, sessionKey: 'fixture-session' }; },
        sandboxOrder: () => ({ id: 'fixture-order', status: 'pending' }),
        signSandboxOrder: () => { signatures++; return { signData: 'fixture' }; },
      };
      throw new Error('Unexpected module ' + name);
    },
  });
  async function prepare(expectedPriceFen = 29900) {
    const req = new Request('https://example.test/api/mini/virtual-payment/prepare/21?memberId=12', {
      method: 'POST', body: JSON.stringify({ code: 'wx-code', expectedPriceFen }),
    });
    const response = await routes.POST(req, { params: Promise.resolve({ path: ['prepare', '21'] }) });
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return response.status;
  }
  assert.equal(await prepare(), 503);
  enabled = true;
  authorizedMember = 13;
  assert.equal(await prepare(), 403);
  authorizedMember = 12;
  assert.equal(await prepare(1), 409);
  assert.equal(sessions, 0);
  openid = 'other-openid';
  assert.equal(await prepare(), 403);
  assert.equal(signatures, 0);
  openid = 'fixture-openid';
  alreadyOwnsCourse = true;
  assert.equal(await prepare(), 409);
  assert.equal(sessions, 1);
  alreadyOwnsCourse = false;
  assert.equal(await prepare(), 200);
  assert.equal(signatures, 1);
});

test('live checkout records only a matching live payment and unlocks once on both payment channels', () => {
  const file = join(__dirname, '../src/lib/server/mini-virtual-live.ts');
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const live = {};
  const db = new Database(':memory:');
  const env = {
    WECHAT_MINIAPP_APP_ID: 'test-app', WECHAT_MINIAPP_SECRET: 'test-secret',
    WECHAT_VIRTUAL_OFFER_ID: 'test-offer', WECHAT_VIRTUAL_LIVE_APP_KEY: 'fixture-live-key',
    WECHAT_VIRTUAL_LIVE_PRODUCTS: JSON.stringify({ 6: { productId: 'live-course', priceFen: 29900 } }),
  };
  try {
    db.exec(`CREATE TABLE Member (id INTEGER PRIMARY KEY, name TEXT, phone TEXT);
      INSERT INTO Member VALUES (12,'测试学员',''),(13,'测试学员','');
      CREATE TABLE CourseOrder (id INTEGER PRIMARY KEY,order_no TEXT UNIQUE,member_id INTEGER,series_id INTEGER,amount REAL,status TEXT,pay_method TEXT,paid_at TEXT,remark TEXT);
      CREATE TABLE CourseAuthorization (member_id INTEGER,phone TEXT,series_id INTEGER,type TEXT,order_id INTEGER,granted_at TEXT,status TEXT,remark TEXT);
      CREATE TABLE orders (order_no TEXT UNIQUE,member_id INTEGER,member_name TEXT,member_phone TEXT,order_type TEXT,source_type TEXT,source_id TEXT,title TEXT,amount REAL,status TEXT,pay_method TEXT,paid_at TEXT,remark TEXT);`);
    vm.runInNewContext(code, {
      exports: live, process: { env },
      require: name => name === './shop-core'
        ? { ShopError: Error, courseOffer: () => ({ id: 6, name: '测试课程', priceFen: 29900 }) }
        : require(name),
    });
    assert.equal(live.liveVirtualConfig(), null);
    env.WECHAT_VIRTUAL_LIVE_ENABLED = 'true';
    const config = live.liveVirtualConfig();
    assert.ok(config);
    assert.throws(() => live.createLiveOrder(db, config, 12, 6, 'member-12', 29800, () => false), /价格已变化/);
    assert.throws(() => live.createLiveOrder(db, config, 12, 6, 'member-12', 29900, () => true), /已拥有/);
    for (const [memberId, channel] of [[12, 0], [13, 7]]) {
      const openid = 'member-' + memberId;
      const order = live.createLiveOrder(db, config, memberId, 6, openid, 29900, () => false);
      assert.equal(live.createLiveOrder(db, config, memberId, 6, openid, 29900, () => false).id, order.id);
      assert.equal(live.findLiveOrder(db, 99, order.id), undefined);
      const result = { order_id: order.id, wx_order_id: 'wx-' + memberId, order_type: channel,
        env_type: 1, status: 2, order_fee: 29900, paid_fee: 29900, left_fee: 29900 };
      assert.throws(() => live.settleLiveOrder(db, order, { ...result, env_type: 2 }), /环境/);
      assert.throws(() => live.settleLiveOrder(db, order, { ...result, paid_fee: 100 }), /金额/);
      assert.throws(() => live.settleLiveOrder(db, order, { ...result, left_fee: 0 }), /金额/);
      assert.equal(live.settleLiveOrder(db, order, { ...result, status: 1 }), 'pending');
      assert.equal(live.settleLiveOrder(db, order, result), 'verified');
      assert.equal(live.settleLiveOrder(db, order, result), 'verified');
    }
    assert.deepEqual(db.prepare('SELECT member_id,pay_method FROM CourseOrder ORDER BY member_id').all(), [
      { member_id: 12, pay_method: '微信' }, { member_id: 13, pay_method: '苹果支付' },
    ]);
    assert.equal(db.prepare("SELECT count(*) n FROM CourseAuthorization WHERE status='active'").get().n, 2);
    assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 2);
  } finally {
    db.close();
  }
});
