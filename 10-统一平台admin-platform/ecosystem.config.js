const fs = require('fs');
const path = require('path');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;
      const index = trimmed.indexOf('=');
      if (index < 0) return env;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (key) env[key] = value;
      return env;
    }, {});
}

const productionEnv = readEnvFile(path.join(__dirname, '.env.production'));

const sharedSecret = process.env.ADMIN_SESSION_SECRET || productionEnv.ADMIN_SESSION_SECRET || 'eva-dongfangwuquan-2026-stream-secret';

module.exports = {
  apps: [{
    name: 'admin-platform',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3003',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3003,
      NEXT_DIST_DIR: '.next-build',
      ADMIN_LOCAL_AUTH: 'true',
      ADMIN_DB_PATH: './admin.db',
      ADMIN_PUBLIC_ORIGIN: 'https://admin.swod.com.cn',
      NEXT_PUBLIC_API_URL: '/api',
      NEXT_PUBLIC_LEGACY_STUDENT_API_URL: '/legacy-student-api',
      NEXT_PUBLIC_APP_NAME: '伊娃东方舞数字化运营平台',
      MAX_MATERIAL_UPLOAD_REQUEST_SIZE: process.env.MAX_MATERIAL_UPLOAD_REQUEST_SIZE || productionEnv.MAX_MATERIAL_UPLOAD_REQUEST_SIZE || String(5 * 1024 * 1024 * 1024),
      WECHAT_MINIAPP_APP_ID: process.env.WECHAT_MINIAPP_APP_ID || productionEnv.WECHAT_MINIAPP_APP_ID,
      WECHAT_MINIAPP_SECRET: process.env.WECHAT_MINIAPP_SECRET || productionEnv.WECHAT_MINIAPP_SECRET,
      WECHAT_IDENTITY_SYNC_SECRET: process.env.WECHAT_IDENTITY_SYNC_SECRET || productionEnv.WECHAT_IDENTITY_SYNC_SECRET,
      ALIYUN_ACCESS_KEY_ID: process.env.ALIYUN_ACCESS_KEY_ID || productionEnv.ALIYUN_ACCESS_KEY_ID,
      ALIYUN_ACCESS_KEY_SECRET: process.env.ALIYUN_ACCESS_KEY_SECRET || productionEnv.ALIYUN_ACCESS_KEY_SECRET,
      ALIYUN_VOD_REGION: process.env.ALIYUN_VOD_REGION || productionEnv.ALIYUN_VOD_REGION,
      ALIYUN_VOD_STORAGE_LOCATION: process.env.ALIYUN_VOD_STORAGE_LOCATION || productionEnv.ALIYUN_VOD_STORAGE_LOCATION,
      ALIYUN_VOD_APP_ID: process.env.ALIYUN_VOD_APP_ID || productionEnv.ALIYUN_VOD_APP_ID,
      ALIYUN_VOD_TEMPLATE_GROUP_ID: process.env.ALIYUN_VOD_TEMPLATE_GROUP_ID || productionEnv.ALIYUN_VOD_TEMPLATE_GROUP_ID,
      ALIYUN_VOD_PLAY_FORMATS: process.env.ALIYUN_VOD_PLAY_FORMATS || productionEnv.ALIYUN_VOD_PLAY_FORMATS,
      ALIYUN_VOD_PLAY_AUTH_TIMEOUT: process.env.ALIYUN_VOD_PLAY_AUTH_TIMEOUT || productionEnv.ALIYUN_VOD_PLAY_AUTH_TIMEOUT,
      ALIYUN_VOD_PLAY_DOMAIN: process.env.ALIYUN_VOD_PLAY_DOMAIN || productionEnv.ALIYUN_VOD_PLAY_DOMAIN || 'vod.swod.com.cn',
      ALIYUN_SMS_SIGN_NAME: process.env.ALIYUN_SMS_SIGN_NAME || '湖南雷震子咨询',
      ALIYUN_SMS_TEMPLATE_CODE: process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_505940264',
      ADMIN_SESSION_SECRET: sharedSecret,
      INBOX_JOB_SECRET: process.env.INBOX_JOB_SECRET || productionEnv.INBOX_JOB_SECRET || sharedSecret
    },
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 3000,
    watch: false
  }, {
    name: 'inbox-reminder-worker',
    script: 'scripts/inbox-reminder-worker.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      INBOX_JOB_URL: 'http://127.0.0.1:3003/api/inbox/jobs/run',
      INBOX_JOB_SECRET: process.env.INBOX_JOB_SECRET || productionEnv.INBOX_JOB_SECRET || sharedSecret,
      INBOX_JOB_INTERVAL_MS: process.env.INBOX_JOB_INTERVAL_MS || productionEnv.INBOX_JOB_INTERVAL_MS || String(30 * 60 * 1000),
    },
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    watch: false
  }]
};
