module.exports = {
  apps: [{
    name: 'admin-platform',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3003',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3003,
      NEXT_PUBLIC_API_URL: 'http://localhost:3000/api',
      NEXT_PUBLIC_APP_NAME: '伊娃东方舞数字化运营平台'
    },
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 3000,
    watch: false
  }]
};
