#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tls = require('node:tls');
const { execFileSync } = require('node:child_process');
const { certificatePayload } = require('./eva-certbot-cdn-deploy.cjs');
const LINEAGE = '/etc/letsencrypt/live/swod-wildcard';
const DOMAIN = 'vod.swod.com.cn';

function inspectTls() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: DOMAIN, port: 443, servername: DOMAIN }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve({ fingerprint: cert.fingerprint256, expires: cert.valid_to });
    });
    socket.setTimeout(10000, () => socket.destroy(new Error('VOD TLS handshake timed out')));
    socket.on('error', reject);
  });
}

function rpc(action, params) {
  const output = execFileSync('/usr/bin/node', [
    '/usr/local/sbin/eva-aliyun-rpc.js', 'vod.cn-shanghai.aliyuncs.com',
    '2017-03-21', 'cn-shanghai', action, '-',
  ], { input: JSON.stringify(params), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 45000 });
  return JSON.parse(output);
}

async function deploy({ lineage = process.env.RENEWED_LINEAGE, checkOnly = false,
  read = fs.readFileSync, call = rpc, inspect = inspectTls,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!lineage || path.resolve(lineage) !== LINEAGE) return { skipped: true };
  const certPem = read(path.join(LINEAGE, 'fullchain.pem'), 'utf8');
  const keyPem = read(path.join(LINEAGE, 'privkey.pem'), 'utf8');
  const payload = certificatePayload(certPem, keyPem);
  if (!new crypto.X509Certificate(certPem).checkHost(DOMAIN)) throw new Error('Certificate does not cover VOD');
  const info = { ...payload.publicInfo, domain: DOMAIN };
  if (checkOnly) return { validated: true, ...info };
  const matches = actual => actual && actual.fingerprint === info.fingerprint
    && Date.parse(actual.expires) === Date.parse(info.expires);
  let before;
  try { before = await inspect(); } catch { /* Expired live TLS is precisely what this hook repairs. */ }
  if (matches(before)) return { current: true, ...info };
  const { CertType, ...params } = payload.params;
  await call('SetVodDomainCertificate', { ...params, DomainName: DOMAIN,
    CertName: `swod-vod-${info.fingerprint.replace(/:/g, '').slice(0, 16).toLowerCase()}` });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt) await pause(2000);
    try {
      if (matches(await inspect())) return { updated: true, ...info };
    } catch { /* Allow edge certificate propagation before reporting failure. */ }
  }
  throw new Error('VOD certificate not verified at the public TLS endpoint');
}

module.exports = { deploy, inspectTls };
if (require.main === module) {
  deploy({ checkOnly: process.argv.includes('--check') })
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => {
      // Never expose child-process output, certificate keys or credential material.
      console.error('VOD certificate sync failed; inspect renewal hook and public TLS status.');
      process.exitCode = 1;
    });
}
