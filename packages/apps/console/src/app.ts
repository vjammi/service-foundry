import express from 'express';
import { greet } from '@service-foundry/shared';

export function createApp(): express.Express {
  const app = express();

  app.get('/', (req, res) => {
    res.send(`<h1>Console App</h1><p>${greet('User')}</p>`);
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
