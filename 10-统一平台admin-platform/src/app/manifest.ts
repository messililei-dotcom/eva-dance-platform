import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '伊娃东方舞数字化运营平台',
    short_name: 'SWOD',
    description: '伊娃东方舞管理员专用数字化运营平台',
    start_url: '/login?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#F6F7FB',
    theme_color: '#07172D',
    lang: 'zh-CN',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/pwa-icon-192-20261005.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512-20261005.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-maskable-512-20261005.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '学员授权', short_name: '授权', url: '/online-course/auth', icons: [{ src: '/pwa-icon-192-20261005.png', sizes: '192x192' }] },
      { name: '学员信息', short_name: '学员', url: '/members', icons: [{ src: '/pwa-icon-192-20261005.png', sizes: '192x192' }] },
      { name: '线下课程', short_name: '课程', url: '/training', icons: [{ src: '/pwa-icon-192-20261005.png', sizes: '192x192' }] },
      { name: '订单中心', short_name: '订单', url: '/orders', icons: [{ src: '/pwa-icon-192-20261005.png', sizes: '192x192' }] },
    ],
  };
}
