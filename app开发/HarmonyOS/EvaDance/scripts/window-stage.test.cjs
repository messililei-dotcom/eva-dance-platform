const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(path.resolve(__dirname, '../../../../10-统一平台admin-platform/node_modules/typescript'));

const source = fs.readFileSync(path.join(__dirname, '../entry/src/main/ets/entryability/EntryAbility.ets'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

function fixture(credentials) {
  const platform = { credentials, initialize: async () => {} };
  const exports = {};
  const modules = {
    '@kit.AbilityKit': { UIAbility: class {} },
    '@kit.PerformanceAnalysisKit': { hilog: { info() {}, warn() {}, error() {} } },
    '../services/PlatformApi': { platform },
  };
  vm.runInNewContext(compiled, { exports, require: (name) => modules[name] || {} });
  return { ability: new exports.default(), platform };
}

function stage(privacyReady = Promise.resolve()) {
  return {
    loads: 0,
    privacyCalls: [],
    async getMainWindow() {
      return { setWindowPrivacyMode: async (enabled) => {
        this.privacyCalls.push(enabled);
        await privacyReady;
      } };
    },
    loadContent() { this.loads++; },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('guest can open the page and enable privacy on demand', async () => {
  const { ability, platform } = fixture();
  const guest = stage();
  ability.onWindowStageCreate(guest);
  await settle();
  assert.equal(guest.loads, 1);
  assert.deepEqual(guest.privacyCalls, []);
  await platform.protectScreen();
  assert.equal(platform.screenProtected, true);
});

test('member privacy is enabled before the page loads', async () => {
  const { ability, platform } = fixture({});
  const privacy = deferred();
  const member = stage(privacy.promise);
  ability.onWindowStageCreate(member);
  await settle();
  assert.deepEqual(member.privacyCalls, [true]);
  assert.equal(member.loads, 0);
  privacy.resolve();
  await settle();
  assert.equal(member.loads, 1);
  assert.equal(platform.screenProtected, true);
});

test('destroyed stage cannot load its page or mark its replacement protected', async () => {
  const { ability, platform } = fixture({});
  const privacy = deferred();
  const old = stage(privacy.promise);
  ability.onWindowStageCreate(old);
  await settle();
  assert.deepEqual(old.privacyCalls, [true]);
  ability.onWindowStageDestroy();
  platform.credentials = undefined;
  const replacement = stage();
  ability.onWindowStageCreate(replacement);
  privacy.resolve();
  await settle();
  assert.equal(old.loads, 0);
  assert.equal(replacement.loads, 1);
  assert.equal(platform.screenProtected, false);
  await platform.protectScreen();
  assert.deepEqual(replacement.privacyCalls, [true]);
});
