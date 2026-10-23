/** @type {import('next').NextConfig} */
const { resolveServiceOrigin } = require('./config/runtime-origins.cjs');

const managementOrigin = resolveServiceOrigin({
  value: process.env.MANAGEMENT_ORIGIN,
  nodeEnv: process.env.NODE_ENV,
  productionFallback: 'https://admin.swod.com.cn',
  developmentFallback: 'http://localhost:3000',
});
const adminOrigin = resolveServiceOrigin({
  value: process.env.ADMIN_ORIGIN || process.env.NEXT_PUBLIC_ADMIN_ORIGIN,
  nodeEnv: process.env.NODE_ENV,
  productionFallback: 'https://admin.swod.com.cn',
  developmentFallback: 'http://localhost:3003',
});

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async redirects() {
    return [
      {
        source: '/dance-circle/eva-portrait-2026',
        destination: '/people/eva',
        permanent: true,
      },
      {
        source: '/events-news',
        destination: '/events',
        permanent: true,
      },
      {
        source: '/events-news/:path*',
        destination: '/events/:path*',
        permanent: true,
      },
      {
        source: '/reports/alida-2026-graduation.html',
        destination: '/dance-circle/alida-2026-graduation',
        permanent: true,
      },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mmbiz.qpic.cn',
      },
      {
        protocol: 'https',
        hostname: 'pics.ciyuan.xyz',
      },
      {
        protocol: 'https',
        hostname: 'admin.swod.com.cn',
      },
    ],
  },
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'echarts', 'echarts-for-react'],
  },
  async rewrites() {
    return [
      {
        source: '/api/login',
        destination: `${managementOrigin}/api/login`,
      },
      {
        source: '/api/switch-token',
        destination: `${managementOrigin}/api/switch-token`,
      },
      {
        source: '/api/send-code',
        destination: `${managementOrigin}/api/send-code`,
      },
      {
        source: '/api/student-login',
        destination: `${managementOrigin}/api/student-login`,
      },
      {
        source: '/api/student/:path*',
        destination: `${managementOrigin}/api/student/:path*`,
      },
      {
        source: '/api/register',
        destination: `${managementOrigin}/api/register`,
      },
      {
        source: '/api/members/:path*',
        destination: `${managementOrigin}/api/members/:path*`,
      },
      {
        source: '/api/payments',
        destination: `${managementOrigin}/api/payments`,
      },
      {
        source: '/api/certificates',
        destination: `${adminOrigin}/api/certificates`,
      },
      {
        source: '/api/consume-records',
        destination: `${managementOrigin}/api/consume-records`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.weixin.qq.com https://*.qq.com",
          },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/china.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      // Keep these after the generic static-asset rule so service worker and
      // manifest updates are never made immutable by a broader matcher.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
        ],
      },
    ];
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

module.exports = nextConfig;
