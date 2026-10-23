'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Heart, Headphones, PhoneCall, Star, X } from 'lucide-react';
import { CLOSE_CUSTOMER_SERVICE_EVENT, OPEN_CUSTOMER_SERVICE_EVENT } from '@/lib/ui-events';

const customerServiceQRCodes = [
  {
    name: 'Monica 海艳老师',
    src: '/images/contact/wechat-monica-haiyan.jpg',
    note: '课程咨询',
  },
  {
    name: 'Elin 伊琳老师',
    src: '/images/contact/wechat-elin-yilin.jpg',
    note: '报名咨询',
  },
];

const customerServicePhones = [
  {
    name: '海艳老师',
    phone: '+8615367870529',
    display: '153 6787 0529',
  },
  {
    name: '伊琳老师',
    phone: '+8619310029982',
    display: '193 1002 9982',
  },
];

export default function FloatingToolbar() {
  const [showQRCode, setShowQRCode] = useState(false);
  const [showFavoriteHelp, setShowFavoriteHelp] = useState(false);
  const [favoriteCopied, setFavoriteCopied] = useState(false);
  const [showMobileService, setShowMobileService] = useState(false);

  const openFavorite = () => {
    const legacyWindow = window as typeof window & {
      external?: { AddFavorite?: (url: string, title: string) => void };
      sidebar?: { addPanel?: (title: string, url: string, empty: string) => void };
    };
    try {
      if (legacyWindow.external?.AddFavorite) {
        legacyWindow.external.AddFavorite(window.location.href, document.title);
        return;
      }
      if (legacyWindow.sidebar?.addPanel) {
        legacyWindow.sidebar.addPanel(document.title, window.location.href, '');
        return;
      }
    } catch {
      // Modern browsers block programmatic bookmarks; show the supported shortcut instead.
    }
    setFavoriteCopied(false);
    setShowFavoriteHelp(true);
  };

  const copyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFavoriteCopied(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = window.location.href;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      setFavoriteCopied(document.execCommand('copy'));
      textarea.remove();
    }
  };

  const items = [
    { id: 'star', icon: Star, label: '收藏', action: 'favorite', color: 'bg-white hover:bg-gold hover:text-white' },
    { id: 'follow', icon: Heart, label: '关注', action: 'showQRCode', color: 'bg-gradient-to-b from-crimson to-gold text-white' },
    { id: 'service', icon: Headphones, label: '客服', action: 'showQRCode', color: 'bg-white hover:bg-gold hover:text-white' },
  ];

  useEffect(() => {
    const openMobileService = () => setShowMobileService(true);
    const closeMobileService = () => setShowMobileService(false);
    window.addEventListener(OPEN_CUSTOMER_SERVICE_EVENT, openMobileService);
    window.addEventListener(CLOSE_CUSTOMER_SERVICE_EVENT, closeMobileService);
    return () => {
      window.removeEventListener(OPEN_CUSTOMER_SERVICE_EVENT, openMobileService);
      window.removeEventListener(CLOSE_CUSTOMER_SERVICE_EVENT, closeMobileService);
    };
  }, []);

  return (
    <>
      {/* 主工具栏 - 横向布局 */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-0">
        {items.map((item, index) => {
          const IconComponent = item.icon;
          const isSpecial = item.color.includes('gradient');
          
          return (
            <div key={item.id} className="relative group">
              {/* 主按钮 */}
              <button
                onClick={() => {
                  if (item.action === 'favorite') {
                    openFavorite();
                  }
                  if (item.action === 'showQRCode') {
                    setShowQRCode(true);
                  }
                }}
                className={`
                  flex flex-col items-center justify-center
                  w-14 h-14
                  transition-all duration-200
                  shadow-sm hover:shadow-lg
                  ${isSpecial ? item.color + ' animate-pulse' : item.color + ' text-[#1A1A1A]'}
                  ${index === 0 ? 'rounded-tl-xl' : ''}
                  ${index === items.length - 1 ? 'rounded-bl-xl' : ''}
                `}
                title={item.label}
              >
                <IconComponent className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">
                  {item.label}
                </span>
              </button>
              
              {/* Hover展开提示 */}
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap pointer-events-none">
                <div className="bg-[#1A1A1A]/95 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-lg shadow-lg border border-white/10">
                  {item.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 收藏说明：现代浏览器不允许网页直接写入书签。 */}
      {showFavoriteHelp && (
        <div className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" aria-label="收藏本页">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setShowFavoriteHelp(false)} aria-label="关闭收藏说明" />
          <section className="relative w-full max-w-sm rounded-2xl border border-[#E8DDCB] bg-white p-6 text-center shadow-2xl">
            <button type="button" onClick={() => setShowFavoriteHelp(false)} className="absolute right-3 top-3 rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="关闭">
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F3EA] text-[#A98746]">
              <Star className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-serif text-xl font-semibold text-[#1A1A1A]">收藏伊娃东方舞官网</h3>
            <div className="mt-4 space-y-2 rounded-xl bg-[#F8F3EA] px-4 py-3 text-left text-sm leading-6 text-[#66594D]">
              <p>微信内：点击右上角“…”后选择“收藏”。</p>
              <p>电脑浏览器：按 <strong>Ctrl + D</strong>；Mac 请按 <strong>⌘ + D</strong>。</p>
              <p>手机浏览器：打开浏览器菜单，选择“添加书签”或“添加到主屏幕”。</p>
            </div>
            <button type="button" onClick={copyCurrentUrl} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#9F1D20] px-4 py-3 text-sm font-semibold text-white">
              {favoriteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {favoriteCopied ? '网址已复制' : '复制官网网址'}
            </button>
          </section>
        </div>
      )}

      {/* 二维码弹窗 */}
      {showQRCode && (
        <div className="fixed inset-x-4 bottom-20 z-[10030] rounded-xl border border-gray-100 bg-white p-5 shadow-2xl md:bottom-auto md:left-auto md:right-20 md:top-1/2 md:w-72 md:-translate-y-1/2 md:p-6">
          <button
            onClick={() => setShowQRCode(false)}
            className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
          
          <h3 className="font-serif font-semibold text-lg text-[#1A1A1A] mb-4 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-crimson" />
            关注与咨询
          </h3>

          <div className="mb-4 space-y-2 rounded-lg bg-[#F8F3EA] p-3">
            {customerServicePhones.map((item) => (
              <a
                key={item.phone}
                href={`tel:${item.phone}`}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm text-[#1A1A1A] shadow-sm transition-colors hover:text-crimson"
              >
                <span className="flex items-center gap-2 font-medium">
                  <PhoneCall className="h-4 w-4 text-crimson" />
                  {item.name}
                </span>
                <span className="font-semibold text-crimson">{item.display}</span>
              </a>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {customerServiceQRCodes.map((qr) => (
              <div key={qr.name} className="text-center">
                <div className="mx-auto mb-3 overflow-hidden rounded-lg border border-gold/20 bg-white">
                  <Image
                    src={qr.src}
                    alt={`${qr.name}微信二维码`}
                    width={360}
                    height={480}
                    className="aspect-[3/4] w-full object-contain"
                  />
                </div>
                <p className="text-sm font-medium text-[#1A1A1A]">{qr.name}</p>
                <p className="text-xs text-gray-500 mt-1">{qr.note}</p>
              </div>
            ))}
          </div>
          
          <p className="text-xs text-gray-600 mt-4 text-center leading-relaxed">
            扫码添加客服微信，咨询课程、报名与活动安排
          </p>
        </div>
      )}

      {showMobileService && (
        <div
          role="button"
          tabIndex={-1}
          className="fixed inset-0 z-[10030] cursor-default bg-transparent md:hidden"
          aria-label="关闭客服信息"
          onClick={() => setShowMobileService(false)}
        />
      )}

      {/* 移动端客服面板由顶部导航按钮打开 */}
      {showMobileService && (
        <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[10040] flex flex-col items-end md:hidden">
          <div className="pointer-events-auto space-y-1.5 rounded-2xl border border-[#E8DDCB] bg-white/95 p-2 shadow-xl shadow-crimson/10 backdrop-blur">
            {customerServicePhones.map((item) => (
              <a
                key={item.phone}
                href={`tel:${item.phone}`}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#8B1A1A] transition-colors hover:bg-[#F8F3EA]"
                aria-label={`拨打${item.name}电话${item.display}`}
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>{item.name}</span>
                <span>{item.display}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
