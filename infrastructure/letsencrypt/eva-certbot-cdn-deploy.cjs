#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const LINEAGE = '/etc/letsencrypt/live/swod-wildcard';
const DOMAIN = '.swod.com.cn';

function certificatePayload(certPem, keyPem, now = Date.now()) {
  const cert = new crypto.X509Certificate(certPem);
  if (!cert.checkHost('www.swod.com.cn') || !cert.checkHost('miniapi.swod.com.cn')) throw new Error('Certificate does not cover the wildcard CDN domain.');
  if (!cert.checkPrivateKey(crypto.createPrivateKey(keyPem))) throw new Error('Certificate/private key mismatch.');
  const expires = Date.parse(cert.validTo);
  if (Date.parse(cert.validFrom) > now || expires - now < 14 * 86400000) throw new Error('Certificate is not valid for at least 14 more days.');
  return {
    params: { DomainName: DOMAIN, SSLProtocol: 'on', CertType: 'upload', CertName: `swod-wildcard-${cert.fingerprint256.replace(/:/g, '').slice(0, 16).toLowerCase()}`, SSLPub: certPem, SSLPri: keyPem },
    publicInfo: { domain: DOMAIN, expires: new Date(expires).toISOString(), fingerprint: cert.fingerprint256 },
  };
}
function rpc(action, params) {
  // Certificate material travels through stdin, never process arguments or logs.
  const output = execFileSync('/usr/bin/node', ['/usr/local/sbin/eva-aliyun-rpc.js', 'cdn.aliyuncs.com', '2018-05-10', 'cn-hangzhou', action, '-'], { input: JSON.stringify(params), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 45000 });
  return JSON.parse(output);
}
function deploy({ lineage = process.env.RENEWED_LINEAGE, checkOnly = false, read = fs.readFileSync, call = rpc } = {}) {
  if (!lineage || path.resolve(lineage) !== LINEAGE) return { skipped: true, reason: 'unrelated certificate lineage' };
  const payload = certificatePayload(read(path.join(LINEAGE, 'fullchain.pem'), 'utf8'), read(path.join(LINEAGE, 'privkey.pem'), 'utf8'));
  if (checkOnly) return { validated: true, ...payload.publicInfo };
  call('SetCdnDomainSSLCertificate', payload.params);
  const response = call('DescribeDomainCertificateInfo', { DomainName: DOMAIN });
  const certs = response.CertInfos && response.CertInfos.CertInfo || [];
  const current = certs.find(item => item.DomainName === DOMAIN);
  if (!current || current.CertName !== payload.params.CertName || Date.parse(current.CertExpireTime) !== Date.parse(payload.publicInfo.expires)) throw new Error('CDN certificate verification failed after update.');
  return { updated: true, ...payload.publicInfo };
}
module.exports = { certificatePayload, deploy };
if (require.main === module) {
  try { console.log(JSON.stringify(deploy({ checkOnly: process.argv.includes('--check') }))); }
  catch (error) {
    // Child-process exceptions can contain request arguments and output. Do not log them.
    console.error('CDN certificate sync failed; check certificate validity, API permissions and CDN state.');
    process.exitCode = 1;
  }
}
