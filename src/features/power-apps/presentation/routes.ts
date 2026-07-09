import { Router } from 'express';
import { submitPowerAppHandler } from './power-apps.controller.js';

/**
 * Simulador de Power App: comprobación de campos de la solicitud
 * de TC LATAM Business y decisión para el área de operaciones.
 * HITL previo a la etapa de entrega física; el correo al gerente
 * lo orquesta delivery-confirmation (no PowerApps).
 */
export const powerAppsRouter = Router();

powerAppsRouter.post('/submit', submitPowerAppHandler);
