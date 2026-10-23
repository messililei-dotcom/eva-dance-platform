const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const { createRequire } = require("node:module");
const admin = [process.env.SHOP_ADMIN_TEST_ROOT, path.resolve("../admin-platform"), path.resolve("../../10-统一平台admin-platform")].find(p => p && fs.existsSync(path.join(p,"package.json")));
const Database = createRequire(path.join(admin, "package.json"))(
  "better-sqlite3",
);
const dir = fs.mkdtempSync(path.resolve(".shop-tests-"));
for (const name of ["shop-core", "shop-payments", "shop-service", "shop-shipping", "exclusive-orders", "exclusive-refunds"]) {
  const source = fs.readFileSync(`src/lib/server/${name}.ts`, "utf8");
  fs.writeFileSync(
    path.join(dir, `${name}.js`),
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
  );
}
fs.writeFileSync(
  path.join(dir, "admin-db.js"),
  "exports.openAdminDb=()=>global.__testShopDb;",
);
const shipping = require(path.join(dir,"shop-shipping.js"));
const service = require(path.join(dir, "shop-service.js"));
const core = require(path.join(dir, "shop-core.js")),
  pay = require(path.join(dir, "shop-payments.js"));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
function db() {
  const d = new Database(":memory:");
  d.exec(`
 CREATE TABLE Member(id INTEGER PRIMARY KEY,name TEXT,phone TEXT DEFAULT '',province TEXT DEFAULT '',city TEXT DEFAULT '',address TEXT DEFAULT ''); INSERT INTO Member(id,name) VALUES(1,'测试客户'); INSERT INTO Member(id,name) VALUES(2,'另一客户');
 CREATE TABLE shop_products(id TEXT PRIMARY KEY,name TEXT,spec TEXT,size TEXT,color TEXT,sale_price REAL,stock INTEGER,status TEXT,updated_at TEXT);
 INSERT INTO shop_products VALUES('p1','练习上衣','基础','M','黑',19.99,3,'在售','');
 INSERT INTO shop_products VALUES('p2','练习裙','基础','M','白',29.99,2,'在售','');
 CREATE TABLE shop_stock_logs(id INTEGER PRIMARY KEY,product_id TEXT,product_name TEXT,change_type TEXT NOT NULL CHECK(change_type IN ('入库','出库','调整','销售')),quantity INTEGER,before_stock INTEGER,after_stock INTEGER,operator TEXT,remark TEXT,channel TEXT);
 CREATE TABLE shop_sales(id INTEGER PRIMARY KEY,product_id TEXT,product_name TEXT,quantity INTEGER,unit_price REAL,total_amount REAL,member_id INTEGER,member_name TEXT,sale_date TEXT,remark TEXT,sale_type TEXT,channel TEXT,customer_phone TEXT,operator TEXT);
 `);
  core.ensureShop(d);
  return d;
}
const input = (extra = {}) => ({
  recipient: "测试",
  phone: "13800000000",
  address: "广东省广州市测试区测试路一号",
  requestKey: crypto.randomUUID(),
  provider: "wechat",
  items: [{ id: "p1", quantity: 2 }],
  ...extra,
});
test("服务端定价、包邮、库存预留，不接受客户端金额", () => {
  const d = db();
  try {
    const o = core.createOrder(d, 1, input({ totalFen: 1, price: 0.01 }));
    assert.equal(o.total_fen, 3998);
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      1,
    );
  } finally {
    d.close();
  }
});
test("重复下单幂等，相同 key 不同内容被拒绝", () => {
  const d = db();
  try {
    const b = input();
    const a = core.createOrder(d, 1, b);
    assert.equal(core.createOrder(d, 1, b).id, a.id);
    assert.throws(
      () =>
        core.createOrder(d, 1, { ...b, address: "广东省广州市其他地址一号" }),
      /内容已变化/,
    );
    assert.equal(
      d.prepare("SELECT count(*) n FROM shop_online_orders").get().n,
      1,
    );
  } finally {
    d.close();
  }
});
test("库存不足整单回滚，不留下锁库与订单明细", () => {
  const d = db();
  try {
    assert.throws(
      () =>
        core.createOrder(
          d,
          1,
          input({
            items: [
              { id: "p1", quantity: 2 },
              { id: "p2", quantity: 3 },
            ],
          }),
        ),
      /库存不足/,
    );
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      3,
    );
    assert.equal(
      d.prepare("SELECT count(*) n FROM shop_online_items").get().n,
      0,
    );
    assert.equal(
      d.prepare("SELECT count(*) n FROM shop_stock_logs").get().n,
      0,
    );
  } finally {
    d.close();
  }
});
test("后一位客户不能买走已经锁定的库存", () => {
  const d = db();
  try {
    core.createOrder(d, 1, input());
    assert.throws(() => core.createOrder(d, 2, input()), /库存不足/);
  } finally {
    d.close();
  }
});
test("支付通知金额、渠道及流水核对；重放只生成一次销售", () => {
  const d = db();
  try {
    const o = core.createOrder(d, 1, input());
    assert.throws(() => core.settlePaid(d, o.id, "wechat", "tx1", 1), /金额/);
    assert.throws(
      () => core.settlePaid(d, o.id, "alipay", "tx1", 3998),
      /渠道/,
    );
    core.settlePaid(d, o.id, "wechat", "tx1", 3998);
    core.settlePaid(d, o.id, "wechat", "tx1", 3998);
    assert.equal(d.prepare("SELECT count(*) n FROM shop_sales").get().n, 1);
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      1,
    );
    assert.throws(
      () => core.settlePaid(d, o.id, "wechat", "tx2", 3998),
      /流水/,
    );
  } finally {
    d.close();
  }
});
test("取消幂等，只恢复一次库存；已付款订单不能取消", () => {
  const d = db();
  try {
    const o = core.createOrder(d, 1, input());
    core.cancelConfirmed(d, o.id);
    core.cancelConfirmed(d, o.id);
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      3,
    );
    assert.throws(
      () => core.settlePaid(d, o.id, "wechat", "late", 3998),
      /状态异常/,
    );
    const o2 = core.createOrder(d, 1, input());
    core.settlePaid(d, o2.id, "wechat", "tx2", 3998);
    core.cancelConfirmed(d, o2.id);
    assert.equal(core.orderById(d, o2.id).status, "paid");
  } finally {
    d.close();
  }
});
test("退款只恢复一次库存并追加一次销售冲销", () => {
  const d = db();
  try {
    const o = core.createOrder(d, 1, input());
    core.settlePaid(d, o.id, "wechat", "tx1", 3998);
    d.prepare(
      "UPDATE shop_online_orders SET status='refunding',refund_restock=1 WHERE id=?",
    ).run(o.id);
    core.settleRefund(d, o.id);
    core.settleRefund(d, o.id);
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      3,
    );
    assert.equal(
      d.prepare("SELECT sum(total_amount) total FROM shop_sales").get().total,
      0,
    );
    assert.equal(d.prepare("SELECT count(*) n FROM shop_sales").get().n, 2);
  } finally {
    d.close();
  }
});
test("订单归属校验与无效商品、数量、地址校验", () => {
  const d = db();
  try {
    const o = core.createOrder(d, 1, input());
    assert.throws(() => core.orderById(d, o.id, 2), /不存在/);
    for (const quantity of [0, -1, 1.5, 100, "1"])
      assert.throws(() =>
        core.createOrder(d, 1, input({ items: [{ id: "p1", quantity }] })),
      );
    assert.throws(() => core.createOrder(d, 1, input({ address: "短地址" })));
    assert.throws(
      () =>
        core.createOrder(
          d,
          1,
          input({
            items: [
              { id: "p1", quantity: 1 },
              { id: "p1", quantity: 1 },
            ],
          }),
        ),
      /重复/,
    );
    d.prepare("UPDATE shop_products SET status='下架' WHERE id='p1'").run();
    assert.throws(() => core.createOrder(d, 1, input()), /下架/);
  } finally {
    d.close();
  }
});
const key = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKey = key.privateKey.export({ type: "pkcs8", format: "pem" }),
  publicKey = key.publicKey.export({ type: "spki", format: "pem" });
const config = {
  enabled: true,
  origin: "https://www.swod.com.cn",
  wxApp: "app",
  wxMerchant: "merchant",
  wxSerial: "serial",
  wxPrivate: privateKey,
  wxPublic: publicKey,
  wxPublicId: "PUB_KEY_ID_TEST",
  wxV3: "12345678901234567890123456789012",
  aliApp: "app",
  aliSeller: "seller",
  aliPrivate: privateKey,
  aliPublic: publicKey,
};
function headers(raw, offset = 0) {
  const t = String(Math.floor(Date.now() / 1000) + offset),
    nonce = "nonce";
  return new Headers({
    "Wechatpay-Timestamp": t,
    "Wechatpay-Nonce": nonce,
    "Wechatpay-Serial": config.wxPublicId,
    "Wechatpay-Signature": crypto
      .sign("RSA-SHA256", Buffer.from(`${t}\n${nonce}\n${raw}\n`), privateKey)
      .toString("base64"),
  });
}
test("微信签名校验拒绝篡改、过期、错误公钥 ID 和探测签名", () => {
  const raw = '{"ok":true}';
  pay.verifyWechat(raw, headers(raw), config);
  assert.throws(() => pay.verifyWechat(raw + " ", headers(raw), config));
  assert.throws(() => pay.verifyWechat(raw, headers(raw, -600), config));
  const h = headers(raw);
  h.set("Wechatpay-Serial", "wrong");
  assert.throws(() => pay.verifyWechat(raw, h, config));
  h.set("Wechatpay-Serial", config.wxPublicId);
  h.set("Wechatpay-Signature", "WECHATPAY/SIGNTEST/invalid");
  assert.throws(() => pay.verifyWechat(raw, h, config));
});
test("微信通知正确解密，校验商户和币种", () => {
  function notification(mchid = "merchant") {
    const resource = {
      nonce: "123456789012",
      associated_data: "transaction",
      algorithm: "AEAD_AES_256_GCM",
    };
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(config.wxV3),
      Buffer.from(resource.nonce),
    );
    cipher.setAAD(Buffer.from(resource.associated_data));
    resource.ciphertext = Buffer.concat([
      cipher.update(
        JSON.stringify({
          appid: "app",
          mchid,
          trade_state: "SUCCESS",
          out_trade_no: "order1",
          transaction_id: "tx1",
          amount: { currency: "CNY", total: 1234 },
        }),
      ),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString("base64");
    return JSON.stringify({ event_type: "TRANSACTION.SUCCESS", resource });
  }
  const raw = notification();
  assert.deepEqual(pay.wechatNotification(raw, headers(raw), config), {
    appId: "app",
    id: "order1",
    transactionId: "tx1",
    amountFen: 1234,
  });
  const bad = notification("other");
  assert.throws(
    () => pay.wechatNotification(bad, headers(bad), config),
    /商户/,
  );
});
test("支付宝通知验签、金额与收款账户校验，拒绝参数重复", () => {
  function notification(seller = "seller") {
    const data = {
      app_id: "app",
      seller_id: seller,
      out_trade_no: "order1",
      trade_no: "tx1",
      trade_status: "TRADE_SUCCESS",
      total_amount: "12.34",
    };
    const signing = Object.keys(data)
      .sort()
      .map((k) => `${k}=${data[k]}`)
      .join("&");
    return new URLSearchParams({
      ...data,
      sign_type: "RSA2",
      sign: crypto
        .sign("RSA-SHA256", Buffer.from(signing), privateKey)
        .toString("base64"),
    }).toString();
  }
  const raw = notification();
  assert.deepEqual(pay.alipayNotification(raw, config), {
    id: "order1",
    transactionId: "tx1",
    amountFen: 1234,
  });
  assert.throws(() => pay.alipayNotification(notification("wrong"), config));
  assert.throws(() => pay.alipayNotification(raw + "&total_amount=1", config));
  assert.throws(() =>
    pay.alipayNotification(raw.replace("12.34", "12.35"), config),
  );
});
test("支付开关默认关闭，缺少商户资料不能下单", () => {
  assert.equal(
    pay.paymentAvailability({ ...config, enabled: false }).wechat,
    false,
  );
  assert.equal(
    pay.paymentAvailability({ ...config, aliSeller: "" }).alipay,
    false,
  );
  assert.equal(pay.paymentAvailability({ ...config, wxV3: "" }).wechat, false);
});
test("数字化平台与官网共用相同的订单和支付实现", () => {
  // Browser authorization supplies payer identity in the website service.
  for (const name of ["shop-core", "shop-payments"])
    assert.equal(
      fs.readFileSync(`src/lib/server/${name}.ts`, "utf8"),
      fs.readFileSync(path.join(admin, `src/lib/server/${name}.ts`), "utf8"),
    );
});

test("价格变化需重新确认，不改变库存", () => {
  const d = db();
  try {
    assert.throws(
      () => core.createOrder(d, 1, input({ expectedTotalFen: 1 })),
      /价格已更新/,
    );
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      3,
    );
  } finally {
    d.close();
  }
});
test("未尝试支付的到期订单自动释放；正在支付的订单不误关", async () => {
  const d = db();
  global.__testShopDb = {
    prepare: d.prepare.bind(d),
    exec: d.exec.bind(d),
    transaction: d.transaction.bind(d),
    close() {},
  };
  try {
    const o = core.createOrder(d, 1, input());
    d.prepare("UPDATE shop_online_orders SET expires_at=? WHERE id=?").run(
      Date.now() - 1000,
      o.id,
    );
    await service.reconcileOrder(o.id);
    assert.equal(core.orderById(d, o.id).status, "cancelled");
    const o2 = core.createOrder(d, 1, input());
    d.prepare(
      "UPDATE shop_online_orders SET payment_attempted=1,pay_lock_until=? WHERE id=?",
    ).run(Date.now() + 60000, o2.id);
    await service.reconcileOrder(o2.id, true);
    assert.equal(core.orderById(d, o2.id).status, "pending");
  } finally {
    d.close();
  }
});
test("网关查询失败保持锁库，确认关闭后只释放一次", async () => {
  const d = db();
  global.__testShopDb = {
    prepare: d.prepare.bind(d),
    exec: d.exec.bind(d),
    transaction: d.transaction.bind(d),
    close() {},
  };
  const original = pay.queryPayment;
  try {
    const o = core.createOrder(d, 1, input());
    d.prepare(
      "UPDATE shop_online_orders SET payment_attempted=1 WHERE id=?",
    ).run(o.id);
    pay.queryPayment = async () => {
      throw new Error("network");
    };
    await assert.rejects(service.reconcileOrder(o.id, true));
    assert.equal(core.orderById(d, o.id).status, "pending");
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      1,
    );
    pay.queryPayment = async () => ({ state: "closed" });
    await service.reconcileOrder(o.id, true);
    await service.reconcileOrder(o.id, true);
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      3,
    );
  } finally {
    pay.queryPayment = original;
    d.close();
  }
});
test("支付成功与取消竞争时以网关付款事实为准", async () => {
  const d = db();
  global.__testShopDb = {
    prepare: d.prepare.bind(d),
    exec: d.exec.bind(d),
    transaction: d.transaction.bind(d),
    close() {},
  };
  const original = pay.queryPayment;
  try {
    const o = core.createOrder(d, 1, input());
    d.prepare(
      "UPDATE shop_online_orders SET payment_attempted=1 WHERE id=?",
    ).run(o.id);
    pay.queryPayment = async () => ({
      state: "paid",
      transactionId: "winner",
      amountFen: 3998,
    });
    await service.reconcileOrder(o.id, true);
    assert.equal(core.orderById(d, o.id).status, "paid");
    assert.equal(
      d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,
      1,
    );
  } finally {
    pay.queryPayment = original;
    d.close();
  }
});
test("发货、收货与退款申请检查状态及归属", () => {
  const d = db();
  try {
    const o = core.createOrder(d, 1, input());
    assert.throws(
      () => service.fulfillOrder(d, o.id, "顺丰", "SF123456", "admin"),
      /仅已付款/,
    );
    core.settlePaid(d, o.id, "wechat", "tx1", 3998);
    service.fulfillOrder(d, o.id, "顺丰", "SF123456", "admin");
    assert.throws(
      () => service.memberAction(d, o.id, 2, "received", ""),
      /不存在/,
    );
    service.memberAction(d, o.id, 1, "received", "");
    assert.equal(core.orderById(d, o.id).status, "completed");
    service.memberAction(d, o.id, 1, "refund", "尺码不合适");
    assert.equal(core.orderById(d, o.id).status, "refund_requested");
    assert.throws(() =>
      service.fulfillOrder(d, o.id, "顺丰", "SF123456", "admin"),
    );
  } finally {
    d.close();
  }
});

test('商城收货地址默认个人中心地址，任一端修改后使用同一份资料',()=>{
 const d=db();try{
  d.prepare("UPDATE Member SET phone='13800000000',province='广东省',city='广州市',address='天河区测试街一号' WHERE id=1").run();
  assert.equal(shipping.getShipping(d,1).address,'广东省广州市天河区测试街一号');
  shipping.saveShipping(d,1,{recipient:'收件人',phone:'13900000000',address:'浙江省杭州市西湖区测试路二号'});
  assert.equal(d.prepare('SELECT address FROM Member WHERE id=1').get().address,'浙江省杭州市西湖区测试路二号');
  assert.equal(shipping.getShipping(d,1).address,'浙江省杭州市西湖区测试路二号');
  assert.equal(d.prepare('SELECT name,phone FROM Member WHERE id=1').get().name,'测试客户');
  d.prepare("UPDATE Member SET province='四川省',city='成都市',address='武侯区测试路三号' WHERE id=1").run();
  assert.equal(shipping.getShipping(d,1).address,'四川省成都市武侯区测试路三号');
  assert.equal(shipping.getShipping(d,1).recipient,'收件人');
  assert.equal(shipping.getShipping(d,2).address,'');
  assert.throws(()=>shipping.saveShipping(d,2,{recipient:'A',phone:'invalid',address:'地址'}));
  assert.equal(d.prepare('SELECT address FROM Member WHERE id=2').get().address,'');
 }finally{d.close();}
});
test('小程序使用对应 AppID 与 OpenID 下单并返回原生支付参数',async()=>{
 const oldFetch=global.fetch;const c={...config,wxMiniApp:'mini-app',wxMiniEnabled:true};let posted;
 global.fetch=async(url,opt)=>{posted=JSON.parse(opt.body);const raw=JSON.stringify({prepay_id:'test-prepay'});return new Response(raw,{headers:headers(raw)});};
 try{
  const result=await pay.startPayment({id:'EVtest',provider:'wechat',total_fen:1999,expires_at:Date.now()+120000,payment_app_id:'mini-app'},{mobile:true,wechatBrowser:true,miniprogram:true,openid:'mini-openid',ip:'127.0.0.1'},c);
  assert.equal(posted.appid,'mini-app');assert.equal(posted.payer.openid,'mini-openid');assert.equal(posted.amount.total,1999);assert.equal(result.kind,'miniprogram');
  assert.equal(crypto.verify('RSA-SHA256',Buffer.from(`mini-app\n${result.params.timeStamp}\n${result.params.nonceStr}\n${result.params.package}\n`),publicKey,Buffer.from(result.params.paySign,'base64')),true);
  await assert.rejects(()=>pay.startPayment({provider:'wechat',expires_at:Date.now()+120000},{miniprogram:true,mobile:true,wechatBrowser:true,ip:'127.0.0.1'},c),/重新登录/);
 }finally{global.fetch=oldFetch;}
});
test('隐藏商品阻止新订单，恢复显示不改变库存或价格',()=>{
 const d=db();try{
 const before=d.prepare('SELECT stock,sale_price FROM shop_products WHERE id=?').get('p1');
 d.prepare('UPDATE shop_products SET is_hidden=1 WHERE id=?').run('p1');
 assert.throws(()=>core.createOrder(d,1,input()),/下架|不存在|商品/);
 assert.deepEqual(d.prepare('SELECT stock,sale_price FROM shop_products WHERE id=?').get('p1'),before);
 d.prepare('UPDATE shop_products SET is_hidden=0 WHERE id=?').run('p1');
 const order=core.createOrder(d,1,input());assert.equal(order.total_fen,3998);
 }finally{d.close()}
});

// Production inventory categories must be preserved for order locks and releases.
test("生产库存日志约束：微信与支付宝下单取消均可回库且不重复", () => {
 for (const provider of ["wechat", "alipay"]) {
  const d=db(); try {
   const o=core.createOrder(d,1,input({provider}));
   const locked=d.prepare("SELECT * FROM shop_stock_logs ORDER BY id").all();
   assert.equal(locked[0].change_type,"出库");assert.ok(locked[0].remark.includes(o.id));
   core.cancelConfirmed(d,o.id);core.cancelConfirmed(d,o.id);
   const logs=d.prepare("SELECT * FROM shop_stock_logs ORDER BY id").all();
   assert.deepEqual(logs.map(r=>r.change_type),["出库","入库"]);
   assert.equal(d.prepare("SELECT stock FROM shop_products WHERE id='p1'").get().stock,3);
  } finally {d.close();}
 }
});

function courseDb(){
 const d=db();d.exec(`CREATE TABLE CourseSeries(id INTEGER PRIMARY KEY,name TEXT,price REAL,promo_price REAL,is_free INTEGER,status TEXT);INSERT INTO CourseSeries VALUES(1,'系统课',100,80,0,'published'),(2,'隐藏课',100,0,0,'draft');
 CREATE TABLE CourseTemplate(id INTEGER PRIMARY KEY,websiteVisible INTEGER);INSERT INTO CourseTemplate VALUES(1,1);
 CREATE TABLE Course(id INTEGER PRIMARY KEY,name TEXT,price REAL,templateId INTEGER,status TEXT,category TEXT,sessions INTEGER,endDate TEXT,capacity INTEGER,remaining INTEGER);INSERT INTO Course VALUES(8,'公开期次',200,1,'planned','offline',10,'2099-12-01',1,1);
 CREATE TABLE CourseOrder(id INTEGER PRIMARY KEY,order_no TEXT,member_id INTEGER,series_id INTEGER,amount REAL,status TEXT,pay_method TEXT,paid_at TEXT,remark TEXT,updated_at TEXT);
 CREATE TABLE CourseAuthorization(id INTEGER PRIMARY KEY,member_id INTEGER,phone TEXT,series_id INTEGER,type TEXT,order_id INTEGER,granted_at TEXT,status TEXT,remark TEXT,expire_at TEXT,revoked_at TEXT);
 CREATE TABLE Payment(id INTEGER PRIMARY KEY,memberId INTEGER,memberName TEXT,memberPhone TEXT,courseId INTEGER,courseName TEXT,amount REAL,date TEXT,payment TEXT,remark TEXT,expireDate TEXT,remainingSessions INTEGER,paymentStatus TEXT,channel TEXT);
 CREATE TABLE OfflineEnrollment(id INTEGER PRIMARY KEY,enrollment_no TEXT,member_id INTEGER,course_id INTEGER,payment_id INTEGER,status TEXT,channel TEXT,amount REAL,activated_at TEXT,remark TEXT);
 CREATE TABLE OfflineEntitlement(id INTEGER PRIMARY KEY,member_id INTEGER,course_id INTEGER,enrollment_id INTEGER,payment_id INTEGER,total_sessions INTEGER,available_sessions INTEGER,valid_from TEXT,valid_until TEXT,status TEXT,used_sessions INTEGER DEFAULT 0,frozen_sessions INTEGER DEFAULT 0);
 CREATE TABLE orders(id INTEGER PRIMARY KEY,order_no TEXT,member_id INTEGER,member_name TEXT,member_phone TEXT,order_type TEXT,source_type TEXT,source_id TEXT,title TEXT,amount REAL,status TEXT,pay_method TEXT,paid_at TEXT,remark TEXT,updated_at TEXT);`);return d;
}
const courseInput=(kind,id,price,key='course-key')=>({kind,targetId:id,provider:'wechat',expectedTotalFen:price,requestKey:key});
test('线上课价格由后台核验、隐藏拒绝、回调幂等授权、跨端权益与退款一致',()=>{
 const d=courseDb();try{
 assert.throws(()=>core.createCourseOrder(d,1,courseInput('online',2,10000)),/隐藏/);
 assert.throws(()=>core.createCourseOrder(d,1,courseInput('online',1,1)),/价格/);
 const input=courseInput('online',1,8000),o=core.createCourseOrder(d,1,input);
 assert.equal(core.createCourseOrder(d,1,input).id,o.id);
 assert.equal(core.publicOrder(d,o).kind,'online');
 assert.throws(()=>core.settlePaid(d,o.id,'wechat','bad',1),/金额/);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM CourseAuthorization').get().n,0);
 core.settlePaid(d,o.id,'wechat','online-paid',8000);core.settlePaid(d,o.id,'wechat','online-paid',8000);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM CourseAuthorization').get().n,1);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM CourseOrder').get().n,1);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM shop_sales').get().n,0);
 assert.throws(()=>core.createCourseOrder(d,1,courseInput('online',1,8000,'another')),/已拥有/);
 d.prepare("UPDATE shop_online_orders SET status='refunding' WHERE id=?").run(o.id);core.settleRefund(d,o.id);core.settleRefund(d,o.id);
 assert.equal(d.prepare('SELECT status FROM CourseAuthorization').get().status,'revoked');
 assert.equal(d.prepare('SELECT status FROM orders').get().status,'refunded');
 }finally{d.close();}
});
test('线下期次锁名额、取消归还、付款开通约课课次、使用或预约后阻止自动退款',()=>{
 const d=courseDb();try{
 const o=core.createCourseOrder(d,1,courseInput('offline',8,20000));
 assert.equal(d.prepare('SELECT remaining FROM Course').get().remaining,0);
 assert.throws(()=>core.createCourseOrder(d,2,courseInput('offline',8,20000,'other')),/名额/);
 core.cancelConfirmed(d,o.id);core.cancelConfirmed(d,o.id);assert.equal(d.prepare('SELECT remaining FROM Course').get().remaining,1);
 const paid=core.createCourseOrder(d,1,courseInput('offline',8,20000,'new'));core.settlePaid(d,paid.id,'wechat','offline-paid',20000);core.settlePaid(d,paid.id,'wechat','offline-paid',20000);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM Payment').get().n,1);
 assert.equal(d.prepare('SELECT available_sessions FROM OfflineEntitlement').get().available_sessions,10);
 d.exec('UPDATE OfflineEntitlement SET frozen_sessions=1');assert.throws(()=>core.validateCourseRefund(d,paid.id),/已预约/);
 d.exec('UPDATE OfflineEntitlement SET frozen_sessions=0');core.validateCourseRefund(d,paid.id);
 assert.equal(d.prepare('SELECT status FROM OfflineEntitlement').get().status,'refunding');
 d.prepare("UPDATE shop_online_orders SET status='refunding' WHERE id=?").run(paid.id);core.settleRefund(d,paid.id);
 assert.equal(d.prepare('SELECT paymentStatus FROM Payment').get().paymentStatus,'refunded');assert.equal(d.prepare('SELECT remaining FROM Course').get().remaining,1);
 }finally{d.close();}
});

const exclusive=require(path.join(dir,'exclusive-orders.js'));
const exclusiveRefunds=require(path.join(dir,'exclusive-refunds.js'));
function exclusiveDb(){const d=courseDb();d.exec(`UPDATE Member SET phone='1380000000'||id;
CREATE TABLE User(id INTEGER PRIMARY KEY,username TEXT,name TEXT,role TEXT,status TEXT,permPaymentCreate INTEGER,permPaymentView INTEGER);
INSERT INTO User VALUES(1,'advisor','测试老师','staff','active',1,1),(2,'admin','管理员','admin','active',1,1);
ALTER TABLE CourseAuthorization ADD COLUMN sales TEXT;ALTER TABLE Payment ADD COLUMN sales TEXT;
ALTER TABLE shop_products ADD COLUMN category TEXT;`);exclusive.ensureExclusive(d);return d;}
const advisor={id:1,name:'测试老师',canCreate:true,privileged:false};
const offerInput=(extra={})=>({kind:'online',targetId:1,quantity:1,unitFen:4500,publish:true,requestKey:'offer-test',...extra});
const claimInput=(extra={})=>({confirmed:true,totalFen:4500,provider:'wechat',...extra});
test('同卡两位客户各自全额支付，独立授权、顾问归属和幂等',()=>{const d=exclusiveDb();try{
const o=exclusive.createExclusive(d,advisor,offerInput({internalNote:'内部秘密'}));
assert.equal(exclusive.createExclusive(d,advisor,offerInput({internalNote:'内部秘密'})).id,o.id);
assert.throws(()=>exclusive.createExclusive(d,advisor,offerInput({unitFen:1})),/内容已变化/);
const x=exclusive.claimExclusive(d,o,1,claimInput()),y=exclusive.claimExclusive(d,o,2,claimInput());assert.notEqual(x.id,y.id);
assert.equal(exclusive.claimExclusive(d,o,1,claimInput()).id,x.id);
for(const p of [x,y]){core.settlePaid(d,p.id,'wechat','tx-'+p.id,4500);core.settlePaid(d,p.id,'wechat','tx-'+p.id,4500);}
assert.equal(d.prepare('SELECT COUNT(*) n FROM CourseAuthorization').get().n,2);
assert.equal(d.prepare('SELECT SUM(amount) n FROM CourseOrder').get().n,90);
assert.equal(d.prepare('SELECT COUNT(*) n FROM CourseAuthorization WHERE sales=?').get('测试老师').n,2);
assert.equal(exclusive.publicExclusive(d,o).status,'pending');assert.equal(JSON.stringify(exclusive.publicExclusive(d,o)).includes('内部秘密'),false);
assert.equal(exclusive.claimExclusive(d,o,1,claimInput()).id,x.id);
}finally{d.close();}});
test('专属订单拒绝越权顾问、指定客户不符、金额篡改、未确认、到期',()=>{const d=exclusiveDb();try{
assert.throws(()=>exclusive.createExclusive(d,advisor,offerInput({advisorId:2})),/权限/);
assert.throws(()=>exclusive.createExclusive(d,advisor,offerInput({accessExpires:'2099-99-99'})),/有效期/);
const o=exclusive.createExclusive(d,advisor,offerInput({customerId:1}));
assert.throws(()=>exclusive.claimExclusive(d,o,2,claimInput()),/不属于/);
assert.throws(()=>exclusive.claimExclusive(d,o,1,claimInput({totalFen:1})),/金额/);
assert.throws(()=>exclusive.claimExclusive(d,o,1,claimInput({confirmed:false})),/确认/);
d.prepare('UPDATE exclusive_orders SET expires_at=? WHERE id=?').run(Date.now()-1,o.id);
assert.throws(()=>exclusive.claimExclusive(d,o,1,claimInput()),/失效/);
assert.equal(d.prepare('SELECT COUNT(*) n FROM shop_online_orders').get().n,0);
}finally{d.close();}});
test('商品议价含运费，部分退款后全退，库存和净收入只恢复一次',()=>{const d=exclusiveDb();try{
const o=exclusive.createExclusive(d,advisor,offerInput({kind:'goods',targetId:'p1',quantity:2,unitFen:1000,discountFen:100,shippingFen:100}));
const x=exclusive.claimExclusive(d,o,1,claimInput({totalFen:2000,shipping:{recipient:'测试',phone:'13800000001',address:'湖南长沙测试路1号'}}));
core.settlePaid(d,x.id,'wechat','goods-exclusive',2000);
assert.equal(d.prepare('SELECT SUM(total_amount) n FROM shop_sales').get().n,20);
let r=exclusiveRefunds.prepareExclusiveRefund(d,x.id,500,'部分退','管理员','r1');exclusiveRefunds.settleExclusiveRefund(d,r.id);exclusiveRefunds.settleExclusiveRefund(d,r.id);
assert.equal(d.prepare('SELECT stock FROM shop_products WHERE id=?').get('p1').stock,1);
r=exclusiveRefunds.prepareExclusiveRefund(d,x.id,1500,'全退','管理员','r2');exclusiveRefunds.settleExclusiveRefund(d,r.id);exclusiveRefunds.settleExclusiveRefund(d,r.id);
assert.equal(d.prepare('SELECT stock FROM shop_products WHERE id=?').get('p1').stock,3);
assert.equal(d.prepare('SELECT SUM(total_amount) n FROM shop_sales').get().n,0);
assert.equal(core.orderById(d,x.id).status,'refunded');
}finally{d.close();}});
test('多人卡片逐客户部分和全额退款，不撤销其他客户权益',()=>{const d=exclusiveDb();try{
const o=exclusive.createExclusive(d,advisor,offerInput());const x=exclusive.claimExclusive(d,o,1,claimInput()),y=exclusive.claimExclusive(d,o,2,claimInput());
for(const p of [x,y])core.settlePaid(d,p.id,'wechat','refund-'+p.id,4500);
let r=exclusiveRefunds.prepareExclusiveRefund(d,x.id,500,'部分退','管理员','r1');exclusiveRefunds.settleExclusiveRefund(d,r.id);
assert.equal(d.prepare('SELECT status FROM CourseAuthorization WHERE member_id=1').get().status,'active');
assert.throws(()=>exclusiveRefunds.prepareExclusiveRefund(d,x.id,4500,'超额','管理员','r-too'),/超过/);
r=exclusiveRefunds.prepareExclusiveRefund(d,x.id,4000,'全退','管理员','r2');exclusiveRefunds.settleExclusiveRefund(d,r.id);
assert.equal(d.prepare('SELECT status FROM CourseAuthorization WHERE member_id=1').get().status,'revoked');
assert.equal(d.prepare('SELECT status FROM CourseAuthorization WHERE member_id=2').get().status,'active');
assert.equal(exclusive.publicExclusive(d,o).status,'pending');
}finally{d.close();}});
test('停收卡片阻止已确认交易发起支付，全额退款处理期间禁止发货',async()=>{const d=exclusiveDb();const oldAvailability=pay.paymentAvailability,oldStart=pay.startPayment;global.__testShopDb={prepare:d.prepare.bind(d),exec:d.exec.bind(d),transaction:d.transaction.bind(d),close(){}};try{
const o=exclusive.createExclusive(d,advisor,offerInput({kind:'goods',targetId:'p1',unitFen:1000,shippingFen:200,discountFen:100}));
const x=exclusive.claimExclusive(d,o,1,claimInput({totalFen:1100,shipping:{recipient:'测试',phone:'13800000001',address:'湖南长沙测试路1号'}}));assert.equal(x.items[0].unit_fen,1000);assert.equal(x.exclusive.shippingFen,200);assert.equal(x.exclusive.discountFen,100);
d.prepare("UPDATE exclusive_orders SET status='cancelled' WHERE id=?").run(o.id);pay.paymentAvailability=()=>({wechat:true,alipay:true});pay.startPayment=()=>{throw Error('不应调用网关')};
await assert.rejects(service.payOrder(x.id,1,{mobile:false,wechatBrowser:false,ip:'127.0.0.1'}),/停止收款/);
core.settlePaid(d,x.id,'wechat','late-callback-valid-payment',1100);
const r=exclusiveRefunds.prepareExclusiveRefund(d,x.id,1100,'全退','管理员','full');assert.throws(()=>service.fulfillOrder(d,x.id,'测试快递','TEST123','管理员'),/仅已付款/);
exclusiveRefunds.settleExclusiveRefund(d,r.id);assert.equal(core.publicOrder(d,core.orderById(d,x.id)).exclusive.refundedFen,1100);
}finally{pay.paymentAvailability=oldAvailability;pay.startPayment=oldStart;d.close();}});
