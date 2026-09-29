import fs from "node:fs";
import crypto from "node:crypto";
import { AlipaySdk } from "alipay-sdk";
import { ShopError, type ShopOrder } from "./shop-core";

// Server-only configuration. No merchant secret is exposed by the catalogue API.
export function shopConfig() {
  const file = process.env.SHOP_CONFIG_FILE || "/etc/eva-shop/payments.json";
  const saved = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : {};
  const get = (key: string) => String(process.env[key] || saved[key] || "");
  const pem = (key: string) => {
    const filename = get(`${key}_FILE`);
    return filename
      ? fs.readFileSync(filename, "utf8")
      : get(key).replace(/\\n/g, "\n");
  };
  return {
    enabled: get("SHOP_CHECKOUT_ENABLED") === "true",
    origin: "https://www.swod.com.cn",
    wxApp: get("WECHAT_PAY_APP_ID"),
    wxMerchant: get("WECHAT_PAY_MCH_ID"),
    wxSerial: get("WECHAT_PAY_SERIAL"),
    wxPrivate: pem("WECHAT_PAY_PRIVATE_KEY"),
    wxPublic: pem("WECHAT_PAY_PUBLIC_KEY"),
    wxPublicId: get("WECHAT_PAY_PUBLIC_KEY_ID"),
    wxV3: get("WECHAT_PAY_API_V3_KEY"),
    wxH5: get("WECHAT_PAY_H5_ENABLED") === "true",
    wxJsapi: get("WECHAT_PAY_JSAPI_ENABLED") === "true",
    aliApp: get("ALIPAY_APP_ID"),
    aliSeller: get("ALIPAY_SELLER_ID"),
    aliPrivate: pem("ALIPAY_PRIVATE_KEY"),
    aliPublic: pem("ALIPAY_PUBLIC_KEY"),
  };
}
type Config = ReturnType<typeof shopConfig>;
export function paymentAvailability(c = shopConfig()) {
  return {
    wechat: Boolean(
      c.enabled &&
        c.wxApp &&
        c.wxMerchant &&
        c.wxSerial &&
        c.wxPrivate &&
        c.wxPublic &&
        c.wxPublicId &&
        Buffer.byteLength(c.wxV3) === 32,
    ),
    alipay: Boolean(
      c.enabled && c.aliApp && c.aliSeller && c.aliPrivate && c.aliPublic,
    ),
    shippingFen: 0,
  };
}
function ali(c: Config) {
  return new AlipaySdk({
    appId: c.aliApp,
    privateKey: c.aliPrivate,
    alipayPublicKey: c.aliPublic,
    keyType: c.aliPrivate.includes("BEGIN RSA PRIVATE KEY") ? "PKCS1" : "PKCS8",
    signType: "RSA2",
    camelcase: false,
    timeout: 15000,
  });
}
export function verifyWechat(body: string, headers: Headers, c = shopConfig()) {
  const timestamp = headers.get("wechatpay-timestamp") || "";
  const nonce = headers.get("wechatpay-nonce") || "";
  const serial = headers.get("wechatpay-serial") || "";
  const signature = headers.get("wechatpay-signature") || "";
  if (
    serial !== c.wxPublicId ||
    !nonce ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !signature ||
    !c.wxPublic
  )
    throw new ShopError("支付签名无效", 400);
  if (
    !crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${timestamp}\n${nonce}\n${body}\n`),
      c.wxPublic,
      Buffer.from(signature, "base64"),
    )
  )
    throw new ShopError("支付签名无效", 400);
}
async function wx(method: string, path: string, data: unknown, c: Config) {
  const body = data === undefined ? "" : JSON.stringify(data);
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .sign(
      "RSA-SHA256",
      Buffer.from(`${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`),
      c.wxPrivate,
    )
    .toString("base64");
  const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Wechatpay-Serial": c.wxPublicId,
      Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${c.wxMerchant}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${c.wxSerial}",signature="${signature}"`,
    },
    ...(body ? { body } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  // Verify errors too: an unauthenticated ORDER_NOT_EXIST must never release inventory.
  verifyWechat(raw, response.headers, c);
  const result = raw ? JSON.parse(raw) : {};
  if (!response.ok) {
    const error = new ShopError(
      "微信支付暂时未完成，请稍后刷新订单",
      502,
    ) as ShopError & { code?: string };
    error.code = result.code;
    throw error;
  }
  return result;
}
async function aliCall(
  method: string,
  content: Record<string, unknown>,
  c: Config,
) {
  const result = await ali(c).exec(
    method,
    { bizContent: content },
    { validateSign: true },
  );
  if (result.code !== "10000") {
    const error = new ShopError(
      "支付宝暂时未完成，请稍后刷新订单",
      502,
    ) as ShopError & { code?: string };
    error.code = result.sub_code;
    throw error;
  }
  return result;
}
export async function startPayment(
  order: ShopOrder,
  context: {
    mobile: boolean;
    wechatBrowser: boolean;
    ip: string;
    openid?: string;
  },
  c = shopConfig(),
) {
  if (!paymentAvailability(c)[order.provider])
    throw new ShopError("该支付方式尚未开通，暂时无法付款", 503);
  if (order.expires_at - Date.now() < 65000)
    throw new ShopError("订单即将过期，请取消后重新下单", 409);
  if (order.provider === "alipay") {
    const mobile = context.mobile;
    const url = ali(c).pageExecute(
      mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay",
      "GET",
      {
        notifyUrl: `${c.origin}/api/shop/notify/alipay`,
        returnUrl: `${c.origin}/shop/selection?order=${order.id}`,
        bizContent: {
          out_trade_no: order.id,
          total_amount: (order.total_fen / 100).toFixed(2),
          subject: "伊娃甄选商品订单",
          product_code: mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY",
          time_expire: new Date(order.expires_at + 8 * 3600000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
        },
      },
    );
    return { kind: "redirect", url };
  }
  const channel =
    context.wechatBrowser && c.wxJsapi && context.openid
      ? "jsapi"
      : context.mobile && !context.wechatBrowser && c.wxH5
        ? "h5"
        : "native";
  const data = await wx(
    "POST",
    `/v3/pay/transactions/${channel}`,
    {
      appid: c.wxApp,
      mchid: c.wxMerchant,
      description: "伊娃甄选商品订单",
      out_trade_no: order.id,
      notify_url: `${c.origin}/api/shop/notify/wechat`,
      time_expire: new Date(order.expires_at).toISOString(),
      amount: { total: order.total_fen, currency: "CNY" },
      ...(channel === "jsapi" ? { payer: { openid: context.openid } } : {}),
      ...(channel === "h5"
        ? {
            scene_info: {
              payer_client_ip: context.ip,
              h5_info: { type: "Wap", app_name: "伊娃甄选", app_url: c.origin },
            },
          }
        : {}),
    },
    c,
  );
  if (channel === "jsapi") {
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = crypto.randomBytes(16).toString("hex");
    const pkg = `prepay_id=${data.prepay_id}`;
    const paySign = crypto
      .sign(
        "RSA-SHA256",
        Buffer.from(`${c.wxApp}\n${timeStamp}\n${nonceStr}\n${pkg}\n`),
        c.wxPrivate,
      )
      .toString("base64");
    return {
      kind: "jsapi",
      params: {
        appId: c.wxApp,
        timeStamp,
        nonceStr,
        package: pkg,
        signType: "RSA",
        paySign,
      },
    };
  }
  if (channel === "h5") {
    if (!String(data.h5_url).startsWith("https://wx.tenpay.com/"))
      throw new ShopError("支付地址无效", 502);
    return {
      kind: "redirect",
      url: `${data.h5_url}&redirect_url=${encodeURIComponent(`${c.origin}/shop/selection?order=${order.id}`)}`,
    };
  }
  if (!String(data.code_url).startsWith("weixin://wxpay/"))
    throw new ShopError("支付二维码无效", 502);
  return { kind: "qr", url: data.code_url as string };
}
export type PaymentState = {
  state: "paid" | "closed" | "pending" | "missing";
  transactionId?: string;
  amountFen?: number;
};
export async function queryPayment(
  order: ShopOrder,
  c = shopConfig(),
): Promise<PaymentState> {
  try {
    if (order.provider === "wechat") {
      const data = await wx(
        "GET",
        `/v3/pay/transactions/out-trade-no/${order.id}?mchid=${c.wxMerchant}`,
        undefined,
        c,
      );
      if (
        data.appid !== c.wxApp ||
        data.mchid !== c.wxMerchant ||
        data.out_trade_no !== order.id
      )
        throw new ShopError("支付身份不匹配", 409);
      if (data.trade_state === "SUCCESS") {
        if (data.amount?.currency !== "CNY")
          throw new ShopError("支付币种不匹配", 409);
        return {
          state: "paid",
          transactionId: data.transaction_id,
          amountFen: data.amount.total,
        };
      }
      return { state: data.trade_state === "CLOSED" ? "closed" : "pending" };
    }
    const data = await aliCall(
      "alipay.trade.query",
      { out_trade_no: order.id },
      c,
    );
    if (data.out_trade_no !== order.id)
      throw new ShopError("支付订单不匹配", 409);
    if (["TRADE_SUCCESS", "TRADE_FINISHED"].includes(data.trade_status))
      return {
        state: "paid",
        transactionId: data.trade_no,
        amountFen: Math.round(Number(data.total_amount) * 100),
      };
    return {
      state: data.trade_status === "TRADE_CLOSED" ? "closed" : "pending",
    };
  } catch (err: any) {
    if (["ORDER_NOT_EXIST", "ACQ.TRADE_NOT_EXIST"].includes(err.code))
      return { state: "missing" };
    throw err;
  }
}
export async function closePayment(order: ShopOrder, c = shopConfig()) {
  if (order.provider === "wechat")
    await wx(
      "POST",
      `/v3/pay/transactions/out-trade-no/${order.id}/close`,
      { mchid: c.wxMerchant },
      c,
    );
  else await aliCall("alipay.trade.close", { out_trade_no: order.id }, c);
}
export async function refundPayment(order: ShopOrder, c = shopConfig()) {
  // Deterministic refund id makes network retries safe.
  if (order.provider === "wechat") {
    const data = await wx(
      "POST",
      "/v3/refund/domestic/refunds",
      {
        out_trade_no: order.id,
        out_refund_no: `R${order.id}`,
        reason: "伊娃甄选订单退款",
        amount: {
          refund: order.total_fen,
          total: order.total_fen,
          currency: "CNY",
        },
      },
      c,
    );
    if (
      data.out_trade_no !== order.id ||
      data.amount?.refund !== order.total_fen ||
      data.amount?.total !== order.total_fen
    )
      throw new ShopError("退款信息不匹配", 409);
    return data.status === "SUCCESS";
  }
  const result = await aliCall(
    "alipay.trade.refund",
    {
      out_trade_no: order.id,
      out_request_no: `R${order.id}`,
      refund_amount: (order.total_fen / 100).toFixed(2),
      refund_reason: "伊娃甄选订单退款",
    },
    c,
  );
  if (
    result.out_trade_no !== order.id ||
    result.trade_no !== order.transaction_id ||
    Math.round(Number(result.refund_fee) * 100) !== order.total_fen
  )
    throw new ShopError("退款信息不匹配", 409);
  return true;
}
export async function queryRefund(order: ShopOrder, c = shopConfig()) {
  if (order.provider === "alipay") return refundPayment(order, c);
  const data = await wx(
    "GET",
    `/v3/refund/domestic/refunds/R${order.id}`,
    undefined,
    c,
  );
  if (
    data.out_trade_no !== order.id ||
    data.amount?.refund !== order.total_fen ||
    data.amount?.total !== order.total_fen ||
    data.amount?.currency !== "CNY"
  )
    throw new ShopError("退款信息不匹配", 409);
  return data.status === "SUCCESS";
}
export function wechatNotification(
  raw: string,
  headers: Headers,
  c = shopConfig(),
) {
  verifyWechat(raw, headers, c);
  const envelope = JSON.parse(raw);
  if (
    envelope.event_type !== "TRANSACTION.SUCCESS" ||
    envelope.resource?.algorithm !== "AEAD_AES_256_GCM"
  )
    throw new ShopError("通知类型不支持");
  const resource = envelope.resource;
  const data = Buffer.from(resource.ciphertext, "base64");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(c.wxV3),
    Buffer.from(resource.nonce),
  );
  decipher.setAuthTag(data.subarray(-16));
  decipher.setAAD(Buffer.from(resource.associated_data || ""));
  const result = JSON.parse(
    Buffer.concat([
      decipher.update(data.subarray(0, -16)),
      decipher.final(),
    ]).toString("utf8"),
  );
  if (
    result.appid !== c.wxApp ||
    result.mchid !== c.wxMerchant ||
    result.trade_state !== "SUCCESS" ||
    result.amount?.currency !== "CNY"
  )
    throw new ShopError("通知商户或状态不匹配");
  return {
    id: result.out_trade_no,
    transactionId: result.transaction_id,
    amountFen: result.amount.total,
  };
}
export function alipayNotification(raw: string, c = shopConfig()) {
  const params = new URLSearchParams(raw);
  const data: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in data) throw new ShopError("重复通知参数");
    data[key] = value;
  }
  if (
    data.sign_type !== "RSA2" ||
    !ali(c).checkNotifySignV2(data) ||
    data.app_id !== c.aliApp ||
    data.seller_id !== c.aliSeller
  )
    throw new ShopError("通知签名或商户不匹配");
  if (!["TRADE_SUCCESS", "TRADE_FINISHED"].includes(data.trade_status))
    return null;
  if (!/^\d+(\.\d{1,2})?$/.test(data.total_amount))
    throw new ShopError("支付金额无效");
  return {
    id: data.out_trade_no,
    transactionId: data.trade_no,
    amountFen: Math.round(Number(data.total_amount) * 100),
  };
}
