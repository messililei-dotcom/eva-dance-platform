import { payerOpenid } from '@/lib/server/shop-wechat-oauth';
import { getShipping, saveShipping } from '@/lib/server/shop-shipping';
import { createHash } from "node:crypto";
import { getAuthenticatedMemberId } from "../../mini/_helpers";
import {
  createOrder,
  createCourseOrder,
  courseOffer,
  orderById,
  publicOrder,
  settlePaid,
  ShopError,
  type ShopOrder,
} from "@/lib/server/shop-core";
import {
  shopDb,
  payOrder,
  reconcileOrder,
  memberAction,
} from "@/lib/server/shop-service";
import {
  shopConfig,
  paymentAvailability,
  wechatNotification,
  alipayNotification,
} from "@/lib/server/shop-payments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
const response = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
function fail(error: unknown) {
  if (error instanceof ShopError)
    return response({ error: error.message }, error.status);
  console.error(
    "[shop]",
    error instanceof Error ? error.message : "unknown error",
  );
  return response({ error: "商城服务暂时不可用，请稍后重试" }, 503);
}
function member(request: Request) {
  if (
    !process.env.ADMIN_SESSION_SECRET &&
    process.env.NODE_ENV === "production"
  )
    throw new ShopError("登录服务尚未配置", 503);
  const id = getAuthenticatedMemberId(request);
  if (!id) throw new ShopError("请先登录再查看订单或下单", 401);
  return id;
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    // Behind the production reverse proxy request.url can carry localhost.
    if (origin !== "https://www.swod.com.cn")
      throw new ShopError("请求来源无效", 403);
  }
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ShopError("请求来源无效", 403);
}
async function limitedText(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ShopError("请求内容过大", 413);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}
async function body(request: Request) {
  const raw = await limitedText(request, 20000);
  try {
    return JSON.parse(raw);
  } catch {
    throw new ShopError("请求格式错误");
  }
}
export async function GET(request: Request, context: Context) {
  try {
    const path = (await context.params).path;
    if(path[0]==="courses" && path.length===3) return response({offer:shopDb(db=>courseOffer(db,path[1],path[2],path[1]==='event'?member(request):0)),payment:paymentAvailability()});
    if (path.join("/") === "products") {
      const products = shopDb((db) =>
        db
          .prepare(
            `SELECT id,name,category,spec,size,color,sale_price,stock,updated_at,CASE WHEN image<>'' THEN 1 ELSE 0 END has_image FROM shop_products WHERE status='在售' AND is_hidden=0 ORDER BY updated_at DESC,id`,
          )
          .all()
          .map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            spec: p.spec,
            size: p.size,
            color: p.color,
            priceFen: Math.round(Number(p.sale_price) * 100),
            stock: Math.max(0, Math.floor(Number(p.stock))),
            image: p.has_image
              ? `/api/shop/images/${encodeURIComponent(p.id)}/${createHash("sha256").update(String(p.updated_at)).digest("hex").slice(0, 12)}`
              : "",
          }))
          .filter((p) => Number.isSafeInteger(p.priceFen) && p.priceFen > 0),
      );
      return response({
        products,
        payment: paymentAvailability(),
        shipping: "快递包邮",
      });
    }
    if (path[0] === "images" && (path.length === 2 || path.length === 3)) {
      const image = shopDb(
        (db) =>
          db
            .prepare(
              "SELECT image FROM shop_products WHERE id=? AND status='在售' AND is_hidden=0",
            )
            .get<{ image: string }>(path[1])?.image || "",
      );
      const match = image.match(
        /^data:image\/(jpeg|png|webp|gif);base64,([a-zA-Z0-9+/=\s]+)$/,
      );
      if (match && match[2].length < 14000000)
        return new Response(Buffer.from(match[2], "base64"), {
          headers: {
            "Content-Type": `image/${match[1]}`,
            "Cache-Control": "public, max-age=60",
            "X-Content-Type-Options": "nosniff",
          },
        });
      if (/^https:\/\//i.test(image)) return Response.redirect(image, 302);
      if (/^\/(?:uploads|api\/upload)[/\w.%+-]*$/.test(image))
        return Response.redirect(`https://admin.swod.com.cn${image}`, 302);
      return new Response(null, { status: 404 });
    }
    const memberId = member(request);
    if (path.join("/") === "shipping") return response({shipping:shopDb(db=>getShipping(db,memberId))});
    if (path.join("/") === "orders")
      return response({
        orders: shopDb((db) =>
          db
            .prepare(
              "SELECT * FROM shop_online_orders WHERE member_id=? ORDER BY created_at DESC LIMIT 100",
            )
            .all<ShopOrder>(memberId)
            .map((o) => publicOrder(db, o)),
        ),
      });
    if (path[0] === "orders" && path.length === 2)
      return response({
        order: shopDb((db) =>
          publicOrder(db, orderById(db, path[1], memberId)),
        ),
      });
    return response({ error: "接口不存在" }, 404);
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request, context: Context) {
  const path = (await context.params).path;
  if (path[0] === "notify" && path.length === 2) {
    try {
      const raw = await limitedText(request, 65536);
      if (path[1] === "wechat") {
        const result = wechatNotification(raw, request.headers);
        shopDb((db) => {
          const order=orderById(db,result.id);
          if(result.appId !== (order.payment_app_id || shopConfig().wxApp)) throw new ShopError('通知支付渠道不匹配',400);
          return settlePaid(db,result.id,"wechat",result.transactionId,result.amountFen);
        });
        return new Response(null, { status: 204 });
      }
      if (path[1] === "alipay") {
        const result = alipayNotification(raw);
        if (result)
          shopDb((db) =>
            settlePaid(
              db,
              result.id,
              "alipay",
              result.transactionId,
              result.amountFen,
            ),
          );
        return new Response("success");
      }
      return new Response("fail", { status: 404 });
    } catch {
      return new Response("fail", { status: 400 });
    }
  }
  try {
    sameOrigin(request);
    const memberId = member(request);
    const input = await body(request);
    if (path.join("/") === "orders") {
      const availability = paymentAvailability();
      if (request.headers.get("x-client-platform") === "miniprogram" && (input.provider !== "wechat" || !availability.miniprogram)) throw new ShopError("小程序微信支付尚未开通",503);
      if (
        !(input.provider === "wechat"
          ? (request.headers.get("x-client-platform") === "miniprogram" ? availability.miniprogram : availability.wechat)
          : input.provider === "alipay"
            ? availability.alipay
            : false)
      )
        throw new ShopError("支付服务尚未开通，暂时不能下单", 503);
      const order = shopDb((db) =>
        db.transaction(() => {
          const order = ["online","offline","event"].includes(input.kind) ? createCourseOrder(db,memberId,input) : createOrder(db, memberId, input);
          if(!["online","offline","event"].includes(input.kind)) saveShipping(db, memberId, input);
          return publicOrder(db, order);
        })(),
      );
      return response({ order }, 201);
    }
    if (path[0] === "orders" && path.length === 3) {
      const id = path[1],
        action = path[2];
      shopDb((db) => orderById(db, id, memberId));
      const config = shopConfig();
      const wechatBrowser = /MicroMessenger/i.test(request.headers.get('user-agent') || '');
      const openid = payerOpenid(request, memberId, config.wxApp);
      const payingOrder = shopDb(db => orderById(db, id, memberId));
      if (action === 'pay' && payingOrder.provider === 'wechat' && wechatBrowser && config.wxJsapi && !openid && request.headers.get('x-client-platform') !== 'miniprogram') {
        if (payingOrder.status !== 'pending' || payingOrder.expires_at <= Date.now()) throw new ShopError('订单已结束，请刷新订单');
        return response({kind:'redirect',url:'/api/shop/wechat/authorize?order='+encodeURIComponent(id)});
      }
      if (action === "pay")
        return response(
          await payOrder(id, memberId, {
            openid,
            miniprogram: request.headers.get("x-client-platform") === "miniprogram",
            mobile: /Android|iPhone|iPad|Mobile/i.test(
              request.headers.get("user-agent") || "",
            ),
            wechatBrowser: /MicroMessenger/i.test(
              request.headers.get("user-agent") || "",
            ),
            ip: request.headers.get("x-real-ip") || "127.0.0.1",
          }),
        );
      if (action === "cancel" || action === "refresh")
        await reconcileOrder(id, action === "cancel");
      else if (["received", "refund"].includes(action))
        shopDb((db) =>
          memberAction(db, id, memberId, action, String(input.reason || "")),
        );
      else throw new ShopError("不支持的订单操作");
      return response({
        order: shopDb((db) => publicOrder(db, orderById(db, id, memberId))),
      });
    }
    return response({ error: "接口不存在" }, 404);
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const memberId=member(request);
    const path=(await context.params).path;
    if(path.join('/')!=='shipping') return response({error:'接口不存在'},404);
    const input=await body(request);
    return response({shipping:shopDb(db=>saveShipping(db,memberId,input))});
  } catch(error) { return fail(error); }
}
