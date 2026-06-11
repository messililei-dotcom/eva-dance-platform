'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 根页面 — 根据访问域名自动跳转
 * - 默认进入管理后台登录
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: '#F6F7FB',
      color: '#121A3A',
      textAlign: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <div style={{
          width: 56,
          height: 56,
          margin: '0 auto 16px',
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(135deg, #F72A8A, #7C3AED)',
          color: '#fff',
          fontSize: 26,
          fontWeight: 900,
          boxShadow: '0 16px 34px rgba(247,42,138,0.22)',
        }}>
          E
        </div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>正在进入伊娃东方舞平台</div>
        <div style={{ marginTop: 8, color: '#606A80', fontSize: 13 }}>请稍候...</div>
      </div>
    </main>
  );
}
