'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Share2, X } from 'lucide-react';
import { publicShareUrl, shareText, SHARE_ORIGIN, type PublicShare } from '@/lib/public-share';
import { pageShareOverride } from './PageShareData';
import { usePathname, useSearchParams } from 'next/navigation';

type WechatSdk = {
  config: (options: Record<string, unknown>) => void;
  error?: (callback: () => void) => void;
  ready: (callback: () => void) => void;
  updateAppMessageShareData?: (options: Record<string, unknown>) => void;
  updateTimelineShareData?: (options: Record<string, unknown>) => void;
  onMenuShareAppMessage?: (options: Record<string, unknown>) => void;
  onMenuShareTimeline?: (options: Record<string, unknown>) => void;
};

const WECHAT_JS_SDK = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';

function readMeta(...names: string[]) {
  for (const name of names) {
    const elements = document.querySelectorAll<HTMLMetaElement>(
      `meta[property="${name}"], meta[name="${name}"]`,
    );
    const content = elements[elements.length - 1]?.content?.trim();
    if (content) return content;
  }
  return '';
}

function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value || '/', window.location.origin).href;
}

function readShare(): PublicShare {
  const override = pageShareOverride?.pathname === window.location.pathname ? pageShareOverride.data : null;
  const canonical = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')).pop()?.href;
  const title = shareText(override?.title || readMeta('weixin:title', 'og:title') || document.title, '伊娃东方舞');
  return {
    title,
    desc: shareText(override?.desc || readMeta('weixin:description', 'og:description', 'description'), title),
    link: publicShareUrl(window.location.href, override?.link || canonical),
    imgUrl: new URL(override?.imgUrl || readMeta('weixin:image', 'og:image') || '/icons/icon-512-20261005.png', SHARE_ORIGIN).href,
  };
}
let sdkLoading: Promise<void> | null = null;
function loadWechatSdk() {
  if ((window as unknown as { wx?: WechatSdk }).wx) return Promise.resolve();
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WECHAT_JS_SDK;
    script.async = true;
    const timeout = window.setTimeout(() => { script.remove(); sdkLoading = null; reject(new Error('SDK timeout')); }, 15000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); sdkLoading = null; reject(new Error('SDK unavailable')); };
    document.head.appendChild(script);
  });
  return sdkLoading;
}

function ShareBridge() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const entryUrl = useRef('');
  const [share, setShare] = useState<PublicShare | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [status, setStatus] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!entryUrl.current) entryUrl.current = window.location.href.split('#')[0];
    setOpen(false);
    const refresh = () => setShare(previous => {
      const next = readShare();
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 80); };
    const observer = new MutationObserver(records => {
      if (records.some(record => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (target?.matches('meta, title, link[rel="canonical"]')) return true;
        return Array.from(record.addedNodes).some(node => node instanceof Element && (node.matches('meta, title, link[rel="canonical"]') || node.querySelector('meta, title, link[rel="canonical"]')));
      })) schedule();
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['content', 'href'] });
    window.addEventListener('website-share-change', schedule);
    const openShare = () => { setShare(readShare()); setCopied(''); setOpen(true); };
    window.addEventListener('website-share-open', openShare);
    refresh();
    return () => { window.removeEventListener('website-share-open', openShare); clearTimeout(timer); observer.disconnect(); window.removeEventListener('website-share-change', schedule); };
  }, [pathname, search]);

  useEffect(() => {
    if (!share || !/micromessenger/i.test(navigator.userAgent)) return;
    let cancelled = false;
    const controller = new AbortController();
    setStatus('正在准备微信分享…');
    async function configure() {
      try {
        await loadWechatSdk();
        if (cancelled) return;
        const wx = (window as unknown as { wx: WechatSdk }).wx;
        const signatureUrl = /iphone|ipad|ipod/i.test(navigator.userAgent) ? entryUrl.current : window.location.href.split('#')[0];
        const response = await fetch(`/api/wechat/js-sign?url=${encodeURIComponent(signatureUrl)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('signature unavailable');
        const data = await response.json();
        if (cancelled) return;
        wx.ready(() => {
          if (cancelled) return;
          const latest = readShare();
          wx.updateAppMessageShareData?.(latest);
          wx.updateTimelineShareData?.({ title: latest.title, link: latest.link, imgUrl: latest.imgUrl });
          wx.onMenuShareAppMessage?.(latest);
          wx.onMenuShareTimeline?.({ title: latest.title, link: latest.link, imgUrl: latest.imgUrl });
          setStatus('点击微信右上角“…” → 发送给朋友或分享到朋友圈。');
        });
        wx.error?.(() => { if (!cancelled) setStatus('微信分享卡片暂未就绪，可先复制链接发送给朋友。'); });
        wx.config({ debug: false, ...data, jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage', 'onMenuShareTimeline'] });
      } catch {
        if (!cancelled) setStatus('微信分享卡片暂未就绪，可先复制链接发送给朋友。');
      }
    }
    void configure();
    return () => { cancelled = true; controller.abort(); };
  }, [share, pathname, search]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus(); };
  }, [open]);

  async function copy() {
    const data = readShare();
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied('链接已复制，可粘贴到微信发送');
    } catch {
      const input = document.createElement('textarea');
      input.value = data.link; input.style.position = 'fixed'; input.style.opacity = '0';
      document.body.appendChild(input); input.select(); input.setSelectionRange(0, input.value.length);
      const ok = document.execCommand('copy'); input.remove();
      setCopied(ok ? '链接已复制，可粘贴到微信发送' : '请长按下方链接复制');
    }
  }
  return <>
    <button type="button" aria-label="分享本页到微信" onClick={() => { setShare(readShare()); setCopied(''); setOpen(true); }} className="fixed right-3 bottom-24 z-40 flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2.5 text-sm text-emerald-900 shadow-lg lg:bottom-8 lg:right-6"><Share2 size={17} />分享</button>
    {open && share && <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 px-5" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="微信分享" className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <button ref={closeRef} type="button" aria-label="关闭分享" className="absolute right-3 top-3 p-2" onClick={() => setOpen(false)}><X size={20} /></button>
        <h2 className="pr-9 text-lg font-semibold">微信分享</h2>
        <p className="mt-4 font-medium">{share.title}</p>
        <p className="mt-2 text-sm text-stone-500">{share.desc}</p>
        <p className="mt-4 text-sm leading-6">{status || '复制链接后，打开微信粘贴给朋友；也可以在微信中打开后，点击右上角“…”转发。'}</p>
        <button type="button" onClick={copy} className="mt-4 w-full rounded-xl bg-emerald-900 px-4 py-3 text-white">复制分享链接</button>
        <p role="status" className="mt-2 text-sm text-emerald-800">{copied}</p>
        <input aria-label="分享链接" readOnly value={share.link} onFocus={e => e.target.select()} className="mt-2 w-full rounded border border-stone-200 p-2 text-xs" />
      </section>
    </div>}
  </>;
}
export default function WechatShareBridge() {
  return <Suspense fallback={null}><ShareBridge /></Suspense>;
}
