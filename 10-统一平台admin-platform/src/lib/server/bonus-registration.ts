import type { AdminDb } from "./admin-db";

export function bonusCatalog(db: AdminDb) {
  const exists = (name: string) =>
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(name);
  return {
    courses: exists("Course")
      ? db
          .prepare(
            "SELECT id,name,subType,startDate,endDate,templateId FROM Course WHERE COALESCE(series_id,0)<=0 ORDER BY startDate DESC,id DESC",
          )
          .all()
      : [],
    products: exists("shop_products")
      ? db
          .prepare(
            "SELECT id,name,spec,size,color,sale_price AS price,stock FROM shop_products WHERE status='在售' AND is_hidden=0 ORDER BY name,spec,size,color",
          )
          .all()
      : [],
    salespeople: exists("User")
      ? db
          .prepare(
            "SELECT name FROM User WHERE status='active' AND trim(name)<>'' ORDER BY name",
          )
          .all()
      : [],
  };
}

export function resolveBonusCourse(db: AdminDb, id: unknown) {
  const row = db
    .prepare(
      "SELECT id,name,subType,startDate,endDate FROM Course WHERE id=? AND COALESCE(series_id,0)<=0",
    )
    .get<any>(Number(id));
  if (!row) throw new Error("请选择有效的线下课程期次");
  return {
    courseId: row.id,
    course: [row.name, row.subType, row.startDate].filter(Boolean).join(" · "),
  };
}

export function bonusProductLines(
  db: AdminDb,
  value: unknown,
  oldLines: any[] = [],
) {
  if (!Array.isArray(value) || !value.length || value.length > 50)
    throw new Error("请选择商城商品、规格和数量");
  const counts = new Map<string, number>();
  for (const line of value) {
    const id = String(line.productId || ""),
      quantity = Number(line.quantity);
    if (
      !id ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000
    )
      throw new Error("商品数量须为正整数");
    counts.set(id, (counts.get(id) || 0) + quantity);
  }
  return [...counts].map(([productId, quantity]) => {
    const p = db
      .prepare(
        "SELECT id,name,spec,size,color,stock,status,is_hidden FROM shop_products WHERE id=?",
      )
      .get<any>(productId);
    if (!p) throw new Error("商品不存在，请重新选择");
    const oldQuantity =
      oldLines.find((l) => l.productId === productId)?.quantity || 0;
    if ((p.status !== "在售" || p.is_hidden) && quantity > oldQuantity)
      throw new Error(`${p.name}已停售，不能新增销售数量`);
    return {
      productId,
      quantity,
      name: p.name,
      spec: [p.spec, p.size, p.color].filter(Boolean).join(" / "),
    };
  });
}

// Called inside the same transaction as the registration and its audit log.
// Only the difference is posted, so imports/retries and unchanged edits do not deduct twice.
export function syncBonusStock(
  db: AdminDb,
  before: any[] = [],
  after: any[] = [],
  actor: string,
  channel: string,
  entryId: number,
) {
  const previous = new Map(before.map((l) => [l.productId, l.quantity]));
  const next = new Map(after.map((l) => [l.productId, l.quantity]));
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const delta = Number(previous.get(id) || 0) - Number(next.get(id) || 0);
    if (!delta) continue;
    const p = db
      .prepare("SELECT name,stock FROM shop_products WHERE id=?")
      .get<any>(id);
    if (!p) throw new Error("原商品不存在，无法调整库存");
    const updated = db
      .prepare(
        "UPDATE shop_products SET stock=stock+?,updated_at=? WHERE id=? AND stock+?>=0",
      )
      .run(delta, new Date().toISOString(), id, delta);
    if (updated.changes !== 1)
      throw new Error(`${p.name}库存不足（当前${p.stock}）`);
    db.prepare(
      "INSERT INTO shop_stock_logs(product_id,product_name,change_type,quantity,before_stock,after_stock,operator,remark,channel) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      p.name,
      delta < 0 ? "出库" : "入库",
      Math.abs(delta),
      p.stock,
      p.stock + delta,
      actor,
      `商品销售登记 #${entryId}${delta > 0 ? " 回补" : " 扣减"}`,
      channel,
    );
  }
}

export function registeredBonusOrder(db: AdminDb, orderNo: string) {
  if (
    !db
      .prepare("SELECT name FROM sqlite_master WHERE name='shop_online_orders'")
      .get()
  )
    return false;
  return Boolean(
    db
      .prepare(
        "SELECT id FROM shop_online_orders WHERE id=? OR (transaction_id<>'' AND transaction_id=?)",
      )
      .get(orderNo, orderNo),
  );
}

export function bonusVoucherFiles(
  db: AdminDb,
  value: unknown,
  ownerId: number,
  admin: boolean,
  old: any[] = [],
) {
  if (!Array.isArray(value) || value.length > 12)
    throw new Error("凭证图片最多12张");
  return value.map((item) => {
    const filename = String(item.filename || "");
    const row = db
      .prepare(
        "SELECT filename,originalName,ownerId FROM BonusVoucher WHERE filename=?",
      )
      .get<any>(filename);
    if (
      !row ||
      (!admin &&
        row.ownerId !== ownerId &&
        !old.some((p) => p.filename === filename))
    )
      throw new Error("凭证图片无效或不属于当前账号");
    return {
      filename: row.filename,
      name: row.originalName,
      url: `/api/bonus-management/vouchers/${encodeURIComponent(row.filename)}`,
    };
  });
}
