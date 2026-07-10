import type { Express } from 'express';
import { pipelineRouter } from './core/pipeline/presentation/routes.js';
import { createActivationFollowUpRouter } from './features/activation-follow-up/presentation/routes.js';
import { deliveryConfirmationRouter } from './features/delivery-confirmation/presentation/routes.js';
import { getShipmentScheduler } from './features/delivery-confirmation/infrastructure/composition.js';
import { fileMatchingRouter } from './features/file-matching/presentation/routes.js';
import { createPowerAppsRouter } from './features/power-apps/presentation/routes.js';
import { getFollowUpCallService } from './features/sales-calls/infrastructure/composition.js';
import { salesCallsRouter } from './features/sales-calls/presentation/routes.js';

/** Registra las rutas HTTP de cada feature del pipeline. */
export function registerFeatureRoutes(app: Express): void {
  app.use('/api/pipeline', pipelineRouter);
  app.use('/api/file-matching', fileMatchingRouter);
  app.use('/api/sales-calls', salesCallsRouter);
  // El composition root es el único lugar que conoce todas las features:
  // arma el ShipmentScheduler de delivery-confirmation y lo inyecta en power-apps,
  // y el FollowUpCallService de sales-calls y lo inyecta en activation-follow-up.
  app.use('/api/power-apps', createPowerAppsRouter(getShipmentScheduler()));
  app.use('/api/delivery-confirmation', deliveryConfirmationRouter);
  app.use('/api/activation-follow-up', createActivationFollowUpRouter(getFollowUpCallService()));
}
