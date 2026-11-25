const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { createApp } = require('../dist/app.js');

async function withServer(context) {
  const server = createApp().listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

test('server returns its public response', async (context) => {
  const base = await withServer(context);
  const response = await fetch(base + '/api/hello');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), { message: 'Hello, API User!' });
});

test('health endpoint reports availability', async (context) => {
  const base = await withServer(context);
  const response = await fetch(base + '/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('unknown routes return 404', async (context) => {
  const base = await withServer(context);
  assert.equal((await fetch(base + '/missing')).status, 404);
});
