/** @type {import('next').NextConfig} */
const legacyStudentApiUrl = process.env.LEGACY_STUDENT_API_URL || 'https://admin.swod.com.cn/api';

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  compress: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: process.env.ALLOW_BUILD_TYPE_ERRORS === 'true',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    cpus: 1,
    optimizePackageImports: ['@ant-design/icons', 'antd', 'lucide-react', 'echarts', 'echarts-for-react'],
    proxyClientMaxBodySize: '5gb',
  },
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: '/legacy-student-api/:path*',
          destination: `${legacyStudentApiUrl}/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
