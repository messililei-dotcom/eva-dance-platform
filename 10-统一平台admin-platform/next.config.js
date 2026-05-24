/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/finance/:path*',
        destination: 'http://127.0.0.1:3201/api/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
