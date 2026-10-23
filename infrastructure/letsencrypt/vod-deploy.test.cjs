const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { deploy } = require('./eva-certbot-vod-deploy.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-vod-cert-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'),
  '-days', '90', '-subj', '/CN=*.swod.com.cn'], { stdio: 'ignore' });
const cert = fs.readFileSync(path.join(dir, 'cert.pem'), 'utf8');
const key = fs.readFileSync(path.join(dir, 'key.pem'), 'utf8');
const x = new crypto.X509Certificate(cert);
const live = { fingerprint: x.fingerprint256, expires: x.validTo };
const options = { lineage: '/etc/letsencrypt/live/swod-wildcard',
  read: file => file.endsWith('privkey.pem') ? key : cert, pause: async () => {} };
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('unrelated renewal does not load keys or contact VOD', async () => {
  assert.equal((await deploy({ lineage: '/etc/letsencrypt/live/swod-platform',
    read: () => { throw Error('unexpected'); } })).skipped, true);
});
test('check-only keeps keys out of the result and makes no RPC call', async () => {
  const result = await deploy({ ...options, checkOnly: true, call: () => { throw Error('unexpected'); } });
  assert.equal(result.validated, true);
  assert.equal(JSON.stringify(result).includes('PRIVATE KEY'), false);
});
test('expired VOD is updated via the VOD action and verified at its TLS endpoint', async () => {
  let probes = 0;
  let writes = 0;
  const result = await deploy({ ...options,
    inspect: async () => { if (++probes === 1) throw Error('CERT_HAS_EXPIRED'); return live; },
    call: (action, params) => {
      writes++;
      assert.equal(action, 'SetVodDomainCertificate');
      assert.equal(params.DomainName, 'vod.swod.com.cn');
      assert.equal(params.SSLProtocol, 'on');
      assert.match(params.CertName, /^swod-vod-/);
      assert.equal(params.SSLPub, cert);
      assert.equal(params.SSLPri, key);
      assert.equal('CertType' in params, false);
    },
  });
  assert.equal(result.updated, true);
  assert.equal(writes, 1);
});
test('an already current certificate does not trigger duplicate uploads', async () => {
  assert.equal((await deploy({ ...options, inspect: async () => live,
    call: () => { throw Error('unexpected'); } })).current, true);
});
test('wrong public certificate fails even if the update API succeeds', async () => {
  await assert.rejects(deploy({ ...options, inspect: async () => ({ fingerprint: 'old' }),
    call: () => ({}) }), /not verified/);
});
test('API errors propagate without reporting success', async () => {
  await assert.rejects(deploy({ ...options, inspect: async () => ({ fingerprint: 'old' }),
    call: () => { throw Error('denied'); } }), /denied/);
});
