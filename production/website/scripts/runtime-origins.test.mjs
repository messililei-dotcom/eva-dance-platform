import assert from 'node:assert/strict';
import test from 'node:test';
import origins from '../config/runtime-origins.cjs';

const options = {
  productionFallback: 'https://admin.swod.com.cn',
  developmentFallback: 'http://localhost:3000',
};

test('production rejects localhost values from development env files', () => {
  for (const value of [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://0.0.0.0:3000',
  ]) {
    assert.equal(origins.resolveServiceOrigin({
      ...options,
      value,
      nodeEnv: 'production',
    }), options.productionFallback);
  }
});

test('production keeps an explicit remote admin origin', () => {
  assert.equal(origins.resolveServiceOrigin({
    ...options,
    value: 'https://admin.swod.com.cn/',
    nodeEnv: 'production',
  }), 'https://admin.swod.com.cn');
});

test('development keeps localhost and has an isolated local default', () => {
  assert.equal(origins.resolveServiceOrigin({
    ...options,
    value: '',
    nodeEnv: 'development',
  }), 'http://localhost:3000');
});
