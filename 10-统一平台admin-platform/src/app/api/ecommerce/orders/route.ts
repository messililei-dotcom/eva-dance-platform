import { hasAuth, unauthorized, openCommerceDb } from "../_db";
import { authPayloadFromRequest, requireSuperAdmin } from "../../training-db";
import {
  shopDb,
  approveRefund,
  fulfillOrder,
  reconcileOrder,
} from "@/lib/server/shop-service";
import { ShopError, publicOrder, type ShopOrder } from "@/lib/server/shop-core";
import { paymentAvailability } from "@/lib/server/shop-payments";
export const dynamic = "force-dynamic";
function fail(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof ShopError
          ? error.message
          : "操作未完成，请刷新状态后重试",
    },
    { status: error instanceof ShopError ? error.status : 503 },
  );
}
export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  try {
    const init = openCommerceDb();
    init.close();
    const query = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(10000, Math.floor(Number(query.get("page"))) || 1));
    const pageSize = Math.max(1, Math.min(100, Math.floor(Number(query.get("pageSize"))) || 50));
    const orders = shopDb((db) =>
      db
        .prepare(
          "SELECT * FROM shop_online_orders ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        )
        .all<ShopOrder>(pageSize, (page - 1) * pageSize)
        .map((order) => ({
          ...publicOrder(db, order),
          memberId: order.member_id,
          shippedAt: order.shipped_at,
        })),
    );
    const total = shopDb(
      (db) =>
        db
          .prepare("SELECT count(*) n FROM shop_online_orders")
          .get<{ n: number }>()?.n || 0,
    );
    return Response.json(
      { orders, total, payment: paymentAvailability() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin &&
      origin !== "https://admin.swod.com.cn" &&
      origin !== new URL(request.url).origin)
  )
    return Response.json({ error: "请求来源无效" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4000) throw new ShopError("请求过大", 413);
    const input = JSON.parse(raw);
    if (!/^EV[a-f0-9]{30}$/.test(input.id || ""))
      throw new ShopError("订单编号错误");
    const actor = String(authPayloadFromRequest(request)?.username || "admin");
    if (input.action === "ship")
      shopDb((db) =>
        fulfillOrder(
          db,
          input.id,
          String(input.carrier || ""),
          String(input.trackingNo || ""),
          actor,
        ),
      );
    else if (input.action === "refund") {
      const denied = requireSuperAdmin(request, "仅管理员可执行原路退款");
      if (denied) return denied;
      await approveRefund(input.id, actor, input.returnReceived === true);
    } else if (input.action === "refresh") await reconcileOrder(input.id);
    else throw new ShopError("不支持的订单操作");
    return Response.json({ success: true });
  } catch (error) {
    return fail(error);
  }
}
