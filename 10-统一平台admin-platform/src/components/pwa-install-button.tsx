'use client';

import { useEffect, useState } from 'react';
import { App, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
  const { message } = App.useApp();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') message.success('管理端已安装');
      setPromptEvent(null);
      return;
    }

    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      message.info('请点击 Safari 底部“分享”，再选择“添加到主屏幕”');
    } else {
      message.info('请在浏览器菜单中选择“安装应用”或“添加到主屏幕”');
    }
  };

  if (installed) return null;

  return (
    <Button
      className={compact ? 'pwa-install-button is-compact' : 'pwa-install-button'}
      type={compact ? 'text' : 'default'}
      icon={<DownloadOutlined />}
      onClick={install}
      aria-label="安装管理端应用"
    >
      {compact ? null : '安装管理端应用'}
    </Button>
  );
}
