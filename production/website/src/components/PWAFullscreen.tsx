'use client';

import { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { isStandalonePwa } from '@/lib/pwa-auth-flow';

export default function PWAFullscreen() {
  const [standalone, setStandalone] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hint, setHint] = useState('');
  useEffect(() => {
    setStandalone(isStandalonePwa() || window.matchMedia('(display-mode: fullscreen)').matches);
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else throw new Error('unsupported');
      setHint('');
    } catch {
      setHint(/Mac/i.test(navigator.platform) ? '请使用窗口左上角绿色按钮进入全屏。' : '请按 F11（部分电脑需 Fn + F11）切换全屏。');
    }
  };
  if (!standalone) return null;
  return <div className="fixed bottom-5 left-5 z-40 hidden max-w-xs md:block">
    <button type="button" onClick={toggle} aria-label={fullscreen ? '退出全屏' : '进入全屏'} className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}{fullscreen ? '退出全屏' : '进入全屏'}
    </button>
    <p role="status" className="mt-2 rounded bg-white text-sm text-gray-800">{hint}</p>
  </div>;
}
