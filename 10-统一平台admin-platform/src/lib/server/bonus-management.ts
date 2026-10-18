import {
  bonusProductLines,
  syncBonusStock,
  resolveBonusCourse,
  registeredBonusOrder,
  bonusVoucherFiles,
} from "./bonus-registration";
import type { AdminDb } from "./admin-db";
import { onlineAuthorizationCommissions } from "./authorization-commission";

export type BonusDetail = {
  type: string;
  id: number;
  date: string;
  person: string;
  title: string;
  amount: number;
  memberName?: string;
  base?: number;
  rate?: number;
  channel?: string;
  sessions?: number;
  unit?: number;
  reason?: string;
  voucher?: string;
  voucherFiles?: any[];
  salesperson?: string;
};
export type BonusSummary = {
  person: string;
  online: number;
  offline: number;
  product: number;
  lesson: number;
  adjustment: number;
  salary?: number;
  reimbursement?: number;
  total: number;
  details: BonusDetail[];
  audit: string;
  payout: string;
  reviewedBy?: string;
  reviewedAt?: string;
  paidAt?: string;
  paidBy?: string;
  voucher?: string;
  legacy?: boolean;
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function validMonth(value: unknown) {
  const s = String(value ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new Error("请选择有效结算月份");
  return s;
}
function date(value: unknown) {
  const s = String(value ?? "");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new Error("请输入有效日期");
  return s;
}
function text(value: unknown, label: string) {
  const s = String(value ?? "").trim();
  if (!s || s.length > 1000) throw new Error(`请填写${label}（最多1000字）`);
  return s;
}
function number(value: unknown, label: string, min = 0, max = 999999999) {
  if (
    value === "" ||
    value == null ||
    !Number.isFinite(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw new Error(`${label}无效`);
  return round(Number(value));
}
export function ensureBonusTables(db: AdminDb) {
  db.exec(`CREATE TABLE IF NOT EXISTS BonusEntry(id INTEGER PRIMARY KEY, kind TEXT NOT NULL, period TEXT NOT NULL, person TEXT NOT NULL, date TEXT NOT NULL, data TEXT NOT NULL, amount REAL NOT NULL, creatorId INTEGER, creatorName TEXT, updatedAt TEXT);
    CREATE TABLE IF NOT EXISTS BonusOrderKey(channel TEXT, shop TEXT, orderNo TEXT, entryId INTEGER UNIQUE, UNIQUE(channel,shop,orderNo));
    CREATE TABLE IF NOT EXISTS BonusMonthly(period TEXT, person TEXT, snapshot TEXT NOT NULL, reviewedBy TEXT, reviewedAt TEXT, paidAt TEXT DEFAULT '', paidBy TEXT DEFAULT '', voucher TEXT DEFAULT '', expenseId INTEGER, UNIQUE(period,person));
    CREATE TABLE IF NOT EXISTS BonusStandard(id INTEGER PRIMARY KEY, effectiveDate TEXT UNIQUE, productRate REAL NOT NULL, lessonUnit REAL, actor TEXT, createdAt TEXT);
    CREATE TABLE IF NOT EXISTS BonusVoucher(filename TEXT PRIMARY KEY,ownerId INTEGER NOT NULL,originalName TEXT,createdAt TEXT);
    CREATE TABLE IF NOT EXISTS BonusRegistrationKey(requestKey TEXT PRIMARY KEY,entryId INTEGER UNIQUE);
    CREATE TABLE IF NOT EXISTS BonusAudit(id INTEGER PRIMARY KEY, period TEXT, person TEXT, action TEXT, actor TEXT, detail TEXT, createdAt TEXT);
  `);
}
function log(
  db: AdminDb,
  period: string,
  person: string,
  action: string,
  actor: string,
  detail: unknown,
) {
  db.prepare(
    "INSERT INTO BonusAudit(period,person,action,actor,detail,createdAt) VALUES(?,?,?,?,?,?)",
  ).run(
    period,
    person,
    action,
    actor,
    JSON.stringify(detail),
    new Date().toISOString(),
  );
}
export function assertBonusUnlocked(
  db: AdminDb,
  period: string,
  person: string,
) {
  if (
    db
      .prepare("SELECT 1 FROM BonusMonthly WHERE period=? AND person=?")
      .get(period, person) ||
    db
      .prepare(
        "SELECT 1 FROM CommissionSettlement WHERE periodType='month' AND period=? AND advisor=? AND status='settled'",
      )
      .get(period, person)
  )
    throw new Error(
      "该人员该月已确认或历史已结清，不能覆盖；请在未确认月份新增调整",
    );
}
export function saveBonusEntry(
  db: AdminDb,
  input: any,
  actor: { id: number; name: string },
  admin: boolean,
) {
  const kind = String(input.kind);
  if (
    !["product", "lesson", "adjustment", "salary", "reimbursement"].includes(
      kind,
    )
  )
    throw new Error("登记类型无效");
  if (kind === "adjustment" && !admin) throw new Error("仅管理员可调整结算");
  const entryDate = date(input.date),
    period = validMonth(input.period || entryDate.slice(0, 7));
  const old = input.id
    ? db
        .prepare("SELECT * FROM BonusEntry WHERE id=?")
        .get<any>(Number(input.id))
    : undefined;
  if (input.id && !old) throw new Error("记录不存在");
  if (
    old &&
    input.expectedUpdatedAt &&
    old.updatedAt !== input.expectedUpdatedAt
  )
    throw new Error("登记已被其他操作更新，请刷新后重试");
  if (old && old.kind !== kind) throw new Error("不能修改登记类型");
  if (old && !admin && old.creatorId !== actor.id)
    throw new Error("只能修改本人登记");
  const data: any = { remark: String(input.remark ?? "").slice(0, 1000) };
  let person = actor.name,
    amount = 0,
    duplicate: any;
  if (kind === "product") {
    person = "伊琳";
    data.channel = text(input.channel, "渠道");
    if (!["淘宝", "抖音", "视频号小店", "线下"].includes(data.channel))
      throw new Error("渠道无效");
    data.shop = String(
      input.shop || (old && JSON.parse(old.data).shop) || "统一销售",
    ).trim();
    data.salesperson = input.requireCatalog
      ? text(input.salesperson, "销售人员")
      : String(input.salesperson || actor.name);
    data.orderNo = input.orderNo
      ? text(input.orderNo, "订单号")
      : data.channel === "线下"
        ? `OFF-${crypto.randomUUID()}`
        : text(input.orderNo, "订单号");
    if (input.requireCatalog || input.productLines?.length) {
      data.productLines = bonusProductLines(
        db,
        input.productLines,
        old ? JSON.parse(old.data).productLines : [],
      );
      data.items = text(
        data.productLines
          .map(
            (p: any) =>
              `${p.name}${p.spec ? "（" + p.spec + "）" : ""} × ${p.quantity}`,
          )
          .join("；"),
        "商品及数量",
      );
      if (registeredBonusOrder(db, data.orderNo))
        throw new Error("该订单已由商城扣减库存，请勿重复登记出库");
    } else data.items = text(input.items, "商品及数量");
    data.requestKey = String(
      input.requestKey || (old && JSON.parse(old.data).requestKey) || "",
    ).slice(0, 100);
    data.received = number(input.received, "商品实收");
    data.refund = number(input.refund ?? 0, "退款金额");
    if (data.refund > data.received)
      throw new Error("退款金额不能超过实收金额");
    data.state = String(input.state || "正常");
    if (!["正常", "已退款", "已取消"].includes(data.state))
      throw new Error("订单状态无效");
    if (data.refund > 0 || data.state !== "正常")
      throw new Error("退款及取消订单暂不计提，待确认处理口径后登记");
    if (!input.basisConfirmed) throw new Error("请核对实收计提基数与结算月份");
    const standard = db
      .prepare(
        "SELECT * FROM BonusStandard WHERE effectiveDate<=? ORDER BY effectiveDate DESC LIMIT 1",
      )
      .get<any>(entryDate);
    data.rate = number(
      input.rate ?? standard?.productRate ?? 25,
      "提成比例",
      0,
      100,
    );
    data.voucher = String(input.voucher ?? "").slice(0, 1000);
    data.reason = String(input.reason ?? "").trim();

    amount = round((data.received * data.rate) / 100);
    duplicate = db
      .prepare(
        "SELECT e.* FROM BonusOrderKey k JOIN BonusEntry e ON e.id=k.entryId WHERE channel=? AND shop=? AND orderNo=?",
      )
      .get<any>(data.channel, data.shop, data.orderNo);
    if (!old && data.requestKey) {
      const retried = db
        .prepare(
          "SELECT e.* FROM BonusRegistrationKey k JOIN BonusEntry e ON e.id=k.entryId WHERE requestKey=?",
        )
        .get<any>(data.requestKey);
      if (retried && duplicate && retried.id !== duplicate.id)
        throw new Error("登记编号与订单号冲突，请刷新重试");
      duplicate = duplicate || retried;
      if (retried && !input.orderNo)
        data.orderNo = JSON.parse(retried.data).orderNo;
    }
    if (
      duplicate &&
      JSON.parse(duplicate.data).productLines?.length &&
      !data.productLines?.length
    )
      throw new Error("该订单已关联库存，请通过商品销售登记修改");
    if (duplicate && old && duplicate.id !== old.id)
      throw new Error("订单号已存在");
    if (duplicate && !admin && duplicate.creatorId !== actor.id)
      throw new Error("重复订单属于其他登记人，请管理员核对");
  } else if (kind === "lesson") {
    person = old?.person || actor.name;
    if (input.courseId)
      Object.assign(data, resolveBonusCourse(db, input.courseId));
    else if (input.requireCourse) throw new Error("请搜索线下课程并选择期次");
    else data.course = text(input.course, "课程或班级");
    // Preserve historical metadata on edits; new registrations no longer collect a time slot.
    data.slot = old ? String(JSON.parse(old.data).slot || "") : "";
    data.sessions = number(input.sessions, "节数", 1, 1000);
    if (!Number.isInteger(Number(input.sessions)))
      throw new Error("节数须为整数");
    data.unit = number(input.unit, "每节金额");
    data.reason = String(input.reason ?? "").trim();
    const standard = db
      .prepare(
        "SELECT lessonUnit FROM BonusStandard WHERE effectiveDate<=? ORDER BY effectiveDate DESC LIMIT 1",
      )
      .get<any>(entryDate);
    if (
      standard?.lessonUnit != null &&
      data.unit !== standard.lessonUnit &&
      !data.reason
    )
      throw new Error("调整单节金额请填写原因");
    const conflicts = db
      .prepare(
        "SELECT id,person,data FROM BonusEntry WHERE kind='lesson' AND date=? AND id<>?",
      )
      .all<any>(entryDate, old?.id || 0)
      .filter((e) => {
        const d = JSON.parse(e.data);
        return (
          (data.courseId && d.courseId
            ? Number(d.courseId) === Number(data.courseId)
            : d.course === data.course)
        );
      });
    if (conflicts.length && (!input.duplicateConfirmed || !input.reason))
      throw new Error("同一期次同一天已有登记，请核对并填写原因后确认重复登记");
    data.duplicateConfirmed = Boolean(input.duplicateConfirmed);
    amount = round(data.sessions * data.unit);
  } else if (kind === "salary" || kind === "reimbursement") {
    person = admin ? text(input.person, "归属人员") : old?.person || actor.name;
    data.subject = text(
      input.subject,
      kind === "salary" ? "工资说明" : "报销事项",
    );
    const oldData = old ? JSON.parse(old.data) : {};
    if (kind === "reimbursement" && input.requireScreenshots) {
      data.voucherFiles = bonusVoucherFiles(
        db,
        input.voucherFiles || [],
        actor.id,
        admin,
        oldData.voucherFiles || [],
      );
      if (!data.voucherFiles.length && !oldData.voucher)
        throw new Error("请上传报销截图凭证");
      data.voucher = data.voucherFiles.length
        ? data.voucherFiles.map((f: any) => f.name).join("；")
        : oldData.voucher;
    } else
      data.voucher =
        kind === "reimbursement"
          ? text(input.voucher, "报销凭证说明或流水编号")
          : String(input.voucher ?? "").slice(0, 1000);
    amount = number(
      input.amount,
      kind === "salary" ? "工资金额" : "报销金额",
      0.01,
    );
  } else {
    person = text(input.person, "归属人员");
    data.reason = text(input.reason, "调整原因");
    amount = number(input.amount, "调整金额", -999999999);
  }
  assertBonusUnlocked(db, period, person);
  const previous = old || duplicate;
  if (previous) assertBonusUnlocked(db, previous.period, previous.person);
  const now = new Date().toISOString();
  let id = previous?.id;
  if (id)
    db.prepare(
      "UPDATE BonusEntry SET person=?,period=?,date=?,data=?,amount=?,updatedAt=? WHERE id=?",
    ).run(person, period, entryDate, JSON.stringify(data), amount, now, id);
  else
    id = Number(
      db
        .prepare(
          "INSERT INTO BonusEntry(kind,period,person,date,data,amount,creatorId,creatorName,updatedAt) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(
          kind,
          period,
          person,
          entryDate,
          JSON.stringify(data),
          amount,
          actor.id,
          actor.name,
          now,
        ).lastInsertRowid,
    );
  if (kind === "product") {
    syncBonusStock(
      db,
      previous ? JSON.parse(previous.data).productLines : [],
      data.productLines,
      actor.name,
      data.channel,
      Number(id),
    );
    if (data.requestKey)
      db.prepare(
        "INSERT OR IGNORE INTO BonusRegistrationKey(requestKey,entryId) VALUES(?,?)",
      ).run(data.requestKey, id);
    db.prepare("DELETE FROM BonusOrderKey WHERE entryId=?").run(id);
    db.prepare("INSERT INTO BonusOrderKey VALUES(?,?,?,?)").run(
      data.channel,
      data.shop,
      data.orderNo,
      id,
    );
  }
  if (previous && (previous.period !== period || previous.person !== person))
    log(db, previous.period, previous.person, "移出登记", actor.name, {
      id,
      toPeriod: period,
      toPerson: person,
    });
  log(db, period, person, previous ? "更新登记" : "新增登记", actor.name, {
    id,
    before: previous || null,
    after: { kind, period, date: entryDate, data, amount },
  });
  return { id, updated: Boolean(previous) };
}
export function bonusSummary(db: AdminDb, period: string): BonusSummary[] {
  validMonth(period);
  const map = new Map<string, BonusSummary>();
  const get = (person: string) => {
    if (!map.has(person))
      map.set(person, {
        person,
        online: 0,
        offline: 0,
        product: 0,
        lesson: 0,
        adjustment: 0,
        salary: 0,
        reimbursement: 0,
        total: 0,
        details: [],
        audit: "pending",
        payout: "unpaid",
      });
    return map.get(person)!;
  };
  const course = [
    ...db
      .prepare(
        "SELECT *, 'offline' AS source FROM Payment WHERE substr(COALESCE(NULLIF(date,''),created_at),1,7)=?",
      )
      .all<any>(period),
    ...onlineAuthorizationCommissions(db).filter(
      (r: any) => String(r.date).slice(0, 7) === period,
    ),
  ];
  for (const r of course) {
    const person = String(r.sales || "").trim() || "未填写顾问";
    if (["伊娃老师", "伊娃"].includes(person)) continue;
    const type = r.source === "online" ? "online" : "offline";
    const amount =
      r.commissionAmount == null
        ? round((Number(r.amount || 0) * Number(r.commissionRate || 0)) / 100)
        : Number(r.commissionAmount);
    if (amount === 0) continue;
    const row = get(person);
    row[type] = round(row[type] + amount);
    row.details.push({
      type,
      id: r.id,
      date: String(r.date || r.created_at || "").slice(0, 10),
      person,
      title: r.courseName || "课程提成",
      amount,
      memberName: r.memberName || "",
      base: Number(r.amount || 0),
      rate: Number(r.commissionRate || 0),
    });
  }
  for (const e of db
    .prepare("SELECT * FROM BonusEntry WHERE period=? ORDER BY date,id")
    .all<any>(period)) {
    if (Number(e.amount) === 0) continue;
    const d = JSON.parse(e.data),
      row = get(e.person);
    const type = e.kind as
      | "product"
      | "lesson"
      | "adjustment"
      | "salary"
      | "reimbursement";
    row[type] = round((row[type] || 0) + e.amount);
    row.details.push({
      type,
      id: e.id,
      date: e.date,
      person: e.person,
      title: d.items || d.course || d.subject || d.reason,
      amount: e.amount,
      channel: d.channel,
      base: d.received,
      rate: d.rate,
      sessions: d.sessions,
      unit: d.unit,
      reason: d.reason,
      voucher: d.voucher,
      voucherFiles: d.voucherFiles,
      salesperson: d.salesperson,
    });
  }
  for (const row of map.values())
    row.total = round(
      row.online +
        row.offline +
        row.product +
        row.lesson +
        row.adjustment +
        (row.salary || 0) +
        (row.reimbursement || 0),
    );
  for (const legacy of db
    .prepare(
      "SELECT * FROM CommissionSettlement WHERE periodType='month' AND period=? AND status='settled'",
    )
    .all<any>(period)) {
    const row = get(legacy.advisor);
    row.audit = "confirmed";
    row.payout = "paid";
    row.legacy = true;
    row.reviewedBy = legacy.settledBy;
    row.paidAt = legacy.settledAt;
  }
  for (const saved of db
    .prepare("SELECT * FROM BonusMonthly WHERE period=?")
    .all<any>(period)) {
    map.set(saved.person, {
      salary: 0,
      reimbursement: 0,
      ...JSON.parse(saved.snapshot),
      audit: "confirmed",
      payout: saved.paidAt ? "paid" : "unpaid",
      reviewedBy: saved.reviewedBy,
      reviewedAt: saved.reviewedAt,
      paidAt: saved.paidAt,
      paidBy: saved.paidBy,
      voucher: saved.voucher,
      legacy: false,
    });
  }
  const courseNames = new Map(
    course.map((r: any) => [
      `${r.source === "online" ? "online" : "offline"}:${r.id}`,
      r.memberName || "",
    ]),
  );
  for (const row of map.values()) {
    row.details = row.details
      .filter((d) => d.amount !== 0)
      .map((d) => ({
        ...d,
        memberName: d.memberName || courseNames.get(`${d.type}:${d.id}`) || "",
      }));
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
export function confirmBonus(
  db: AdminDb,
  period: string,
  person: string,
  actor: string,
  expectedSnapshot?: string,
) {
  assertBonusUnlocked(db, period, person);
  const row = bonusSummary(db, period).find((r) => r.person === person);
  if (!row) throw new Error("该月没有该人员记录");
  if (
    expectedSnapshot !== undefined &&
    expectedSnapshot !== JSON.stringify(row)
  )
    throw new Error("结算明细已变化，请刷新核对后再确认");
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO BonusMonthly(period,person,snapshot,reviewedBy,reviewedAt) VALUES(?,?,?,?,?)",
  ).run(period, person, JSON.stringify(row), actor, now);
  // Reuse the existing course lock; confirmation must not create a financial expense.
  db.prepare(
    `INSERT INTO CommissionSettlement(periodType,period,advisor,status,settledAt,settledBy,updated_at) VALUES('month',?,?,'settled',?,?,?) ON CONFLICT(periodType,period,advisor) DO UPDATE SET status='settled',settledAt=excluded.settledAt,settledBy=excluded.settledBy,updated_at=excluded.updated_at`,
  ).run(period, person, now, actor, now);
  log(db, period, person, "审核确认", actor, row);
}
export function payBonus(
  db: AdminDb,
  period: string,
  person: string,
  actor: string,
  paidDate: string,
  voucher: string,
) {
  const saved = db
    .prepare("SELECT * FROM BonusMonthly WHERE period=? AND person=?")
    .get<any>(validMonth(period), person);
  if (!saved) throw new Error("请先审核确认");
  if (saved.paidAt) return { expenseId: saved.expenseId };
  date(paidDate);
  text(voucher, "发放凭证或流水编号");
  const snapshot = JSON.parse(saved.snapshot) as BonusSummary;
  if (snapshot.total <= 0)
    throw new Error("应发金额须大于零；负数结算请保留为调整记录");
  db.exec(
    `CREATE TABLE IF NOT EXISTS FinanceExpense(id INTEGER PRIMARY KEY,category TEXT DEFAULT '奖金提成',title TEXT NOT NULL,amount REAL DEFAULT 0,expense_date TEXT DEFAULT '',payment_method TEXT DEFAULT '',remark TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  );
  const marker = `AUTO_BONUS_PAYOUT|${period}|${person}`;
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(FinanceExpense)")
      .all<any>()
      .map((r) => r.name),
  );
  const values: Record<string, unknown> = {
    category: "奖金提成",
    title: `${person} ${period} 月度结算`,
    amount: snapshot.total,
    expense_date: paidDate,
    expenseDate: paidDate,
    payment_method: "月度结算",
    account: "月度结算",
    payee: person,
    handler: actor,
    paidStatus: "已付款",
    remark: `${marker}\n凭证：${voucher}`,
    createdBy: actor,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expenseNo: `BONUS-${crypto.randomUUID()}`,
  };
  const keys = Object.keys(values).filter((k) => columns.has(k));
  const result = db
    .prepare(
      `INSERT INTO FinanceExpense(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
    )
    .run(...keys.map((k) => values[k]));
  const expenseId = Number(result.lastInsertRowid);
  db.prepare(
    "UPDATE BonusMonthly SET paidAt=?,paidBy=?,voucher=?,expenseId=? WHERE period=? AND person=?",
  ).run(paidDate, actor, voucher, expenseId, period, person);
  log(db, period, person, "标记发放", actor, {
    expenseId,
    paidDate,
    voucher,
    amount: snapshot.total,
  });
  return { expenseId };
}
export function saveBonusStandard(db: AdminDb, input: any, actor: string) {
  const effective = date(input.effectiveDate);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  if (effective < today) throw new Error("默认标准仅允许从今天或未来日期生效");
  db.prepare(
    "INSERT INTO BonusStandard(effectiveDate,productRate,lessonUnit,actor,createdAt) VALUES(?,?,?,?,?)",
  ).run(
    effective,
    number(input.productRate, "商品比例", 0, 100),
    input.lessonUnit == null ? null : number(input.lessonUnit, "每节金额"),
    actor,
    new Date().toISOString(),
  );
  log(db, effective.slice(0, 7), "", "更新默认标准", actor, input);
}
