import { openAdminDb, type AdminDb } from "./admin-db";
import {
  ensureShop,
  ShopError,
  orderById,
  cancelConfirmed,
  settlePaid,
  settleRefund,
  audit,
} from "./shop-core";
import {
  closePayment,
  queryPayment,
  queryRefund,
  refundPayment,
  startPayment,
  shopConfig,
  paymentAvailability,
} from "./shop-payments";

export function shopDb<T>(fn: (db: AdminDb) => T): T {
  const db = openAdminDb();
  try {
    ensureShop(db);
    return fn(db);
  } finally {
    db.close();
  }
}
export async function reconcileOrder(id: string, cancel = false) {
  let order = shopDb((db) => orderById(db, id));
  if (order.status === "refunding") {
    if (await queryRefund(order)) shopDb((db) => settleRefund(db, id));
    return;
  }
  if (order.status !== "pending" || order.pay_lock_until > Date.now()) return;
  if (!order.payment_attempted) {
    if (cancel || order.expires_at < Date.now()) {
      // Compare inside the write transaction; a concurrent payment may have started.
      shopDb((db) =>
        db.transaction(() => {
          db.prepare(
            "UPDATE shop_online_orders SET updated_at=updated_at WHERE id=?",
          ).run(id);
          const current = orderById(db, id);
          if (!current.payment_attempted) cancelConfirmed(db, id);
        })(),
      );
    }
    return;
  }
  const state = await queryPayment(order);
  if (state.state === "paid") {
    shopDb((db) =>
      settlePaid(
        db,
        id,
        order.provider,
        state.transactionId!,
        state.amountFen!,
      ),
    );
    return;
  }
  if (state.state === "closed") {
    shopDb((db) => cancelConfirmed(db, id));
    return;
  }
  if (!cancel && order.expires_at > Date.now()) return;
  // Serialize close with prepay. A lost prepay response can still have created a gateway order.
  order = shopDb((db) =>
    db.transaction(() => {
      const changed = db
        .prepare(
          "UPDATE shop_online_orders SET pay_lock_until=? WHERE id=? AND status='pending' AND pay_lock_until<=?",
        )
        .run(Date.now() + 60000, id, Date.now());
      if (!changed.changes)
        throw new ShopError("支付状态同步中，请稍后刷新", 409);
      return orderById(db, id);
    })(),
  );
  try {
    if (state.state === "missing") {
      // Do not free stock while a delayed provider request could still become payable.
      if (order.expires_at + 120000 > Date.now())
        throw new ShopError(
          "正在确认支付状态，请在订单到期后两分钟再取消",
          409,
        );
    } else await closePayment(order);
    shopDb((db) => cancelConfirmed(db, id));
  } finally {
    shopDb((db) =>
      db
        .prepare("UPDATE shop_online_orders SET pay_lock_until=0 WHERE id=?")
        .run(id),
    );
  }
}
export async function payOrder(
  id: string,
  memberId: number,
  context: { mobile: boolean; wechatBrowser: boolean; ip: string },
) {
  const config = shopConfig();
  const existing = shopDb((db) => orderById(db, id, memberId));
  if (!paymentAvailability(config)[existing.provider])
    throw new ShopError("该支付方式尚未开通", 503);
  const order = shopDb((db) =>
    db.transaction(() => {
      const changed = db
        .prepare(
          "UPDATE shop_online_orders SET pay_lock_until=?,payment_attempted=1 WHERE id=? AND member_id=? AND status='pending' AND expires_at>? AND pay_lock_until<=?",
        )
        .run(Date.now() + 60000, id, memberId, Date.now() + 65000, Date.now());
      if (!changed.changes)
        throw new ShopError(
          "订单已付款、即将到期或正在处理中，请刷新订单",
          409,
        );
      return orderById(db, id, memberId);
    })(),
  );
  let openid = "";
  if (config.wxJsapi && context.wechatBrowser) {
    openid = shopDb((db) => {
      try {
        return (
          db
            .prepare(
              "SELECT openid FROM WechatIdentity WHERE member_id=? AND app_id=? LIMIT 1",
            )
            .get<{ openid: string }>(memberId, config.wxApp)?.openid || ""
        );
      } catch {
        return "";
      }
    });
  }
  try {
    return await startPayment(order, { ...context, openid }, config);
  } finally {
    shopDb((db) =>
      db
        .prepare("UPDATE shop_online_orders SET pay_lock_until=0 WHERE id=?")
        .run(id),
    );
  }
}
export async function approveRefund(
  id: string,
  actor: string,
  returned: boolean,
) {
  const order = shopDb((db) =>
    db.transaction(() => {
      db.prepare(
        "UPDATE shop_online_orders SET updated_at=updated_at WHERE id=?",
      ).run(id);
      const current = orderById(db, id);
      if (
        ![
          "paid",
          "refund_requested",
          "shipped",
          "completed",
          "refunding",
        ].includes(current.status)
      )
        throw new ShopError("当前订单不能退款", 409);
      if (current.shipped_at && !returned && current.status !== "refunding")
        throw new ShopError("请先确认退货已收到，再办理退款");
      if (current.status !== "refunding") {
        db.prepare(
          "UPDATE shop_online_orders SET status='refunding',refund_restock=1,updated_at=? WHERE id=?",
        ).run(Date.now(), id);
        audit(
          db,
          id,
          "refund_approved",
          actor,
          returned ? "已确认退货" : "未发货退款",
        );
      }
      return orderById(db, id);
    })(),
  );
  if (await refundPayment(order)) shopDb((db) => settleRefund(db, id));
}
export function fulfillOrder(
  db: AdminDb,
  id: string,
  carrier: string,
  tracking: string,
  actor: string,
) {
  if (
    !carrier.trim() ||
    carrier.length > 50 ||
    !/^[A-Za-z0-9-]{5,60}$/.test(tracking)
  )
    throw new ShopError("请填写快递公司和正确的运单号");
  db.transaction(() => {
    const now = Date.now();
    const changed = db
      .prepare(
        "UPDATE shop_online_orders SET status='shipped',carrier=?,tracking_no=?,shipped_at=?,updated_at=? WHERE id=? AND status='paid'",
      )
      .run(carrier.trim(), tracking, now, now, id);
    if (!changed.changes)
      throw new ShopError("仅已付款且未申请退款的订单可以发货", 409);
    audit(db, id, "shipped", actor, `${carrier} ${tracking}`);
  })();
}
export function memberAction(
  db: AdminDb,
  id: string,
  memberId: number,
  action: string,
  reason: string,
) {
  db.transaction(() => {
    db.prepare(
      "UPDATE shop_online_orders SET updated_at=updated_at WHERE id=?",
    ).run(id);
    const order = orderById(db, id, memberId);
    if (action === "received" && order.status === "shipped") {
      db.prepare(
        "UPDATE shop_online_orders SET status='completed',updated_at=? WHERE id=?",
      ).run(Date.now(), id);
    } else if (
      action === "refund" &&
      ["paid", "shipped", "completed"].includes(order.status)
    ) {
      if (!reason.trim() || reason.length > 300)
        throw new ShopError("请填写退款原因（最多 300 字）");
      db.prepare(
        "UPDATE shop_online_orders SET status='refund_requested',refund_reason=?,updated_at=? WHERE id=?",
      ).run(reason.trim(), Date.now(), id);
    } else throw new ShopError("当前订单不能执行此操作", 409);
    audit(db, id, action, `member:${memberId}`, reason);
  })();
}
