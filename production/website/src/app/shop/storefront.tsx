"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  ShoppingBag,
  Truck,
  Package,
  X,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { usePageShare } from "@/components/PageShareData";
import StudentLoginModal from "@/components/StudentLoginModal";
import { studentApi } from "@/lib/student-api";

type Product = {
  id: string;
  name: string;
  category: string;
  spec: string;
  size: string;
  color: string;
  priceFen: number;
  stock: number;
  image: string;
};
type Item = {
  product_id: string;
  name: string;
  spec: string;
  quantity: number;
  unit_fen: number;
};
type Order = {
  exclusive?: {number:string;discountFen:number;shippingFen:number;refundedFen:number}|null;
  kind?: string; targetId?: number;
  id: string;
  provider: "wechat" | "alipay";
  status: string;
  totalFen: number;
  recipient: string;
  phone: string;
  address: string;
  deliveryMethod?: "express" | "pickup";
  createdAt: number;
  expiresAt: number;
  carrier: string;
  trackingNo: string;
  refundReason: string;
  items: Item[];
};
const money = (n: number) => `¥${(n / 100).toFixed(2)}`;
const statuses: Record<string, string> = {
  pending: "待付款",
  paid: "待发货",
  shipped: "已发货",
  completed: "已收货",
  cancelled: "已取消",
  refund_requested: "退款申请处理中",
  refunding: "退款处理中",
  refunded: "已退款",
};
const primary =
  "rounded-xl bg-emerald-900 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm hover:border-emerald-700 disabled:opacity-40";
const field =
  "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-200";
async function api(path: string, body?: unknown) {
  const token = studentApi.getToken();
  const result = await fetch(`/api/shop/${path}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await result.json();
  if (!result.ok)
    throw Object.assign(new Error(data.error || "操作失败，请重试"), {
      status: result.status,
    });
  return data;
}
function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image]);
  return (
    <div className="flex aspect-square items-center justify-center overflow-hidden bg-[#eceee7]">
      {product.image && !failed ? (
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 p-4 text-emerald-900/50">
          <ShoppingBag size={42} strokeWidth={1} />
          <span className="text-xs tracking-widest">
            {product.category || "伊娃甄选"}
          </span>
          <span className="text-xs text-stone-500">商品图片待补充</span>
        </div>
      )}
    </div>
  );
}
function Dialog({
  title,
  close,
  children,
  busy = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea,select,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [close, busy]);
  return (
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
      onClick={() => {
        if (!busy) close();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#faf9f5] p-5 shadow-2xl outline-none md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-serif text-2xl text-emerald-950">{title}</h2>
          <button
            aria-label="关闭"
            className={secondary}
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export default function ShopStorefront({ initialProductId = "" }: { initialProductId?: string }) {
  const [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [payment, setPayment] = useState({ wechat: false, alipay: false }),
    [cart, setCart] = useState<Record<string, number>>({}),
    [ready, setReady] = useState(false);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("全部"),
    [view, setView] = useState<"goods" | "orders">("goods");
  const [selected, setSelected] = useState<Product | null>(null),
    [cartOpen, setCartOpen] = useState(false),
    [login, setLogin] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]),
    [ordersLoaded, setOrdersLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const [recipient, setRecipient] = useState(""),
    [phone, setPhone] = useState(""),
    [address, setAddress] = useState(""),
    [provider, setProvider] = useState<"wechat" | "alipay">("wechat");
  const [payDisplay, setPayDisplay] = useState<{
      id: string;
      qr?: string;
    } | null>(null),
    [refundOrder, setRefundOrder] = useState<Order | null>(null),
    [reason, setReason] = useState("");
  const busyRef = useRef(false),
    catalogBusy = useRef(false);
  useEffect(() => {
    setSelected((previous) =>
      previous ? products.find((p) => p.id === previous.id) || null : null,
    );
  }, [products]);
  const openedInitial = useRef('');
  useEffect(() => {
    if (!products.length || !initialProductId || openedInitial.current === initialProductId) return;
    openedInitial.current = initialProductId;
    setSelected(products.find(p => p.id === initialProductId) || null);
  }, [products, initialProductId]);
  usePageShare(selected ? {
    title: selected.name,
    desc: [selected.category, selected.spec, selected.size, selected.color, '伊娃甄选 · 官方商城'].filter(Boolean).join(' · '),
    link: `/shop/products/${encodeURIComponent(selected.id)}`,
    imgUrl: selected.image,
  } : null);
  const [deliveryMethod, setDeliveryMethod] = useState<"express" | "pickup">("express");
  const shippingDirty = useRef(false);
  useEffect(() => {
    if (!cartOpen) { shippingDirty.current=false; return; }
    let active=true;
    void api('shipping').then(data => {
      if(!active || shippingDirty.current) return;
      setRecipient(data.shipping.recipient || '');
      setPhone(data.shipping.phone || '');
      setAddress(data.shipping.address || '');
    }).catch(e => { if(active && e.status!==401) setError(e.message); });
    return () => {active=false;};
  }, [cartOpen]);
  const saveAddress = async () => {
    const response=await fetch('/api/shop/shipping', {method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${studentApi.getToken()}`},body:JSON.stringify({recipient,phone,address})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || '地址保存失败');
  };
  const closeCart = useCallback(() => setCartOpen(false), []),
    closeSelected = useCallback(() => setSelected(null), []),
    closePay = useCallback(() => setPayDisplay(null), []),
    closeRefund = useCallback(() => setRefundOrder(null), []);
  const loadProducts = useCallback(async (quiet = false) => {
    if (catalogBusy.current) return;
    catalogBusy.current = true;
    if (!quiet) setLoading(true);
    try {
      const data = await api("products");
      setProducts(data.products);
      setPayment(data.payment);
      if (!data.payment.wechat && data.payment.alipay) setProvider("alipay");
    } catch (e: any) {
      if (!quiet) setError(e.message);
    } finally {
      catalogBusy.current = false;
      setLoading(false);
    }
  }, []);
  const loadOrders = useCallback(async () => {
    try {
      const data = await api("orders");
      setOrders(data.orders);
      setOrdersLoaded(true);
    } catch (e: any) {
      if (e.status === 401) setLogin(true);
      else setError(e.message);
    }
  }, []);
  useEffect(() => {
    void loadProducts();
    try {
      const saved = JSON.parse(
        localStorage.getItem("eva-shop-cart-v1") || "{}",
      );
      if (saved && typeof saved === "object" && !Array.isArray(saved))
        setCart(
          Object.fromEntries(
            Object.entries(saved).filter(
              ([id, q]) =>
                id.length <= 100 &&
                Number.isInteger(q) &&
                Number(q) > 0 &&
                Number(q) <= 99,
            ),
          ) as Record<string, number>,
        );
    } catch {}
    setReady(true);
    const query = new URLSearchParams(window.location.search);
    if (query.get('wx_pay_error')) setError('微信支付授权未完成，请重新点击付款');
    if(query.get("orders") === "1") {setView("orders");void loadOrders();}
    const order = query.get("order");
    if (order && /^EV[a-f0-9]{30}$/.test(order)) {
      setView("orders");
      setPayDisplay({ id: order });
      void loadOrders();
      if (query.get('wx_pay_resume') === '1' || query.get('pay') === '1') {
        window.history.replaceState(null, '', '/shop/selection?order=' + encodeURIComponent(order));
        void api('orders/' + order).then(data => pay(data.order)).catch(e => setError(e.message));
      }
    }
    const refresh = () => {
      if (!document.hidden) void loadProducts(true);
    };
    const timer = setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadProducts, loadOrders]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("eva-shop-cart-v1", JSON.stringify(cart));
      } catch {}
  }, [cart, ready]);
  useEffect(() => {
    if (!payDisplay) return;
    let active = true,
      running = false;
    const refresh = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        const data = await api(`orders/${payDisplay.id}/refresh`, {});
        if (active) {
          setOrders((old) => [
            data.order,
            ...old.filter((o) => o.id !== data.order.id),
          ]);
          if (data.order.status !== "pending") {
            setPayDisplay(null);
            void loadProducts(true);
          }
        }
      } catch {
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [payDisplay, loadProducts]);
  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      if (e.status === 401) setLogin(true);
      setError(e.message || "操作失败，请重试");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const add = (p: Product) =>
    setCart((old) => ({
      ...old,
      [p.id]: Math.min(99, p.stock, (old[p.id] || 0) + 1),
    }));
  const change = (id: string, q: number) =>
    setCart((old) => {
      const next = { ...old };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(99, q);
      return next;
    });
  const entries = Object.entries(cart),
    count = entries.reduce((n, [, q]) => n + q, 0);
  const total = entries.reduce(
    (n, [id, q]) => n + (products.find((p) => p.id === id)?.priceFen || 0) * q,
    0,
  );
  const invalid = entries.some(([id, q]) => {
    const p = products.find((p) => p.id === id);
    return !p || p.stock < q;
  });
  const filtered = products.filter(
    (p) =>
      (category === "全部" || p.category === category) &&
      `${p.name} ${p.category} ${p.spec} ${p.color}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pay = async (order: Order) => {
    setView("orders");
    setCartOpen(false);
    const data = await api(`orders/${order.id}/pay`, {});
    if (data.kind === "redirect") {
      window.location.assign(data.url);
      return;
    }
    if (data.kind === "qr") {
      const QRCode = await import("qrcode");
      setPayDisplay({
        id: order.id,
        qr: await QRCode.toDataURL(data.url, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      });
    }
    if (data.kind === "jsapi") {
      const bridge = await new Promise<any>((resolve, reject) => {
        if ((window as any).WeixinJSBridge) return resolve((window as any).WeixinJSBridge);
        const ready = () => { clearTimeout(timer); resolve((window as any).WeixinJSBridge); };
        const timer = setTimeout(() => { document.removeEventListener('WeixinJSBridgeReady', ready); reject(new Error('微信支付尚未就绪，请重新点击付款')); }, 5000);
        document.addEventListener('WeixinJSBridgeReady', ready, {once:true});
      });
      setPayDisplay({ id: order.id });
      bridge.invoke("getBrandWCPayRequest", data.params, (result: any) => {
        if (result.err_msg === 'get_brand_wcpay_request:cancel') setError('已取消付款，可在订单中继续支付');
        else if (result.err_msg !== 'get_brand_wcpay_request:ok') setError('微信支付未完成，请重试');
        void api('orders/' + order.id + '/refresh', {}).then(() => loadOrders()).catch(e => setError(e.message));
      });
    }
  };
  const checkout = () =>
    run(async () => {
      const input = {
        recipient,
        phone,
        address: deliveryMethod === "pickup" ? "" : address,
        deliveryMethod,
        provider,
        expectedTotalFen: total,
        items: entries.map(([id, quantity]) => ({ id, quantity })),
      };
      const fingerprint = JSON.stringify(input);
      let requestKey: string = crypto.randomUUID();
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("eva-shop-checkout") || "null",
        );
        if (saved?.fingerprint === fingerprint) requestKey = saved.requestKey;
        else
          sessionStorage.setItem(
            "eva-shop-checkout",
            JSON.stringify({ fingerprint, requestKey }),
          );
      } catch {}
      const data = await api("orders", { ...input, requestKey });
      setCart({});
      setOrders((old) => [
        data.order,
        ...old.filter((o) => o.id !== data.order.id),
      ]);
      setOrdersLoaded(true);
      setView("orders");
      setCartOpen(false);
      try {
        sessionStorage.removeItem("eva-shop-checkout");
      } catch {}
      await pay(data.order);
    });
  const action = (order: Order, verb: string, input: unknown = {}) =>
    run(async () => {
      const data = await api(`orders/${order.id}/${verb}`, input);
      setOrders((old) => old.map((o) => (o.id === order.id ? data.order : o)));
      setRefundOrder(null);
      void loadProducts(true);
    });
  return (
    <div data-mobile-surface="shop" className="mobile-shop-surface min-h-screen bg-[#faf9f5] pb-20 text-stone-800">
      <section className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 px-4 pb-14 pt-40 text-white md:pb-20 md:pt-48">
        <div className="mx-auto max-w-7xl">
          <div className="mt-8 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="mb-4 text-xs tracking-[.3em] text-emerald-200">
                EVA SELECTION · 伊娃东方舞商城
              </p>
              <h1 className="font-serif text-4xl md:text-6xl">
                为每一次起舞，精选。
              </h1>
              <p className="mt-6 max-w-xl leading-8 text-emerald-50/75">
                从日常练习到舞台时刻，找到与你相伴的东方舞好物。
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/20 px-5 py-4 text-sm">
              <Truck size={24} strokeWidth={1.5} />
              <div>
                <p>快递包邮</p>
                <p className="mt-1 text-xs text-white/60">
                  精选舞服 · 练习装备
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
          <div className="flex gap-2">
            <button
              className={view === "goods" ? primary : secondary}
              onClick={() => setView("goods")}
            >
              全部好物
            </button>
            <button
              className={view === "orders" ? primary : secondary}
              onClick={() => {
                setView("orders");
                void loadOrders();
              }}
            >
              我的订单
            </button>
          </div>
          <button
            className={`${secondary} flex items-center gap-2`}
            onClick={() => {
              setCartOpen(true);
              void loadProducts();
            }}
          >
            <ShoppingBag size={18} />
            购物袋{" "}
            <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-xs text-white">
              {count}
            </span>
          </button>
        </div>
        {error && (
          <div
            role="alert"
            className="fixed bottom-6 left-1/2 z-[10200] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-lg"
          >
            {error}
            <button aria-label="关闭提示" onClick={() => setError("")}>
              <X size={18} />
            </button>
          </div>
        )}
        {view === "goods" ? (
          <>
            <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row">
              <div className="flex flex-wrap gap-2">
                {[
                  "全部",
                  ...new Set(products.map((p) => p.category).filter(Boolean)),
                ].map((c) => (
                  <button
                    key={c}
                    className={`rounded-full px-4 py-2 text-sm ${category === c ? "bg-emerald-100 text-emerald-950" : "border border-stone-200 hover:bg-white"}`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label className="flex shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4">
                <Search size={18} className="text-stone-400" />
                <input
                  aria-label="搜索商品"
                  placeholder="寻找你的心仪好物"
                  className="min-w-0 bg-transparent py-3 text-sm outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            {loading && !products.length ? (
              <p role="status" className="py-20 text-center text-stone-500">
                正在载入好物…
              </p>
            ) : !filtered.length ? (
              <div className="rounded-2xl border border-dashed border-stone-300 py-20 text-center">
                <Package className="mx-auto mb-4 text-stone-400" size={40} />
                <p>
                  {products.length
                    ? "没有找到匹配的商品"
                    : "精选好物正在准备中"}
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setCategory("全部");
                    void loadProducts();
                  }}
                  className={`${secondary} mt-5`}
                >
                  重新查看
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
                {filtered.map((p) => (
                  <article
                    key={p.id}
                    className="group overflow-hidden rounded-2xl border border-stone-200/70 bg-white"
                  >
                    <button
                      onClick={() => setSelected(p)}
                      className="block w-full text-left"
                      aria-label={`查看${p.name}`}
                    >
                      <ProductImage product={p} />
                    </button>
                    <div className="p-4 md:p-5">
                      <p className="mb-2 text-xs text-stone-500">
                        {p.category} · {p.size}
                      </p>
                      <button
                        onClick={() => setSelected(p)}
                        className="text-left font-medium leading-6"
                      >
                        {p.name}
                      </button>
                      <p className="mt-2 truncate text-xs text-stone-500">
                        {p.color} · {p.spec}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-serif text-xl text-emerald-950">
                          {money(p.priceFen)}
                        </span>
                        <button
                          aria-label={`将${p.name}加入购物袋`}
                          disabled={p.stock < 1 || (cart[p.id] || 0) >= p.stock}
                          onClick={() => add(p)}
                          className="rounded-full bg-emerald-50 p-2 text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-stone-400">
                        {p.stock > 0 ? `可售 ${p.stock} 件` : "暂时售罄"}
                        {cart[p.id] ? ` · 已选 ${cart[p.id]} 件` : ""}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-2xl">我的订单</h2>
              <button
                disabled={busy}
                className={secondary}
                onClick={() => void run(loadOrders)}
              >
                <RefreshCw size={16} className="mr-2 inline" />
                刷新列表
              </button>
            </div>
            {!orders.length ? (
              <div className="rounded-2xl bg-white p-12 text-center">
                <ShoppingBag
                  className="mx-auto mb-4 text-stone-400"
                  size={36}
                />
                <p>
                  {ordersLoaded
                    ? "还没有订单，去挑选心仪好物吧"
                    : "登录后查看你的订单"}
                </p>
                <button
                  className={`${primary} mt-6`}
                  onClick={() =>
                    ordersLoaded ? setView("goods") : setLogin(true)
                  }
                >
                  {ordersLoaded ? "去逛逛" : "登录查看"}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-stone-200 bg-white p-5 md:p-7"
                  >
                    <div className="flex flex-wrap justify-between gap-3 border-b border-stone-100 pb-4">
                      <div>
                        <p className="text-sm text-stone-500">
                          {new Date(order.createdAt).toLocaleString("zh-CN")}
                        </p>
                        <p className="mt-1 break-all text-xs text-stone-400">
                          订单号 {order.id}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-emerald-800">
                        {order.kind && order.kind!=='goods' && order.status==='completed' ? (order.kind==='event'?'报名已缴费':'课程已开通') : order.deliveryMethod === "pickup" && order.status === "paid" ? "待自提" : statuses[order.status] || order.status}
                      </span>
                    </div>
                    <div className="space-y-3 py-5">
                      {order.items.map((item) => (
                        <div
                          key={item.product_id}
                          className="flex justify-between gap-5"
                        >
                          <div>
                            <p>{item.name}</p>
                            <p className="mt-1 text-xs text-stone-500">
                              {item.spec}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm">
                            {money(item.unit_fen)} × {item.quantity}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm leading-6 text-stone-500">
                      {order.kind && order.kind !== 'goods' ? (order.kind==='event'?'报名缴费人：':'学员：') : order.deliveryMethod === 'pickup' ? '提货联系人：' : '收件人：'}{order.recipient} · {order.phone}
                      <br />
                      {order.deliveryMethod === "pickup" ? "自提 · 提货时间与地点请联系客服确认" : order.address}
                    </p>
                    {order.trackingNo && (
                      <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                        {order.carrier} · 运单号 {order.trackingNo}
                      </p>
                    )}
                    {order.refundReason && (
                      <p className="mt-3 text-sm text-stone-500">
                        退款原因：{order.refundReason}
                      </p>
                    )}
                    {order.exclusive&&<p className="mt-3 text-sm text-stone-600">专属订单 {order.exclusive.number} · 优惠 {money(order.exclusive.discountFen)}{order.exclusive.refundedFen>0&&<> · 已退款 {money(order.exclusive.refundedFen)}（{order.exclusive.refundedFen<order.totalFen?'部分退款':'全额退款'}）</>}</p>}
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="font-serif text-xl">
                          {money(order.totalFen)}
                        </span>
                        <span className="ml-3 text-xs text-stone-500">
                          {order.kind && order.kind !== 'goods' ? (order.kind==='event'?'赛事报名费 · ':'课程订单 · ') : `含运费 ${money(order.exclusive?.shippingFen||0)} · `}
                          {order.provider === "wechat" ? "微信支付" : "支付宝"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.status === 'completed' && order.kind !== 'goods' && order.targetId && <a className={primary} href={order.kind==='event'?'/dashboard/events':order.kind==='online'?`/courses/${order.targetId}?source=platform`:'/dashboard/profile#offline-courses'}>{order.kind==='event'?'查看赛事报名':order.kind==='online'?'查看已购课程':'查看已购课时'}</a>}
                        {order.status === "pending" && (
                          <>
                            <button
                              disabled={busy}
                              className={secondary}
                              onClick={() => void action(order, "cancel")}
                            >
                              取消订单
                            </button>
                            <button
                              disabled={busy || order.expiresAt < Date.now()}
                              className={primary}
                              onClick={() => void run(() => pay(order))}
                            >
                              继续付款
                            </button>
                          </>
                        )}
                        {["pending", "refunding"].includes(order.status) && (
                          <button
                            disabled={busy}
                            className={secondary}
                            onClick={() => void action(order, "refresh")}
                          >
                            查询支付状态
                          </button>
                        )}
                        {order.status === "shipped" && (
                          <button
                            disabled={busy}
                            className={primary}
                            onClick={() => void action(order, "received")}
                          >
                            确认收货
                          </button>
                        )}
                        {["paid", "shipped", "completed"].includes(
                          order.status,
                        ) && (
                          <button
                            disabled={busy}
                            className={secondary}
                            onClick={() => {
                              setRefundOrder(order);
                              setReason("");
                            }}
                          >
                            申请退款
                          </button>
                        )}
                      </div>
                    </div>
                    {order.status === "pending" && (
                      <p className="mt-3 text-xs text-stone-400">
                        付款截止{" "}
                        {new Date(order.expiresAt).toLocaleString("zh-CN")}
                        ，超时关闭订单后释放库存。
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mt-14 border-t border-stone-200 pt-8 text-center text-sm leading-7 text-stone-500">
          <p>伊娃甄选 · 伊娃东方舞官方商城</p>
          <p>快递包邮 · 发货信息可在「我的订单」查询 · 售后可提交退款申请</p>
        </div>
      </main>
      {selected && (
        <Dialog title={selected.name} close={closeSelected}>
          <div className="grid gap-6 md:grid-cols-2">
            <ProductImage product={selected} />
            <div className="flex flex-col justify-center">
              <p className="text-sm text-stone-500">{selected.category}</p>
              <button type="button" className="mt-3 inline-block text-sm text-emerald-800 underline" onClick={() => window.dispatchEvent(new Event("website-share-open"))}>分享这件商品到微信</button>
              <p className="my-4 font-serif text-3xl text-emerald-950">
                {money(selected.priceFen)}
              </p>
              <div className="space-y-3 text-sm">
                <p>款式：{selected.spec}</p>
                <p>尺码：{selected.size}</p>
                <p>颜色：{selected.color}</p>
                <p>
                  可售库存：
                  {products.find((p) => p.id === selected.id)?.stock ?? 0} 件
                </p>
                <p className="text-emerald-800">快递包邮</p>
              </div>
              <button
                disabled={
                  !products.find((p) => p.id === selected.id)?.stock ||
                  (cart[selected.id] || 0) >=
                    (products.find((p) => p.id === selected.id)?.stock || 0)
                }
                className={`${primary} mt-7`}
                onClick={() => {
                  const current = products.find((p) => p.id === selected.id);
                  if (current) add(current);
                  setSelected(null);
                  setCartOpen(true);
                }}
              >
                加入购物袋
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {cartOpen && (
        <Dialog title="购物袋与结算" close={closeCart} busy={busy}>
          {!entries.length ? (
            <div className="py-10 text-center">
              <ShoppingBag className="mx-auto mb-4 text-stone-400" size={40} />
              <p>购物袋还是空的</p>
              <button className={`${primary} mt-6`} onClick={closeCart}>
                继续挑选
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex justify-between text-sm"><span className="font-semibold">伊娃甄选</span><span className="text-stone-500">共 {entries.reduce((sum, [, q]) => sum + q, 0)} 件商品</span></div>
              <div className="space-y-3 rounded-2xl bg-stone-100 p-3">
                {entries.map(([id, q]) => {
                  const p = products.find((item) => item.id === id);
                  return (
                    <div
                      key={id}
                      className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
                    >
                      <div className="w-20 shrink-0 overflow-hidden rounded-lg">{p && <ProductImage product={p} />}</div>
                      <div className="min-w-[110px] flex-1">
                        <p className="font-medium">{p?.name || "商品已下架"}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {p
                            ? `${p.size} / ${p.color} · ${money(p.priceFen)}`
                            : id}
                        </p>
                        {(!p || q > p.stock) && (
                          <p className="mt-2 text-xs text-red-600">
                            库存不足或已下架，请调整数量
                          </p>
                        )}
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        <button
                          className="rounded-lg border p-1.5"
                          aria-label={`减少${p?.name || "商品"}数量`}
                          onClick={() => change(id, q - 1)}
                        >
                          <Minus size={16} />
                        </button>
                        <span>{q}</span>
                        <button
                          className="rounded-lg border p-1.5 disabled:opacity-30"
                          disabled={!p || q >= p.stock || q >= 99}
                          aria-label={`增加${p?.name || "商品"}数量`}
                          onClick={() => change(id, q + 1)}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          aria-label="移除商品"
                          onClick={() => change(id, 0)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form
                className="mt-7 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void checkout();
                }}
              >
                <fieldset className="rounded-2xl border border-stone-200 bg-white p-4">
                  <legend className="px-2 font-medium">配送方式</legend>
                  <div className="grid grid-cols-2 gap-3">{(["express","pickup"] as const).map(method => <label key={method} className={`cursor-pointer rounded-xl border p-3 text-sm ${deliveryMethod===method ? "border-emerald-800 bg-emerald-50 text-emerald-900" : "border-stone-200"}`}><input type="radio" name="delivery" checked={deliveryMethod===method} onChange={()=>setDeliveryMethod(method)} className="mr-2 accent-emerald-800" />{method==="pickup" ? "自提" : "快递配送 · 包邮"}</label>)}</div>
                  {deliveryMethod==="pickup" && <p className="mt-3 text-xs leading-5 text-stone-500">付款后请联系客服确认提货时间与地点，凭订单信息提货。</p>}
                </fieldset>
                <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
                <h3 className="font-medium">{deliveryMethod === "pickup" ? "提货联系人" : "收货信息"}</h3>
                <label className="block text-sm">
                  {deliveryMethod === "pickup" ? "联系人" : "收件人"}
                  <input
                    required
                    maxLength={40}
                    autoComplete="shipping name"
                    value={recipient}
                    onChange={(e) => {shippingDirty.current=true;setRecipient(e.target.value);}}
                    className={field}
                    placeholder={deliveryMethod === "pickup" ? "请输入提货联系人姓名" : "请输入收件人姓名"}
                  />
                </label>
                <label className="block text-sm">
                  手机号
                  <input
                    type="tel"
                    required
                    maxLength={25}
                    autoComplete="shipping tel"
                    value={phone}
                    onChange={(e) => {shippingDirty.current=true;setPhone(e.target.value);}}
                    className={field}
                    placeholder="用于订单联系"
                  />
                </label>
                {deliveryMethod === "express" && <label className="block text-sm">
                  详细地址
                  <textarea
                    required
                    minLength={8}
                    maxLength={300}
                    autoComplete="shipping street-address"
                    value={address}
                    onChange={(e) => {shippingDirty.current=true;setAddress(e.target.value);}}
                    className={field}
                    placeholder="省、市、区、街道及门牌号"
                    rows={2}
                  />
                </label>}
                </section>
                <fieldset className="rounded-2xl border border-stone-200 bg-white p-4">
                  <legend className="px-2 text-sm font-medium">支付方式</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {(["wechat", "alipay"] as const).map((p) => (
                      <label
                        key={p}
                        className={`rounded-xl border p-4 text-sm ${provider === p ? "border-emerald-800 bg-emerald-50" : "border-stone-200"} ${!payment[p] ? "opacity-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={p}
                          checked={provider === p}
                          disabled={!payment[p]}
                          onChange={() => setProvider(p)}
                          className="mr-2 accent-emerald-800"
                        />
                        {p === "wechat" ? "微信支付" : "支付宝"}
                        {!payment[p] && (
                          <span className="mt-1 block text-xs">暂未开通</span>
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {deliveryMethod === "express" && <button type="button" disabled={busy} className="text-sm text-emerald-800" onClick={() => void run(saveAddress)}>保存为个人中心收货地址</button>}
                {!payment.wechat && !payment.alipay && (
                  <p
                    role="status"
                    className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    线上支付正在开通中，商品可先加入购物袋，暂时不能提交订单。
                  </p>
                )}
                <div className="flex justify-between border-t border-stone-200 pt-5 text-sm">
                  <span>运费</span>
                  <span>{deliveryMethod === "pickup" ? "自提 ¥0.00" : "包邮 ¥0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>应付金额</span>
                  <strong className="text-2xl font-semibold text-orange-600">
                    {money(total)}
                  </strong>
                </div>
                <p className="text-xs leading-6 text-stone-500">
                  下单后保留库存 15 分钟，请及时付款。付款结果以订单状态为准。
                </p>
                <button
                  type="submit"
                  disabled={busy || invalid || !payment[provider] || loading}
                  className={`${primary} sticky bottom-0 w-full shadow-lg`}
                >
                  {busy ? "正在处理…" : "提交订单并支付"}
                </button>
              </form>
            </>
          )}
        </Dialog>
      )}
      {payDisplay && (
        <Dialog title="订单付款" close={closePay}>
          <div className="text-center">
            {payDisplay.qr ? (
              <>
                <img
                  src={payDisplay.qr}
                  className="mx-auto w-64 max-w-full"
                  alt="微信支付订单二维码"
                />
                <p className="mt-3">请使用微信扫一扫完成支付</p>
                <p className="mt-2 text-xs text-stone-500">
                  手机上可使用另一台设备扫码。
                </p>
              </>
            ) : (
              <p>正在查询支付结果</p>
            )}
            <p className="mt-5 break-all text-xs text-stone-400">
              {payDisplay.id}
            </p>
            <p className="mt-3 text-sm text-stone-500">
              此窗口会自动查询结果。也可关闭后在「我的订单」继续付款。
            </p>
            <button
              className={`${secondary} mt-5`}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const data = await api(`orders/${payDisplay.id}/refresh`, {});
                  setOrders((old) => [
                    data.order,
                    ...old.filter((o) => o.id !== data.order.id),
                  ]);
                  if (data.order.status !== "pending") setPayDisplay(null);
                  else setError("尚未确认付款，请稍后重试");
                })
              }
            >
              我已付款，查询结果
            </button>
          </div>
        </Dialog>
      )}
      {refundOrder && (
        <Dialog title="申请退款" close={closeRefund} busy={busy}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(refundOrder, "refund", { reason });
            }}
          >
            <p className="mb-4 text-sm leading-7 text-stone-500">
              可申请退款金额 {money(refundOrder.totalFen-(refundOrder.exclusive?.refundedFen||0))}
              。已发货商品由客服核实退货后处理，退款将原路返回。
            </p>
            <label className="text-sm">
              退款原因
              <textarea
                required
                maxLength={300}
                rows={4}
                className={field}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请说明需要退款的原因"
              />
            </label>
            <button disabled={busy} className={`${primary} mt-5 w-full`}>
              提交退款申请
            </button>
          </form>
        </Dialog>
      )}
      <StudentLoginModal
        open={login}
        onClose={() => setLogin(false)}
        nextPath="/shop/selection"
        onSuccess={() => {
          setLogin(false);
          void loadOrders();
        }}
      />
    </div>
  );
}
