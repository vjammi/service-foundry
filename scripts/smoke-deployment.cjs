const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

async function main() {
  const [directory, app] = process.argv.slice(2);
  assert.ok(directory && ['console', 'server'].includes(app), 'Usage: node scripts/smoke-deployment.cjs <directory> <console|server>');
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.resolve(directory),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const exited = once(child, 'exit');
  try {
    const output = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Startup timed out')), 10000);
      let text = '';
      child.stdout.on('data', (chunk) => {
        text += chunk;
        if (text.includes('\n')) {
          clearTimeout(timer);
          resolve(text);
        }
      });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error('Exited: ' + code)); });
    });
    const match = output.match(/:(\d+)\s/);
    assert.ok(match, 'Startup log must contain the assigned port');
    const base = 'http://127.0.0.1:' + match[1];
    const health = await fetch(base + '/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const response = await fetch(base + (app === 'console' ? '/' : '/api/hello'));
    assert.equal(response.status, 200);
    if (app === 'console') {
      assert.match(await response.text(), /Hello, User!/);
    } else {
      assert.deepEqual(await response.json(), { message: 'Hello, API User!' });
    }
    console.log('PASS isolated deployment: ' + app);
  } finally {
    if (child.exitCode === null) child.kill();
    await exited;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
