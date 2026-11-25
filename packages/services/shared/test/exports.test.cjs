const assert = require('node:assert/strict');
const { test } = require('node:test');
const { greet } = require('@service-foundry/shared');

test('public entry point exports the greeting function', () => {
  assert.equal(greet('API User'), 'Hello, API User!');
  assert.equal(greet(''), 'Hello, !');
});

test('internal paths cannot bypass the public exports', () => {
  assert.throws(() => require('@service-foundry/shared/dist/index.js'), {
    code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
  });
});

test('ES module consumers can load the public entry point', async () => {
  const shared = await import('@service-foundry/shared');
  assert.equal(shared.greet('User'), 'Hello, User!');
});
