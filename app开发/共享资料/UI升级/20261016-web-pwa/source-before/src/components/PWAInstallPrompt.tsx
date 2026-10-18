'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'swod_pwa_install_dismissed_at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function PWAInstallPrompt() {
  const pathname = usePathname();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_MS) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const safari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
    if (ios && safari) {
      const timer = window.setTimeout(() => { setShowIosGuide(true); setVisible(true); }, 1800);
      return () => window.clearTimeout(timer);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setPromptEvent(null);
  };

  // Never cover playback controls, authentication forms, or the tutorial itself.
  if (!visible || pathname === '/install' || pathname === '/login' || /\/courses\/[^/]+\/videos/.test(pathname)) return null;
  return (
    <aside className="pwa-install-card" aria-label="安装伊娃东方舞应用" role="dialog">
      <button className="pwa-install-close" onClick={dismiss} aria-label="暂不安装"><X size={18} /></button>
      <img src="/icons/pwa/icon-192-20261006.png" alt="" width={54} height={54} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#2A0C0D]">安装伊娃东方舞</p>
        <p className="mt-1 text-xs leading-5 text-[#765B4C]">
          {showIosGuide ? <><Share className="inline -translate-y-px" size={14} /> 点击 Safari 底部“分享”，选择“添加到主屏幕”。</> : '安装到桌面，下次直接打开学习。'}
        </p>
        <div className="mt-3 flex items-center gap-3">
          {promptEvent && <button className="pwa-install-primary" onClick={install}><Download size={16} /> 一键安装</button>}
          <Link className="text-xs font-semibold text-[#9B6E27] underline-offset-4 hover:underline" href="/install">查看教程</Link>
        </div>
      </div>
    </aside>
  );
}
