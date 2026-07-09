import type { Express } from 'express';
import { pipelineRouter } from './core/pipeline/presentation/routes.js';
import { activationFollowUpRouter } from './features/activation-follow-up/presentation/routes.js';
import { deliveryConfirmationRouter } from './features/delivery-confirmation/presentation/routes.js';
import { fileMatchingRouter } from './features/file-matching/presentation/routes.js';
import { powerAppsRouter } from './features/power-apps/presentation/routes.js';
import { salesCallsRouter } from './features/sales-calls/presentation/routes.js';

/** Registra las rutas HTTP de cada feature del pipeline. */
export function registerFeatureRoutes(app: Express): void {
  app.use('/api/pipeline', pipelineRouter);
  app.use('/api/file-matching', fileMatchingRouter);
  app.use('/api/sales-calls', salesCallsRouter);
  app.use('/api/power-apps', powerAppsRouter);
  app.use('/api/delivery-confirmation', deliveryConfirmationRouter);
  app.use('/api/activation-follow-up', activationFollowUpRouter);
}
