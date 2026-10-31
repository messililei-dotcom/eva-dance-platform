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
  Share2,
  ArrowRight,
  Check,
} from "lucide-react";
import { usePageShare } from "@/components/PageShareData";
import StudentLoginModal from "@/components/StudentLoginModal";
import { studentApi } from "@/lib/student-api";
import Link from "next/link";
import { groupCatalog, productGroupKey, productShareDescription } from "@/lib/product-presentation";
import "./selection.css";

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
  groupName?: string;
  detailText?: string;
  detailImages?: string[];
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
  "min-h-11 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-40";
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
          className="h-full w-full object-contain"
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
  page = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  busy?: boolean;
  page?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (page) return;
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (!ref.current?.contains(e.target as Node)) return;
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
  }, [close, busy, page]);
  if (page) return <main className="selection-product-page mx-auto max-w-5xl px-4 py-6"><nav className="mb-4 flex items-center justify-between"><Link href="/shop/selection" className="inline-flex min-h-11 items-center text-sm text-emerald-800">返回全部商品</Link><Link href="/shop/selection?orders=1" className="inline-flex min-h-11 items-center text-sm text-emerald-800">我的订单</Link></nav><h2 className="mb-6 text-2xl font-semibold">{title}</h2>{children}</main>;
  return (
    <div
      className="selection-dialog-overlay fixed inset-0 z-[10060] flex items-center justify-center bg-black/50 p-3"
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
        className="selection-dialog max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[#faf9f5] p-5 shadow-2xl outline-none md:p-8"
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
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sort, setSort] = useState("available");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);
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
    title: selected.groupName || selected.name,
    desc: productShareDescription(selected),
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
  const add = (p: Product) => {
    if (p.stock < 1) return;
    setCart((old) => ({
      ...old,
      [p.id]: Math.min(99, p.stock, (old[p.id] || 0) + 1),
    }));
    setNotice(`已将${p.name}加入购物袋`);
  };
  const buy = (p: Product) => {
    if (p.stock < 1) return;
    if (!(cart[p.id] > 0)) add(p);
    if (!initialProductId) setSelected(null);
    setCartOpen(true);
    void loadProducts(true);
  };
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
  const groups = groupCatalog(products);
  const selectedVariants = selected ? products.filter(p => productGroupKey(p) === productGroupKey(selected)) : [];
  const filtered = groups.filter(group =>
    (category === "全部" || group.category === category) &&
    (!onlyAvailable || group.stock > 0) &&
    group.variants.some(p => `${p.groupName || ""} ${p.name} ${p.category} ${p.spec} ${p.size} ${p.color}`.toLowerCase().includes(search.trim().toLowerCase()))
  ).sort((a, b) => sort === "price-low" ? a.priceFen - b.priceFen
    : sort === "price-high" ? b.priceFen - a.priceFen
    : Number(b.stock > 0) - Number(a.stock > 0));
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
    <div data-mobile-surface="shop" className="mobile-shop-surface min-h-screen bg-[#faf9f5] pb-40 text-stone-800">
      <section className={`bg-emerald-950 px-4 text-white ${initialProductId ? "pb-4 pt-24" : "pb-8 pt-28 md:pb-10 md:pt-32"}`}>
        <div className="mx-auto max-w-7xl">
          <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="font-serif text-3xl md:text-5xl">
                {initialProductId ? "伊娃甄选" : "为每一次起舞，精选。"}
              </h1>
              <p className={`${initialProductId ? "hidden" : ""} mt-4 max-w-xl leading-7 text-emerald-100`}>
                从日常练习到舞台时刻，找到与你相伴的东方舞好物。
              </p>
            </div>
            <div className={`${initialProductId ? "hidden" : "flex"} items-center gap-3 text-sm`}>
              <Truck size={24} strokeWidth={1.5} />
              <div>
                <p>快递包邮</p>
                <p className="mt-1 text-xs text-emerald-100">
                  精选舞服 · 练习装备
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <main className={`${initialProductId && view === "goods" ? "hidden" : ""} mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8`}>
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
        {view === "goods" && initialProductId ? null : view === "goods" ? (
          <>
            <div className="selection-tools mb-6 space-y-4">
              <label className="flex items-center gap-3 rounded-xl border border-stone-300 bg-white px-4 focus-within:ring-2 focus-within:ring-emerald-700">
                <Search size={20} className="shrink-0 text-stone-500" />
                <input aria-label="搜索商品" placeholder="搜索商品、款式、尺码或颜色" className="min-w-0 flex-1 bg-transparent py-3.5 text-base outline-none placeholder:text-stone-500" value={search} onChange={(e) => setSearch(e.target.value)} />
                {search && <button aria-label="清空搜索" className="min-h-11 px-2" onClick={() => setSearch("")}><X size={18} /></button>}
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="selection-filter">分类
                  <select aria-label="商品分类" value={category} onChange={e => setCategory(e.target.value)}>
                    {["全部", ...new Set(products.map(p => p.category).filter(Boolean))].map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="selection-filter">排序
                  <select aria-label="商品排序" value={sort} onChange={e => setSort(e.target.value)}>
                    <option value="available">有货优先</option><option value="price-low">价格从低到高</option><option value="price-high">价格从高到低</option>
                  </select>
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={onlyAvailable} onChange={e => setOnlyAvailable(e.target.checked)} className="h-4 w-4 accent-emerald-800" />只看有货</label>
                <span role="status" className="text-stone-600 md:ml-auto">{loading ? "正在更新…" : `共 ${filtered.length} 件好物`}</span>
              </div>
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
                    setOnlyAvailable(false);
                    void loadProducts();
                  }}
                  className={`${secondary} mt-5`}
                >
                  重新查看
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => (
                  <article
                    key={p.id}
                    className="selection-product group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white"
                  >
                    <Link href={`/shop/products/${encodeURIComponent(p.id)}`} className="block w-full text-left" aria-label={`查看${p.displayName}`}><ProductImage product={{...p, name:p.displayName}} /></Link>
                    <div className="flex flex-1 flex-col p-3 md:p-5">
                      <p className="mb-2 text-xs text-stone-500">
                        {p.category}
                      </p>
                      <Link href={`/shop/products/${encodeURIComponent(p.id)}`} className="min-h-12 text-left font-medium leading-6 break-words">{p.displayName}</Link>
                      <p className="mt-2 min-h-8 text-xs leading-4 text-stone-600">
                        {p.variants.length > 1 ? `${new Set(p.variants.map(v => v.color)).size} 色 · ${new Set(p.variants.map(v => v.size)).size} 个尺码可选` : [p.color !== "默认" ? p.color : "", p.size, p.spec].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                        <span className="text-xl font-semibold tabular-nums text-emerald-950">
                          {money(p.priceFen)}{p.maxPriceFen > p.priceFen && <span className="ml-1 text-xs font-normal">起</span>}
                        </span>
                        <button
                          aria-label={`选择${p.displayName}的规格`}
                          disabled={p.stock < 1}
                          onClick={() => setSelected(products.find(v => v.id === p.id) || null)}
                          className="min-h-11 min-w-11 rounded-xl bg-emerald-50 p-2 text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-stone-600">
                        {p.stock > 0 ? `可售 ${p.stock} 件` : "暂时售罄"}

                      </p>
                      <button className={`${primary} mt-3 w-full px-2`} disabled={p.stock < 1} onClick={() => setSelected(products.find(v => v.id === p.id) || null)}>{p.stock > 0 ? "选购商品" : "暂时售罄"}</button>
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
      {notice && <div role="status" className="selection-notice fixed left-1/2 z-[10200] flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-emerald-950 px-4 py-3 text-sm text-white shadow-lg"><Check size={18} className="shrink-0" />{notice}</div>}
      {view === "goods" && count > 0 && !cartOpen && !selected && <div className="selection-cart-bar fixed z-[10010] flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl">
        <div className="min-w-0"><p className="text-xs text-stone-600">已选 {count} 件 · 包邮</p><p className="text-xl font-semibold tabular-nums text-emerald-950">{loading && !products.length ? "核对价格中…" : invalid ? "请核对商品" : money(total)}</p></div>
        <button className={primary} onClick={() => { setCartOpen(true); void loadProducts(true); }}>查看购物袋 · 去结算<ArrowRight size={16} className="ml-2 inline" /></button>
      </div>}
      {initialProductId && view === "goods" && !selected && !cartOpen && <section className="mx-auto max-w-5xl px-4 py-10"><p role="status" className="text-stone-600">{loading ? "正在载入商品…" : "商品信息暂不可用，请刷新重试或返回商城。"}</p><Link href="/shop/selection" className={`${secondary} mt-5 inline-block`}>返回全部商品</Link>{!loading && <button className={`${primary} ml-3`} onClick={() => void loadProducts()}>重新加载</button>}</section>}
      {selected && view === "goods" && !cartOpen && (
        <Dialog title={selected.groupName || selected.name} close={closeSelected} page={Boolean(initialProductId)}>
          <div className="grid gap-6 md:grid-cols-2">
            <ProductImage product={selected} />
            <div className="flex flex-col justify-center">
              <p className="text-sm text-stone-500">{selected.category}</p>
              <p className="my-4 text-3xl font-semibold tabular-nums text-emerald-950">{money(selected.priceFen)}</p>
              {selectedVariants.length > 1 && <div className="space-y-4 pb-5">
                {([['color', '颜色'], ['size', '尺码'], ['spec', '款式']] as const).map(([field, label]) => <fieldset key={field}><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">
                  {[...new Set(selectedVariants.map(v => v[field]))].map(value => {
                    const matches = selectedVariants.filter(v => v[field] === value && (field === 'color' || v.color === selected.color) && (field !== 'spec' || v.size === selected.size));
                    const next = matches.find(v => v.size === selected.size && v.spec === selected.spec) || matches.find(v => v.stock > 0) || matches[0];
                    return <button key={value} type="button" aria-pressed={selected[field] === value} disabled={!next} className={`min-h-11 rounded-xl border px-4 py-2 text-sm disabled:opacity-40 ${selected[field] === value ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-stone-300 bg-white'}`} onClick={() => next && setSelected(next)}>{value || '未填写'}{matches.length > 0 && matches.every(v => v.stock < 1) ? ' · 售罄' : ''}</button>;
                  })}
                </div></fieldset>)}
                {selectedVariants.filter(v => v.color === selected.color && v.size === selected.size && v.spec === selected.spec).length > 1 && <fieldset><legend className="mb-2 text-sm font-medium">规格条目</legend><div className="flex flex-wrap gap-2">{selectedVariants.filter(v => v.color === selected.color && v.size === selected.size && v.spec === selected.spec).map(v => <button key={v.id} type="button" aria-pressed={selected.id === v.id} className={secondary} onClick={() => setSelected(v)}>{v.name} · {money(v.priceFen)} · 库存 {v.stock}</button>)}</div></fieldset>}
              </div>}
              <dl className="selection-specs text-sm">
                <div><dt>款式</dt><dd>{selected.spec || "未填写"}</dd></div>
                <div><dt>尺码</dt><dd>{selected.size || "未填写"}</dd></div>
                <div><dt>颜色</dt><dd>{selected.color || "未填写"}</dd></div>
                <div><dt>库存</dt><dd>{selected.stock > 0 ? `${selected.stock} 件` : "暂时售罄"}</dd></div>
              </dl>
              <p className="mt-4 flex items-center gap-2 text-sm text-emerald-800"><Truck size={18} />快递包邮 · 支持自提</p>
              <button type="button" className={`${secondary} mt-5 flex items-center justify-center gap-2`} onClick={() => window.dispatchEvent(new Event("website-share-open"))}><Share2 size={17} />分享商品给朋友</button>
              <div className="selection-detail-actions mt-5 grid grid-cols-2 gap-3">
                <button disabled={selected.stock < 1 || (cart[selected.id] || 0) >= Math.min(99, selected.stock)} className={secondary} onClick={() => add(selected)}>加入购物袋</button>
                <button disabled={selected.stock < 1} className={primary} onClick={() => buy(selected)}>去结算<ArrowRight size={16} className="ml-1 inline" /></button>
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-600">请核对款式、尺码和颜色；结算时可调整数量。</p>
            </div>
          </div>
          <section className="mt-8 border-t border-stone-200 pt-6"><h3 className="mb-4 text-lg font-semibold">商品详情</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-stone-600">{selected.detailText || '更多商品信息与尺码建议，请联系客服确认。请以下单时所选款式、颜色和尺码为准。'}</p>
            <div className="mt-5 space-y-4">{selected.detailImages?.map((src, index) => <img key={`${src}-${index}`} src={src.startsWith('/') ? `https://admin.swod.com.cn${src}` : src} alt={`${selected.groupName || selected.name} · 详情图 ${index + 1}`} loading="lazy" className="h-auto w-full rounded-xl object-contain" />)}</div>
          </section>
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
              <div className="divide-y divide-stone-200">
                {entries.map(([id, q]) => {
                  const p = products.find((item) => item.id === id);
                  return (
                    <div
                      key={id}
                      className="flex flex-wrap items-center gap-3 py-4"
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
