const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deploy, certificatePayload } = require('./eva-certbot-cdn-deploy.cjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-cert-test-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tmp, 'key.pem'), '-out', path.join(tmp, 'cert.pem'), '-days', '90', '-subj', '/CN=*.swod.com.cn'], { stdio: 'ignore' });
const cert = fs.readFileSync(path.join(tmp, 'cert.pem'), 'utf8');
const key = fs.readFileSync(path.join(tmp, 'key.pem'), 'utf8');
const read = file => file.endsWith('/privkey.pem') ? key : cert;
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
test('unrelated renewals never load keys or call CDN', () => {
  assert.equal(deploy({ lineage: '/etc/letsencrypt/live/swod-platform', read: () => { throw Error('must not read'); }, call: () => { throw Error('must not call'); } }).skipped, true);
});
test('check-only validates the pair without changing CDN', () => {
  const result = deploy({ lineage: '/etc/letsencrypt/live/swod-wildcard', checkOnly: true, read, call: () => { throw Error('must not call'); } });
  assert.equal(result.validated, true); assert.equal(JSON.stringify(result).includes('PRIVATE KEY'), false);
});
test('successful update verifies the same domain, name and expiry', () => {
  let written;
  const result = deploy({ lineage: '/etc/letsencrypt/live/swod-wildcard', read, call(action, params) {
    if (action === 'SetCdnDomainSSLCertificate') { written = params; return {}; }
    assert.equal(params.DomainName, '.swod.com.cn');
    return { CertInfos: { CertInfo: [{ DomainName: '.swod.com.cn', CertName: written.CertName, CertExpireTime: certificatePayload(cert, key).publicInfo.expires }] } };
  } });
  assert.equal(result.updated, true); assert.equal(written.SSLProtocol, 'on');
});
test('verification mismatch and API failures are surfaced', () => {
  assert.throws(() => deploy({ lineage: '/etc/letsencrypt/live/swod-wildcard', read, call: () => ({}) }), /verification/);
  assert.throws(() => deploy({ lineage: '/etc/letsencrypt/live/swod-wildcard', read, call: () => { throw Error('API unavailable'); } }), /API unavailable/);
});
test('expiring certificate is rejected', () => {
  const expiry = Date.parse(new (require('node:crypto').X509Certificate)(cert).validTo);
  assert.throws(() => certificatePayload(cert, key, expiry - 86400000), /14 more days/);
});
