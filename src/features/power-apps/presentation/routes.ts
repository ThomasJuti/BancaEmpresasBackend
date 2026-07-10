import { Router } from 'express';
import { createSubmitPowerAppHandler, getPowerAppSubmissionByLeadHandler } from './power-apps.controller.js';
import { consultarRuesHandler, ruesHealthHandler } from './rues.controller.js';
import type { ShipmentScheduler } from '../../../shared/contracts/shipment-scheduler.js';

/**
 * Simulador de Power App: comprobación de campos y decisión operativa.
 * Recibe el ShipmentScheduler para agendar el correo al aprobar (demo).
 */
export function createPowerAppsRouter(shipmentScheduler: ShipmentScheduler): Router {
  const router = Router();
  const submitPowerAppHandler = createSubmitPowerAppHandler(shipmentScheduler);

  router.post('/submit', (req, res, next) => {
    submitPowerAppHandler(req, res, next).catch(next);
  });

  router.get('/submissions/by-lead/:leadId', (req, res, next) => {
    getPowerAppSubmissionByLeadHandler(req, res, next).catch(next);
  });

  router.get('/rues/health', (req, res, next) => {
    ruesHealthHandler(req, res, next).catch(next);
  });

  router.post('/rues/consultar', (req, res, next) => {
    consultarRuesHandler(req, res, next).catch(next);
  });

  return router;
}
