import { CourseAccessProvider } from '@/components/CourseAccess';
import BottomNav from '@/components/BottomNav';
import type { Metadata } from 'next';
import './globals.css';
import './mobile-app.css';
import Navbar from '@/components/Navbar_v2';
import Footer from '@/components/Footer_v2';
import FloatingToolbar from '@/components/FloatingToolbar';
import WechatShareBridge from '@/components/WechatShareBridge';
import StudentSessionBootstrap from '@/components/StudentSessionBootstrap';
import PWAProvider from '@/components/PWAProvider';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import InboxNotificationReminder from '@/components/InboxNotificationReminder';
import MobileHistorySwipe from '@/components/MobileHistorySwipe';
import { buildShareMetadata } from '@/lib/share-metadata';

const rootShareMetadata = buildShareMetadata({
  title: '伊娃东方舞 · 专注东方舞师资培训',
  description: '伊娃东方舞，专注东方舞师资培训，提供线上录播课程、直播大师课、线下集训营、师资认证等专业课程。',
  path: '/',
  image: '/icons/icon-512-20261005.png',
});

export const metadata: Metadata = {
  ...rootShareMetadata,
  metadataBase: new URL('https://www.swod.com.cn'),
  title: {
    default: '伊娃东方舞 · 专注东方舞师资培训',
    template: '%s | 伊娃东方舞',
  },
  applicationName: 'SWOD',
  manifest: '/manifest-20261006.json',
  appleWebApp: {
    capable: true,
    title: 'SWOD',
    statusBarStyle: 'default',
  },
  keywords: ['东方舞', '埃及舞', '师资培训', '舞蹈教学', '伊娃老师', '东方舞圈'],
  icons: {
    icon: [
      { url: '/icons/favicon-16x16-20261005.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32-20261005.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48x48-20261005.png', sizes: '48x48', type: 'image/png' },
    ],
    shortcut: '/icons/favicon-32x32-20261005.png',
    apple: '/icons/pwa/apple-touch-icon-20261006.png',
    other: [
      { rel: 'apple-touch-icon-precomposed', url: '/icons/pwa/apple-touch-icon-20261006.png', sizes: '180x180' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="theme-color" content="#ffffff" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-1290x2796-20261005.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-1179x2556-20261005.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-1170x2532-20261005.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-1284x2778-20261005.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-1125x2436-20261005.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-750x1334-20261005.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-warm-white">
        {/* Ensure Tailwind includes custom colors */}
        <div className="hidden text-text text-gold text-gold-dark text-gold-light text-crimson text-crimson-dark text-sand" />
        <StudentSessionBootstrap />
        <PWAProvider />
        <InboxNotificationReminder />
        <MobileHistorySwipe />
        <Navbar />
        <FloatingToolbar />
        <WechatShareBridge />
        <PWAInstallPrompt />
        <CourseAccessProvider><main className="site-main overflow-x-hidden">{children}</main></CourseAccessProvider>
        <BottomNav />
        <Footer />
      </body>
    </html>
  );
}
