import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const module = { exports: {} };
  const out = ts.transpileModule(
    fs.readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  new Function("require", "module", "exports", out)(
    (name) => (name in mocks ? mocks[name] : require(name)),
    module,
    module.exports,
  );
  return module.exports;
}
const registration = load("../src/lib/server/bonus-registration.ts");
const permissions = load("../src/lib/server/bonus-permissions.ts");
const service = load("../src/lib/server/bonus-management.ts", {
  "./bonus-registration": registration,
  "./authorization-commission": {
    onlineAuthorizationCommissions: () => [
      {
        id: 2,
        date: "2026-10-02",
        sales: "伊琳",
        source: "online",
        amount: 1000,
        commissionAmount: 150,
        commissionRate: 15,
        courseName: "线上课",
      },
    ],
  },
});
const actor = { id: 10, name: "授课老师A" },
  period = "2026-10";
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE Payment(id INTEGER PRIMARY KEY,date TEXT,created_at TEXT,sales TEXT,amount REAL,commissionAmount REAL,commissionRate REAL,courseName TEXT);
INSERT INTO Payment VALUES(1,'2026-10-01','','伊琳',1000,200,20,'线下课'),(3,'2026-10-01','','伊娃老师',1000,200,20,'线下课');
CREATE TABLE CommissionSettlement(periodType TEXT,period TEXT,advisor TEXT,status TEXT,settledAt TEXT,settledBy TEXT,updated_at TEXT,UNIQUE(periodType,period,advisor));`);
  const db = {
    prepare: (sql) => sqlite.prepare(sql),
    exec: (sql) => sqlite.exec(sql),
    close() {},
    transaction:
      (fn) =>
      (...args) => {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          const r = fn(...args);
          sqlite.exec("COMMIT");
          return r;
        } catch (e) {
          sqlite.exec("ROLLBACK");
          throw e;
        }
      },
  };
  service.ensureBonusTables(db);
  return { db, sqlite };
}
const product = (extras = {}) => ({
  kind: "product",
  period,
  date: "2026-10-05",
  channel: "淘宝",
  shop: "伊娃店",
  orderNo: "001",
  items: "练功服×2",
  received: 1000,
  rate: 25,
  basisConfirmed: true,
  ...extras,
});
const lesson = (extras = {}) => ({
  kind: "lesson",
  period,
  date: "2026-10-06",
  course: "基础班",
  slot: "18:00-19:00",
  sessions: 2,
  unit: 150,
  ...extras,
});
test("商品实收计提到伊琳，跨登记人及渠道订单去重，线下编号自动生成", () => {
  const { db, sqlite } = fixture();
  try {
    const first = service.saveBonusEntry(db, product(), actor, true);
    assert.equal(first.updated, false);
    const updated = service.saveBonusEntry(
      db,
      product({ received: 2000 }),
      { id: 11, name: "另一老师" },
      true,
    );
    assert.equal(updated.id, first.id);
    assert.equal(updated.updated, true);
    service.saveBonusEntry(db, product({ channel: "抖音" }), actor, true);
    service.saveBonusEntry(
      db,
      product({ channel: "线下", orderNo: "" }),
      actor,
      true,
    );
    const row = service
      .bonusSummary(db, period)
      .find((r) => r.person === "伊琳");
    assert.equal(row.product, 1000);
    assert.equal(row.online, 150);
    assert.equal(row.offline, 200);
    assert.equal(row.total, 1350);
    assert.ok(
      !service.bonusSummary(db, period).some((r) => r.person === "伊娃老师"),
    );
    assert.equal(
      sqlite
        .prepare("SELECT creatorId FROM BonusEntry WHERE id=?")
        .get(first.id).creatorId,
      10,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          product(),
          { id: 11, name: "另一老师" },
          false,
        ),
      /其他登记人/,
    );
  } finally {
    sqlite.close();
  }
});
test("非法金额、比例、退款和月份不能进入结算", () => {
  const { db, sqlite } = fixture();
  try {
    for (const received of [-1, "oops", null, ""])
      assert.throws(() =>
        service.saveBonusEntry(db, product({ received }), actor, true),
      );
    assert.throws(
      () => service.saveBonusEntry(db, product({ rate: 101 }), actor, true),
      /比例/,
    );
    assert.throws(
      () => service.saveBonusEntry(db, product({ refund: 100 }), actor, true),
      /退款/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          product({ basisConfirmed: false }),
          actor,
          true,
        ),
      /核对/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(db, product({ period: "2026-13" }), actor, true),
      /月份/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          product({ date: "2026-02-30" }),
          actor,
          true,
        ),
      /日期/,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM BonusEntry").get().n,
      0,
    );
  } finally {
    sqlite.close();
  }
});
test("课时按登记账号归属，逐行不同单价；同一期次同一天重复需核对并提供原因", () => {
  const { db, sqlite } = fixture();
  try {
    service.saveBonusEntry(db, lesson({ person: "其他人" }), actor, false);
    assert.throws(
      () => service.saveBonusEntry(db, lesson(), actor, false),
      /重复/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          lesson({ duplicateConfirmed: true }),
          actor,
          false,
        ),
      /原因/,
    );
    service.saveBonusEntry(
      db,
      lesson({
        sessions: 3,
        unit: 200,
        duplicateConfirmed: true,
        reason: "共同授课核对",
      }),
      actor,
      false,
    );
    const row = service
      .bonusSummary(db, period)
      .find((r) => r.person === actor.name);
    assert.equal(row.lesson, 900);
    assert.equal(row.details.length, 2);
    assert.throws(
      () => service.saveBonusEntry(db, lesson({ sessions: 1.5 }), actor, false),
      /整数/,
    );
  } finally {
    sqlite.close();
  }
});
test("标准按生效日期选取，覆盖比例留审计、单价调整要求原因，历史金额不随标准重算", () => {
  const { db, sqlite } = fixture();
  try {
    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Shanghai",
    }).format(new Date());
    service.saveBonusStandard(
      db,
      { effectiveDate: today, productRate: 30, lessonUnit: 180 },
      "管理员",
    );
    const future = today;
    service.saveBonusEntry(
      db,
      product({ date: future, period: future.slice(0, 7), rate: 25 }),
      actor,
      true,
    );
    service.saveBonusEntry(
      db,
      product({ date: future, period: future.slice(0, 7), rate: 30 }),
      actor,
      true,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          lesson({ date: future, period: future.slice(0, 7), unit: 150 }),
          actor,
          true,
        ),
      /原因/,
    );
    assert.throws(
      () =>
        service.saveBonusStandard(
          db,
          { effectiveDate: "2000-01-01", productRate: 25 },
          "管理员",
        ),
      /未来/,
    );
  } finally {
    sqlite.close();
  }
});
test("确认保存快照并锁定导入和调整；后续源数据改变不影响确认金额，确认不记支出", () => {
  const { db, sqlite } = fixture();
  try {
    service.saveBonusEntry(db, product(), actor, true);
    db.transaction(() => service.confirmBonus(db, period, "伊琳", "审核员"))();
    const first = service
      .bonusSummary(db, period)
      .find((r) => r.person === "伊琳");
    assert.equal(first.total, 600);
    assert.equal(first.audit, "confirmed");
    assert.equal(first.payout, "unpaid");
    assert.equal(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE name='FinanceExpense'",
        )
        .get().n,
      0,
    );
    sqlite.exec("UPDATE Payment SET commissionAmount=999");
    assert.equal(
      service.bonusSummary(db, period).find((r) => r.person === "伊琳").total,
      600,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(db, product({ received: 3000 }), actor, true),
      /已确认/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          {
            kind: "adjustment",
            period,
            date: "2026-10-06",
            person: "伊琳",
            amount: -100,
            reason: "更正",
          },
          actor,
          true,
        ),
      /已确认/,
    );
    assert.throws(
      () => service.confirmBonus(db, period, "伊琳", "审核员"),
      /已确认/,
    );
  } finally {
    sqlite.close();
  }
});
test("发放必须先确认，以快照金额记账；重复请求不产生第二笔支出", () => {
  const { db, sqlite } = fixture();
  try {
    assert.throws(
      () =>
        service.payBonus(db, period, "伊琳", "财务", "2026-10-13", "流水001"),
      /先审核/,
    );
    db.transaction(() => service.confirmBonus(db, period, "伊琳", "审核员"))();
    assert.throws(
      () =>
        db.transaction(() =>
          service.payBonus(db, period, "伊琳", "财务", "2026-10-13", ""),
        )(),
      /凭证/,
    );
    const first = db.transaction(() =>
      service.payBonus(db, period, "伊琳", "财务", "2026-10-13", "流水001"),
    )();
    const second = db.transaction(() =>
      service.payBonus(db, period, "伊琳", "财务", "2026-10-13", "流水001"),
    )();
    assert.equal(first.expenseId, second.expenseId);
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM FinanceExpense").get().n,
      1,
    );
    assert.equal(
      sqlite.prepare("SELECT amount FROM FinanceExpense").get().amount,
      350,
    );
    assert.equal(service.bonusSummary(db, period)[0].payout, "paid");
  } finally {
    sqlite.close();
  }
});
test("正负调整需要管理员与原因；历史已结清月份不重复记账", () => {
  const { db, sqlite } = fixture();
  try {
    const adj = {
      kind: "adjustment",
      period,
      date: "2026-10-13",
      person: "伊琳",
      amount: -100,
      reason: "差额",
    };
    assert.throws(
      () => service.saveBonusEntry(db, adj, actor, false),
      /管理员/,
    );
    service.saveBonusEntry(db, adj, actor, true);
    assert.equal(service.bonusSummary(db, period)[0].total, 250);
    sqlite.exec(
      "INSERT INTO CommissionSettlement VALUES('month','2026-10','伊琳','settled','2026-10-12','旧审核人','')",
    );
    assert.equal(service.bonusSummary(db, period)[0].legacy, true);
    assert.throws(
      () => service.confirmBonus(db, period, "伊琳", "管理员"),
      /历史已结清/,
    );
  } finally {
    sqlite.close();
  }
});
function routeFixture() {
  const f = fixture();
  const helpers = {
    hasAuth: (r) => r.headers.get("auth") === "yes",
    hasPermission: () => true,
    isSuperAdminRequest: (r) => r.headers.get("admin") === "yes",
    authPayloadFromRequest: () => ({ id: 10, username: "teacher" }),
    openTrainingDb: () => f.db,
    unauthorized: () => Response.json({ error: "未登录" }, { status: 401 }),
  };
  const route = load("../src/app/api/bonus-management/route.ts", {
    "../training-db": helpers,
    "../_local-auth": { findLocalUser: () => ({ name: actor.name }) },
    "@/lib/server/bonus-management": service,
    "@/lib/server/bonus-permissions": permissions,
    "@/lib/server/bonus-registration": registration,
  });
  return { ...f, route };
}
const req = (body, admin = true, auth = true) =>
  new Request("http://test/api/bonus-management", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      auth: auth ? "yes" : "no",
      admin: admin ? "yes" : "no",
    },
    body: JSON.stringify(body),
  });
test("API拒绝未登录和普通人员审核，整批导入错误回滚", async () => {
  const { route, sqlite } = routeFixture();
  try {
    assert.equal((await route.POST(req(product(), true, false))).status, 401);
    assert.equal(
      (
        await route.POST(
          req({ action: "confirm", period, person: "伊琳" }, false),
        )
      ).status,
      403,
    );
    const res = await route.POST(
      req({
        action: "import",
        rows: [product(), product({ orderNo: "002", received: -1 })],
      }),
    );
    assert.equal(res.status, 400);
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM BonusEntry").get().n,
      0,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM BonusAudit").get().n,
      0,
    );
    assert.equal(
      (
        await route.POST(
          req({
            action: "import",
            rows: [product(), product({ received: 2000 })],
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM BonusEntry").get().n,
      1,
    );
  } finally {
    sqlite.close();
  }
});
test("审核期间明细发生变化时拒绝旧页面确认", () => {
  const { db, sqlite } = fixture();
  try {
    const expected = JSON.stringify(
      service.bonusSummary(db, period).find((r) => r.person === "伊琳"),
    );
    service.saveBonusEntry(db, product(), actor, true);
    assert.throws(
      () => service.confirmBonus(db, period, "伊琳", "审核员", expected),
      /明细已变化/,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM BonusMonthly").get().n,
      0,
    );
  } finally {
    sqlite.close();
  }
});
test("未确认调整可移到另一人员，原归属与新归属均留下操作记录", () => {
  const { db, sqlite } = fixture();
  try {
    const input = {
      kind: "adjustment",
      period,
      date: "2026-10-13",
      person: "伊琳",
      amount: -100,
      reason: "差额",
    };
    const r = service.saveBonusEntry(db, input, actor, true);
    service.saveBonusEntry(
      db,
      { ...input, id: r.id, person: "海艳" },
      actor,
      true,
    );
    assert.equal(
      service.bonusSummary(db, period).find((r) => r.person === "伊琳")
        .adjustment,
      0,
    );
    assert.equal(
      service.bonusSummary(db, period).find((r) => r.person === "海艳")
        .adjustment,
      -100,
    );
    assert.equal(
      sqlite
        .prepare("SELECT COUNT(*) AS n FROM BonusAudit WHERE action='移出登记'")
        .get().n,
      1,
    );
  } finally {
    sqlite.close();
  }
});
test("旧结清接口对历史流程保持幂等，对新版确认快照禁止覆盖与记账", async () => {
  const { db, sqlite } = fixture();
  const helpers = {
    hasAuth: () => true,
    isSuperAdminRequest: () => true,
    authPayloadFromRequest: () => ({ username: "lilei" }),
    openTrainingDb: () => db,
    cleanText: (v, f = "") => String(v ?? "").trim() || f,
    toNumber: (v) => Number(v || 0),
    nowIso: () => new Date().toISOString(),
    unauthorized: () => Response.json({}, { status: 401 }),
    jsonError: (error, status) => Response.json({ error }, { status }),
  };
  const route = load("../src/app/api/commission-settlements/route.ts", {
    "../training-db": helpers,
    "../_local-auth": {
      findLocalUser: () => ({ username: "lilei", status: "active" }),
    },
    "@/lib/server/bonus-permissions": permissions,
    "@/lib/server/bonus-registration": registration,
    "@/lib/server/authorization-commission": {
      onlineAuthorizationCommissions: () => [],
    },
  });
  const request = (status) =>
    new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ period, advisor: "伊琳", status }),
    });
  try {
    assert.equal((await route.POST(request("settled"))).status, 200);
    assert.equal((await route.POST(request("settled"))).status, 200);
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM FinanceExpense").get().n,
      1,
    );
    assert.equal((await route.POST(request("unsettled"))).status, 200);
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM FinanceExpense").get().n,
      0,
    );
    service.confirmBonus(db, period, "伊琳", "审核员");
    assert.equal((await route.POST(request("unsettled"))).status, 409);
    assert.equal((await route.POST(request("settled"))).status, 409);
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM FinanceExpense").get().n,
      0,
    );
  } finally {
    sqlite.close();
  }
});
test("新版结算Excel实际写出两张表，明细、金额与凭证可读回", async () => {
  const { bonusWorkbook } = load("../src/lib/bonus-export.ts");
  const { default: write } = await import("write-excel-file/node");
  const { default: read } = await import("read-excel-file/node");
  const { db, sqlite } = fixture();
  const path = "/tmp/eva-bonus-export-test.xlsx";
  try {
    service.saveBonusEntry(db, product({ items: "=1+1" }), actor, true);
    const rows = service.bonusSummary(db, period);
    await write(bonusWorkbook(period, rows)).toFile(path);
    const sheets = await read(path);
    assert.equal(sheets.length, 2);
    assert.equal(sheets[0].data[1][sheets[0].data[0].indexOf("应发合计")], 600);
    assert.equal(sheets[1].data.at(-1)[4], "=1+1");
    assert.equal(
      typeof sheets[1].data.at(-1)[sheets[1].data[0].indexOf("金额")],
      "number",
    );
  } finally {
    sqlite.close();
    fs.rmSync(path, { force: true });
  }
});

test("工资与报销分别汇总、入快照和发放金额，普通账号不能改他人报销", () => {
  const { db, sqlite } = fixture();
  try {
    const wage = {
      kind: "salary",
      period,
      date: "2026-10-13",
      person: "伊琳",
      subject: "十月工资",
      amount: 5000,
    };
    service.saveBonusEntry(db, wage, actor, true);
    const reim = {
      kind: "reimbursement",
      period,
      date: "2026-10-13",
      person: "伊琳",
      subject: "采购用品",
      amount: 120,
      voucher: "票据001",
    };
    service.saveBonusEntry(db, reim, actor, true);
    const owned = service.saveBonusEntry(
      db,
      { ...reim, person: "其他人" },
      actor,
      false,
    );
    assert.equal(
      sqlite.prepare("SELECT person FROM BonusEntry WHERE id=?").get(owned.id)
        .person,
      actor.name,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          { ...reim, id: owned.id },
          { id: 11, name: "其他人" },
          false,
        ),
      /本人/,
    );
    const row = service
      .bonusSummary(db, period)
      .find((r) => r.person === "伊琳");
    assert.equal(row.salary, 5000);
    assert.equal(row.reimbursement, 120);
    assert.equal(row.total, 5470);
    assert.equal(
      row.details.find((d) => d.type === "reimbursement").voucher,
      "票据001",
    );
    service.confirmBonus(db, period, "伊琳", "审核员");
    assert.throws(
      () => service.saveBonusEntry(db, { ...wage, amount: 6000 }, actor, true),
      /已确认/,
    );
    db.transaction(() =>
      service.payBonus(db, period, "伊琳", "李雷", "2026-10-13", "发放001"),
    )();
    assert.equal(
      sqlite.prepare("SELECT amount FROM FinanceExpense").get().amount,
      5470,
    );
  } finally {
    sqlite.close();
  }
});
test("工资报销不能登记负数、零或无凭证报销，工资说明和人员必填", () => {
  const { db, sqlite } = fixture();
  try {
    const input = {
      kind: "reimbursement",
      period,
      date: "2026-10-13",
      person: "伊琳",
      subject: "用品",
      voucher: "001",
      amount: 100,
    };
    for (const amount of [-1, 0, null, "oops"])
      assert.throws(() =>
        service.saveBonusEntry(db, { ...input, amount }, actor, true),
      );
    assert.throws(
      () => service.saveBonusEntry(db, { ...input, voucher: "" }, actor, true),
      /凭证/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          { ...input, kind: "salary", subject: "" },
          actor,
          true,
        ),
      /工资说明/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          { ...input, kind: "salary", person: "" },
          actor,
          true,
        ),
      /人员/,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM BonusEntry").get().n,
      0,
    );
  } finally {
    sqlite.close();
  }
});
test("升级前确认快照补零兼容，工资报销不会改变已确认总额", () => {
  const { db, sqlite } = fixture();
  try {
    const original = service
      .bonusSummary(db, period)
      .find((r) => r.person === "伊琳");
    delete original.salary;
    delete original.reimbursement;
    sqlite
      .prepare(
        "INSERT INTO BonusMonthly(period,person,snapshot,reviewedBy,reviewedAt) VALUES(?,?,?,?,?)",
      )
      .run(period, "伊琳", JSON.stringify(original), "原审核员", "2026-10-01");
    const row = service.bonusSummary(db, period)[0];
    assert.equal(row.salary, 0);
    assert.equal(row.reimbursement, 0);
    assert.equal(row.total, 350);
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          {
            kind: "salary",
            period,
            date: "2026-10-13",
            person: "伊琳",
            subject: "工资",
            amount: 100,
          },
          actor,
          true,
        ),
      /已确认/,
    );
  } finally {
    sqlite.close();
  }
});
test("审核仅李雷和伊琳，发放仅李雷，显示名或管理员角色不授予权限", () => {
  assert.deepEqual(
    permissions.bonusPermissions({ username: "lilei", status: "active" }),
    { canReview: true, canPay: true },
  );
  assert.deepEqual(
    permissions.bonusPermissions({ username: "yilin", status: "active" }),
    { canReview: true, canPay: false },
  );
  for (const user of [
    { username: "admin3", name: "李雷", role: "admin", status: "active" },
    { username: "yilin", status: "disabled" },
    null,
  ])
    assert.deepEqual(permissions.bonusPermissions(user), {
      canReview: false,
      canPay: false,
    });
});
test("后端审核发放按已验证账号校验，伊琳审核成功但不能发放，其他管理员不能审核", async () => {
  const { db, sqlite } = fixture();
  let username = "yilin";
  const route = load("../src/app/api/bonus-management/route.ts", {
    "../training-db": {
      hasAuth: () => true,
      hasPermission: () => false,
      isSuperAdminRequest: () => true,
      authPayloadFromRequest: () => ({ id: 2, username }),
      openTrainingDb: () => db,
      unauthorized: () => Response.json({}, { status: 401 }),
    },
    "../_local-auth": {
      findLocalUser: () => ({
        username,
        status: "active",
        name: username === "yilin" ? "伊琳" : "李雷",
      }),
    },
    "@/lib/server/bonus-management": service,
    "@/lib/server/bonus-permissions": permissions,
    "@/lib/server/bonus-registration": registration,
  });
  try {
    const expectedSnapshot = JSON.stringify(
      service.bonusSummary(db, period)[0],
    );
    assert.equal(
      (
        await route.POST(
          req({ action: "confirm", period, person: "伊琳", expectedSnapshot }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await route.POST(
          req({
            action: "pay",
            period,
            person: "伊琳",
            paidDate: "2026-10-13",
            voucher: "001",
          }),
        )
      ).status,
      403,
    );
    username = "admin3";
    assert.equal(
      (
        await route.POST(
          req({ action: "confirm", period, person: "伊琳", expectedSnapshot }),
        )
      ).status,
      403,
    );
    username = "lilei";
    assert.equal(
      (
        await route.POST(
          req({
            action: "pay",
            period,
            person: "伊琳",
            paidDate: "2026-10-13",
            voucher: "001",
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM FinanceExpense").get().n,
      1,
    );
  } finally {
    sqlite.close();
  }
});
test("伊琳及其他管理员不能通过旧结清API绕过发放限制", async () => {
  const { db, sqlite } = fixture();
  let username = "yilin";
  const route = load("../src/app/api/commission-settlements/route.ts", {
    "../training-db": {
      hasAuth: () => true,
      authPayloadFromRequest: () => ({ username }),
      openTrainingDb: () => db,
    },
    "../_local-auth": { findLocalUser: () => ({ username, status: "active" }) },
    "@/lib/server/bonus-permissions": permissions,
    "@/lib/server/bonus-registration": registration,
    "@/lib/server/authorization-commission": {
      onlineAuthorizationCommissions: () => [],
    },
  });
  try {
    for (const name of ["yilin", "admin3"]) {
      username = name;
      assert.equal(
        (await route.POST(req({ period, advisor: "伊琳", status: "settled" })))
          .status,
        403,
      );
    }
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM CommissionSettlement").get().n,
      0,
    );
  } finally {
    sqlite.close();
  }
});

test("零提成订单忽略，学员姓名透传，原订单及非零提成保留", () => {
  const { db, sqlite } = fixture();
  sqlite.exec("ALTER TABLE Payment ADD COLUMN memberName TEXT");
  sqlite.exec("UPDATE Payment SET memberName='学员甲' WHERE id=1");
  sqlite.exec(
    "INSERT INTO Payment(id,date,sales,amount,commissionAmount,commissionRate,memberName) VALUES(10,'2026-10-01','零提成顾问',1000,0,0,'学员乙'),(11,'2026-10-01','伊琳',0,30,0,'学员丙')",
  );
  const rows = service.bonusSummary(db, period);
  assert.equal(
    rows.some((r) => r.person === "零提成顾问"),
    false,
  );
  const row = rows.find((r) => r.person === "伊琳");
  assert.equal(row.total, 380);
  assert.equal(row.details.find((d) => d.id === 1).memberName, "学员甲");
  assert.equal(row.details.find((d) => d.id === 11).amount, 30);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM Payment").get().n, 4);
});
test("已确认快照仅隐藏零明细并补学员姓名，快照原文与应发金额不变", () => {
  const { db, sqlite } = fixture();
  sqlite.exec("ALTER TABLE Payment ADD COLUMN memberName TEXT");
  sqlite.exec("UPDATE Payment SET memberName='学员甲' WHERE id=1");
  const snapshot = service
    .bonusSummary(db, period)
    .find((r) => r.person === "伊琳");
  snapshot.details.push({ ...snapshot.details[0], id: 99, amount: 0 });
  const original = JSON.stringify(snapshot);
  service.confirmBonus(db, period, "伊琳", "李雷");
  sqlite.prepare("UPDATE BonusMonthly SET snapshot=?").run(original);
  const result = service
    .bonusSummary(db, period)
    .find((r) => r.person === "伊琳");
  assert.equal(
    result.details.some((d) => d.amount === 0),
    false,
  );
  assert.equal(result.total, snapshot.total);
  assert.equal(
    sqlite.prepare("SELECT snapshot FROM BonusMonthly").get().snapshot,
    original,
  );
});

test("导出排除零金额并包含学员姓名及负数调整", () => {
  const { bonusWorkbook } = load("../src/lib/bonus-export.ts");
  const { db } = fixture();
  const rows = service.bonusSummary(db, period);
  rows[0].details[0].memberName = "学员甲";
  rows[0].details.push({ ...rows[0].details[0], amount: 0 });
  rows[0].details.push({
    ...rows[0].details[0],
    type: "adjustment",
    amount: -20,
  });
  const detail = bonusWorkbook(period, rows)[1].data;
  const headers = detail[0].map((c) => c.value);
  assert.equal(detail.length, 4);
  assert.equal(detail[1][headers.indexOf("学员姓名")].value, "学员甲");
  assert.equal(detail.at(-1)[headers.indexOf("金额")].value, -20);
});

test("普通账号工资登记强制本人归属，不能修改他人工资或已确认结算", () => {
  const { db, sqlite } = fixture();
  try {
    const input = {
      kind: "salary",
      period,
      date: "2026-10-13",
      person: "其他人",
      subject: "本月工资",
      amount: 3000,
    };
    const saved = service.saveBonusEntry(
      db,
      input,
      { id: 4, name: "海艳" },
      false,
    );
    assert.equal(
      sqlite.prepare("SELECT person FROM BonusEntry WHERE id=?").get(saved.id)
        .person,
      "海艳",
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          { ...input, id: saved.id },
          { id: 5, name: "其他人" },
          false,
        ),
      /本人/,
    );
    const summary = service
      .bonusSummary(db, period)
      .find((r) => r.person === "海艳");
    service.confirmBonus(db, period, "海艳", "伊琳", JSON.stringify(summary));
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          { ...input, id: saved.id },
          { id: 4, name: "海艳" },
          false,
        ),
      /已确认/,
    );
  } finally {
    sqlite.close();
  }
});

function catalogFixture() {
  const f = fixture();
  f.sqlite
    .exec(`CREATE TABLE shop_products(id TEXT PRIMARY KEY,name TEXT,spec TEXT,size TEXT,color TEXT,stock INTEGER,status TEXT,is_hidden INTEGER,sale_price REAL,updated_at TEXT);
 INSERT INTO shop_products VALUES('p1','舞服','基础','M','黑',10,'在售',0,100,''),('p2','裙子','基础','L','红',2,'在售',0,200,'');
 CREATE TABLE shop_stock_logs(product_id TEXT,product_name TEXT,change_type TEXT,quantity INTEGER,before_stock INTEGER,after_stock INTEGER,operator TEXT,remark TEXT,channel TEXT);
 CREATE TABLE Course(id INTEGER PRIMARY KEY,name TEXT,subType TEXT,startDate TEXT,endDate TEXT,series_id INTEGER,templateId INTEGER);
 INSERT INTO Course VALUES(1,'集训','一期','2026-10-01','2026-10-05',0,1),(2,'集训','二期','2026-11-01','2026-11-05',0,1),(3,'线上课','','','',1,0);`);
  return f;
}
const skuProduct = (extras = {}) =>
  product({
    shop: undefined,
    requireCatalog: true,
    productLines: [{ productId: "p1", quantity: 2 }],
    salesperson: "海艳",
    ...extras,
  });
test("商城规格扣库存、重复登记及重试不重复扣、修改差额与删除回补", () => {
  const { db, sqlite } = catalogFixture();
  try {
    const save = (v) =>
      db.transaction(() => service.saveBonusEntry(db, v, actor, true))();
    const r = save(
      skuProduct({
        requestKey: "retry-001",
        orderNo: undefined,
        channel: "线下",
      }),
    );
    assert.equal(
      sqlite.prepare("SELECT stock FROM shop_products WHERE id='p1'").get()
        .stock,
      8,
    );
    const retried = save(
      skuProduct({
        requestKey: "retry-001",
        orderNo: undefined,
        channel: "线下",
      }),
    );
    assert.equal(r.id, retried.id);
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) n FROM shop_stock_logs").get().n,
      1,
    );
    save(
      skuProduct({
        id: r.id,
        orderNo: undefined,
        channel: "线下",
        productLines: [{ productId: "p1", quantity: 4 }],
      }),
    );
    assert.equal(
      sqlite.prepare("SELECT stock FROM shop_products WHERE id='p1'").get()
        .stock,
      6,
    );
    save(
      skuProduct({
        id: r.id,
        orderNo: undefined,
        channel: "线下",
        productLines: [
          { productId: "p1", quantity: 1 },
          { productId: "p2", quantity: 1 },
        ],
      }),
    );
    assert.equal(
      sqlite.prepare("SELECT stock FROM shop_products WHERE id='p1'").get()
        .stock,
      9,
    );
    const row = sqlite.prepare("SELECT * FROM BonusEntry WHERE id=?").get(r.id);
    db.transaction(() =>
      registration.syncBonusStock(
        db,
        JSON.parse(row.data).productLines,
        [],
        actor.name,
        "线下",
        r.id,
      ),
    )();
    assert.deepEqual(
      sqlite
        .prepare("SELECT stock FROM shop_products ORDER BY id")
        .all()
        .map((p) => p.stock),
      [10, 2],
    );
  } finally {
    sqlite.close();
  }
});
test("多规格库存不足整笔回滚，金额、人员、规格和锁定失败不动库存", () => {
  const { db, sqlite } = catalogFixture();
  try {
    const save = (v) =>
      db.transaction(() => service.saveBonusEntry(db, v, actor, true))();
    for (const invalid of [
      { salesperson: "" },
      { productLines: [] },
      { productLines: [{ productId: "p1", quantity: 1.5 }] },
      {
        productLines: [
          { productId: "p1", quantity: 2 },
          { productId: "p2", quantity: 3 },
        ],
      },
    ])
      assert.throws(() => save(skuProduct(invalid)));
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) n FROM BonusEntry").get().n,
      0,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) n FROM shop_stock_logs").get().n,
      0,
    );
    assert.equal(
      sqlite.prepare("SELECT stock FROM shop_products WHERE id='p1'").get()
        .stock,
      10,
    );
    save(skuProduct());
    const row = service
      .bonusSummary(db, period)
      .find((r) => r.person === "伊琳");
    service.confirmBonus(db, period, "伊琳", "伊琳", JSON.stringify(row));
    assert.throws(
      () =>
        save(skuProduct({ productLines: [{ productId: "p1", quantity: 4 }] })),
      /已确认/,
    );
    assert.equal(
      sqlite.prepare("SELECT stock FROM shop_products WHERE id='p1'").get()
        .stock,
      8,
    );
  } finally {
    sqlite.close();
  }
});
test("课时选择期次使用数据库名称，拒绝线上课程，重复仅比较具体期次", () => {
  const { db, sqlite } = catalogFixture();
  try {
    const r = service.saveBonusEntry(
      db,
      lesson({ courseId: 1, requireCourse: true, course: "伪造名称" }),
      actor,
      false,
    );
    assert.match(
      JSON.parse(
        sqlite.prepare("SELECT data FROM BonusEntry WHERE id=?").get(r.id).data,
      ).course,
      /一期/,
    );
    service.saveBonusEntry(
      db,
      lesson({ courseId: 2, requireCourse: true }),
      actor,
      false,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          lesson({ courseId: 1, requireCourse: true }),
          actor,
          false,
        ),
      /已有登记/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          lesson({ courseId: 3, requireCourse: true }),
          actor,
          false,
        ),
      /有效/,
    );
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          lesson({ requireCourse: true }),
          actor,
          false,
        ),
      /期次/,
    );
  } finally {
    sqlite.close();
  }
});
test("报销新登记必须有本人上传截图，历史文字凭证可保留", () => {
  const { db, sqlite } = fixture();
  try {
    const input = {
      kind: "reimbursement",
      date: "2026-10-13",
      period,
      amount: 100,
      subject: "用品",
      requireScreenshots: true,
    };
    assert.throws(
      () => service.saveBonusEntry(db, input, actor, false),
      /上传/,
    );
    sqlite
      .prepare("INSERT INTO BonusVoucher VALUES(?,?,?,?)")
      .run("a.webp", actor.id, "发票.png", "");
    sqlite
      .prepare("INSERT INTO BonusVoucher VALUES(?,?,?,?)")
      .run("b.webp", 99, "别人的.png", "");
    assert.throws(
      () =>
        service.saveBonusEntry(
          db,
          { ...input, voucherFiles: [{ filename: "b.webp" }] },
          actor,
          false,
        ),
      /不属于/,
    );
    const r = service.saveBonusEntry(
      db,
      {
        ...input,
        voucherFiles: [{ filename: "a.webp", url: "https://evil.test" }],
      },
      actor,
      false,
    );
    assert.match(
      JSON.parse(
        sqlite.prepare("SELECT data FROM BonusEntry WHERE id=?").get(r.id).data,
      ).voucherFiles[0].url,
      /^\/api\/bonus-management/,
    );
    const old = service.saveBonusEntry(
      db,
      { ...input, requireScreenshots: false, voucher: "历史票据编号" },
      actor,
      false,
    );
    service.saveBonusEntry(db, { ...input, id: old.id }, actor, false);
  } finally {
    sqlite.close();
  }
});
test("已有商城订单拒绝二次出库，表格重导不能移除已扣库存关联", () => {
  const { db, sqlite } = catalogFixture();
  try {
    sqlite.exec(
      "CREATE TABLE shop_online_orders(id TEXT,transaction_id TEXT);INSERT INTO shop_online_orders VALUES('商城001','流水001')",
    );
    const save = (v) =>
      db.transaction(() => service.saveBonusEntry(db, v, actor, true))();
    assert.throws(() => save(skuProduct({ orderNo: "流水001" })), /已由商城/);
    save(skuProduct());
    assert.throws(() => save(product({ shop: "统一销售" })), /关联库存/);
    assert.equal(
      sqlite.prepare("SELECT stock FROM shop_products WHERE id='p1'").get()
        .stock,
      8,
    );
  } finally {
    sqlite.close();
  }
});

test("截图上传压缩、读取需登录，伪造图片与超限附件被拒绝", async () => {
  const os = await import("node:os"),
    path = await import("node:path"),
    fsp = await import("node:fs/promises");
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "eva-bonus-voucher-test-"),
  );
  const { db, sqlite } = fixture();
  const helpers = {
    hasAuth: (r) => r.headers.get("auth") === "yes",
    hasPermission: () => true,
    authPayloadFromRequest: () => ({ id: actor.id, username: "teacher" }),
    openTrainingDb: () => db,
    unauthorized: () => Response.json({ error: "未登录" }, { status: 401 }),
  };
  const safePath = {
    ...path.default,
    join: (...parts) =>
      path.join(parts[0] === process.cwd() ? dir : parts[0], ...parts.slice(1)),
  };
  const upload = load("../src/app/api/bonus-management/vouchers/route.ts", {
    "../../training-db": helpers,
    "node:path": safePath,
    "@/lib/server/voucher-image": load("../src/lib/server/voucher-image.ts"),
    "@/lib/server/bonus-management": service,
  });
  const view = load(
    "../src/app/api/bonus-management/vouchers/[filename]/route.ts",
    {
      "../../../training-db": helpers,
      "node:path": safePath,
      "@/lib/server/bonus-permissions": permissions,
      "../../../_local-auth": {
        findLocalUser: () => ({ username: "teacher", status: "active" }),
      },
    },
  );
  try {
    const png = await require("sharp")({
      create: { width: 300, height: 100, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append("file", new File([png], "报销截图.png", { type: "image/png" }));
    const resp = await upload.POST(
      new Request("http://test", {
        method: "POST",
        headers: { auth: "yes" },
        body: form,
      }),
    );
    assert.equal(resp.status, 200);
    const result = await resp.json();
    assert.match(result.data.filename, /\.webp$/);
    const ctx = { params: Promise.resolve({ filename: result.data.filename }) };
    assert.equal((await view.GET(new Request("http://test"), ctx)).status, 401);
    const img = await view.GET(
      new Request("http://test", { headers: { auth: "yes" } }),
      ctx,
    );
    assert.equal(img.status, 200);
    assert.equal(img.headers.get("content-type"), "image/webp");
    assert.ok((await img.arrayBuffer()).byteLength > 0);
    assert.equal(
      (
        await view.GET(
          new Request("http://test", { headers: { auth: "yes" } }),
          { params: Promise.resolve({ filename: "../outside.webp" }) },
        )
      ).status,
      400,
    );
    const bad = new FormData();
    bad.append(
      "file",
      new File(["not image"], "fake.png", { type: "image/png" }),
    );
    assert.equal(
      (
        await upload.POST(
          new Request("http://test", {
            method: "POST",
            headers: { auth: "yes" },
            body: bad,
          }),
        )
      ).status,
      400,
    );
    const large = new FormData();
    large.append(
      "file",
      new File([new Uint8Array(12 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    );
    assert.equal(
      (
        await upload.POST(
          new Request("http://test", {
            method: "POST",
            headers: { auth: "yes" },
            body: large,
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) n FROM BonusVoucher").get().n,
      1,
    );
  } finally {
    sqlite.close();
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("课时费无需上课时段，按期次及日期核对重复，编辑保留历史时段", () => {
  const { db, sqlite } = fixture();
  try {
    const first = service.saveBonusEntry(db, lesson({slot:undefined}), actor, false);
    const read = () => JSON.parse(sqlite.prepare("SELECT data FROM BonusEntry WHERE id=?").get(first.id).data);
    assert.equal(read().slot, "");
    assert.throws(()=>service.saveBonusEntry(db,lesson({slot:"20:00-21:00"}),actor,false),/同一期次同一天/);
    const historical={...read(),slot:"18:00-19:00"};
    sqlite.prepare("UPDATE BonusEntry SET data=? WHERE id=?").run(JSON.stringify(historical),first.id);
    service.saveBonusEntry(db,lesson({id:first.id,slot:undefined,unit:180}),actor,false);
    assert.equal(read().slot,"18:00-19:00");
    assert.equal(sqlite.prepare("SELECT amount FROM BonusEntry WHERE id=?").get(first.id).amount,360);
    service.saveBonusEntry(db,lesson({slot:undefined,date:"2026-10-07"}),actor,false);
  } finally { sqlite.close(); }
});
