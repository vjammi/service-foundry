import express from 'express';
import { greet } from '@service-foundry/shared';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());


  app.get('/api/hello', (req, res) => {
    res.json({ message: greet('API User') });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
