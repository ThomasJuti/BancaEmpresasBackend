import type { Express } from 'express';
import { powerAppsRouter } from './features/power-apps/presentation/routes.js';

/**
 * Rutas HTTP expuestas actualmente.
 * Otras etapas del pipeline (file-matching, sales-calls, etc.) se irán
 * registrando aquí conforme se implementen.
 */
export function registerFeatureRoutes(app: Express): void {
  app.use('/api/power-apps', powerAppsRouter);
}
