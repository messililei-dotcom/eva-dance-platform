/** @type {import('next').NextConfig} */
const legacyStudentApiUrl = process.env.LEGACY_STUDENT_API_URL || 'https://admin.dongfangwuquan.com/api';

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    cpus: 1,
    proxyClientMaxBodySize: '4gb',
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
