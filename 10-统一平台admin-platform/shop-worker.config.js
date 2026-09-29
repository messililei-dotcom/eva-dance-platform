module.exports = {
  apps: [{
    name: 'shop-order-worker',
    cwd: __dirname,
    script: '.shop-worker/worker.cjs',
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
    kill_timeout: 35000,
    env: { NODE_ENV: 'production' },
    time: true,
  }],
};
