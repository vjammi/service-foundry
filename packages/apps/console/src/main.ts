import { createApp } from './app';

const rawPort = process.env.PORT ?? '3000';
if (!/^\d+$/.test(rawPort) || Number(rawPort) > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535');
}
const port = Number(rawPort);
const host = process.env.HOST ?? '0.0.0.0';
const server = createApp().listen(port, host, () => {
  const address = server.address();
  if (address && typeof address !== 'string') {
    console.log('console listening on ' + host + ':' + address.port);
  }
});

server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close((error) => {
    clearTimeout(timeout);
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
