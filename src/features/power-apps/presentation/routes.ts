import { Router } from 'express';
import { submitPowerAppHandler } from './power-apps.controller.js';
import { consultarRuesHandler, ruesHealthHandler } from './rues.controller.js';

/**
 * Simulador de Power App: comprobación de campos y decisión operativa.
 */
export const powerAppsRouter = Router();

powerAppsRouter.post('/submit', (req, res, next) => {
  submitPowerAppHandler(req, res, next).catch(next);
});

powerAppsRouter.get('/rues/health', (req, res, next) => {
  ruesHealthHandler(req, res, next).catch(next);
});

powerAppsRouter.post('/rues/consultar', (req, res, next) => {
  consultarRuesHandler(req, res, next).catch(next);
});
