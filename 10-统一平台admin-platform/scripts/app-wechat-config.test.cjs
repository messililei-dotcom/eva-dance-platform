const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const moduleObject = {exports: {}};
new Function('require', 'module', 'exports', ts.transpileModule(
  fs.readFileSync('src/lib/server/app-wechat-config.ts', 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}
).outputText)(name => name === 'server-only' ? {} : require(name), moduleObject, moduleObject.exports);
const {loadMobileWechatCredentials: load} = moduleObject.exports;
const appId = 'wx0123456789abcdef';
const appSecret = 'a'.repeat(32); // Fake credential; never load the developer's real secret in tests.

test('mobile credentials never fall back to website or mini-program variables', () => {
  assert.equal(load({NODE_ENV: 'production', WECHAT_QR_APP_ID: appId, WECHAT_QR_APP_SECRET: appSecret,
    WECHAT_APP_ID: appId, WECHAT_APP_SECRET: appSecret}), null);
  assert.deepEqual(load({WECHAT_MOBILE_APP_ID: appId, WECHAT_MOBILE_APP_SECRET: appSecret}), {appId, appSecret});
});
test('incomplete or malformed environment pairs fail closed rather than reading local credentials', () => {
  for (const pair of [
    {WECHAT_MOBILE_APP_ID: appId}, {WECHAT_MOBILE_APP_SECRET: appSecret},
    {WECHAT_MOBILE_APP_ID: '', WECHAT_MOBILE_APP_SECRET: appSecret},
    {WECHAT_MOBILE_APP_ID: appId, WECHAT_MOBILE_APP_SECRET: 'bad'},
  ]) assert.equal(load(pair), null);
});
test('explicit private file requires a mobile record, absolute path and private permissions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swod-wechat-config-'));
  const file = path.join(dir, 'mobile.json');
  const env = {NODE_ENV: 'production', WECHAT_MOBILE_CONFIG_FILE: file};
  try {
    fs.writeFileSync(file, JSON.stringify({applicationType: 'mobile', appId, appSecret}), {mode: 0o600});
    assert.deepEqual(load(env), {appId, appSecret});
    // Environment pairs are atomic, even when a valid file is available.
    assert.equal(load({...env, WECHAT_MOBILE_APP_ID: appId}), null);
    fs.chmodSync(file, 0o644); assert.equal(load(env), null);
    fs.chmodSync(file, 0o600);
    fs.writeFileSync(file, JSON.stringify({applicationType: 'website', appId, appSecret}));
    assert.equal(load(env), null);
    fs.writeFileSync(file, 'invalid json'); assert.equal(load(env), null);
    assert.equal(load({...env, WECHAT_MOBILE_CONFIG_FILE: 'relative.json'}), null);
    fs.unlinkSync(file); assert.equal(load(env), null);
    const other = path.join(dir, 'other.json');
    fs.writeFileSync(other, JSON.stringify({applicationType: 'mobile', appId, appSecret}), {mode: 0o600});
    fs.symlinkSync(other, file); assert.equal(load(env), null);
  } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
