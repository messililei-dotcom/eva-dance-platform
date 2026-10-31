const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.resolve(__dirname, '../../../../10-统一平台admin-platform/node_modules/typescript'));

function load() {
  const source = fs.readFileSync(path.resolve(__dirname, '../entry/src/main/ets/services/ProductPresentation.ets'), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  new Function('module', 'exports', result.outputText)(module, module.exports);
  return module.exports;
}

test('shop prices use the API priceFen amount instead of the unrelated course price field', () => {
  const { productPrice } = load();
  assert.equal(productPrice({ priceFen: 16900, price: 1 }), '¥169.00');
  assert.equal(productPrice({ priceFen: 14900 }), '¥149.00');
  assert.equal(productPrice({ priceFen: 0 }), '¥0.00');
  for (const priceFen of [undefined, -1, NaN, Infinity, 1.5]) {
    assert.equal(productPrice({ priceFen }), '价格待确认');
  }
});

test('shop stock distinguishes a sold-out item from unknown inventory', () => {
  const { productStock } = load();
  assert.equal(productStock({ stock: 39 }), '库存 39');
  assert.equal(productStock({ stock: 0 }), '暂时售罄');
  for (const stock of [undefined, -1, NaN, Infinity, 1.5]) {
    assert.equal(productStock({ stock }), '库存待确认');
  }
});
