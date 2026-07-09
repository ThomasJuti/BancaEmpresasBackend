import express from 'express';
import cors from 'cors';
import helmetImport from 'helmet';
import { errorHandler } from './shared/middlewares/error-handler.js';
import { notFoundHandler } from './shared/middlewares/not-found.js';
import { registerFeatureRoutes } from './routes.js';
import { docsRouter } from './infrastructure/docs/docs.routes.js';

export function createApp() {
  const app = express();
  const helmet =
    typeof helmetImport === 'function'
      ? helmetImport
      : (helmetImport as unknown as { default: typeof helmetImport }).default;

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'banca-empresas-backend' });
  });

  app.use('/docs', docsRouter);
  registerFeatureRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
