import { Router } from 'express';
import { submitPowerAppHandler } from './power-apps.controller.js';

/**
 * Simulador de Power App: comprobación de campos y decisión operativa.
 */
export const powerAppsRouter = Router();

powerAppsRouter.post('/submit', submitPowerAppHandler);
