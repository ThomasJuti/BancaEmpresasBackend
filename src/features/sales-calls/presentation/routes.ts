import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyCronSecret } from '../../../shared/middlewares/verify-cron-secret.js';
import { getSalesCallsDeps } from '../infrastructure/composition.js';
import { BatchController } from './batch.controller.js';
import { CallController } from './call.controller.js';

/** Llamadas agénticas de venta vía Fonema.ia + campañas (batch calling). */
export const salesCallsRouter = Router();

interface Controllers {
  call: CallController;
  batch: BatchController;
}

// Composición perezosa: no se resuelven las deps (Supabase/Fonema) al importar el
// módulo, para que el arranque no falle si el feature no está configurado (patrón
// de delivery-confirmation). El primer request que las necesite las construye.
let controllers: Controllers | null = null;

function getControllers(): Controllers {
  if (controllers) return controllers;
  const deps = getSalesCallsDeps();
  controllers = {
    call: new CallController(
      deps.initiateCall,
      deps.getCall,
      deps.listCalls,
      deps.registerManualCall,
      deps.getRecording,
      deps.handleWebhook,
    ),
    batch: new BatchController(deps),
  };
  return controllers;
}

/** Envuelve un handler para resolver las deps de forma perezosa por request. */
function route(
  pick: (c: Controllers) => (req: Request, res: Response, next: NextFunction) => unknown,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let handler: (req: Request, res: Response, next: NextFunction) => unknown;
    try {
      handler = pick(getControllers());
    } catch (error) {
      next(error);
      return;
    }
    void handler(req, res, next);
  };
}

salesCallsRouter.get('/health', (_req, res) => {
  res.json({ feature: 'sales-calls', status: 'ok', provider: 'fonema.ia' });
});

// Llamadas individuales
salesCallsRouter.post('/calls', route((c) => c.call.initiate));
salesCallsRouter.post('/calls/manual', route((c) => c.call.registerManual));
salesCallsRouter.get('/calls', route((c) => c.call.list));
salesCallsRouter.get('/calls/:id', route((c) => c.call.get));
salesCallsRouter.get('/calls/:id/recording', route((c) => c.call.recording));
salesCallsRouter.get('/calls/:id/handoff', route((c) => c.batch.handoff));

// Campañas (batch calling)
salesCallsRouter.post('/batches', route((c) => c.batch.create));
salesCallsRouter.get('/batches', route((c) => c.batch.list));
salesCallsRouter.get('/batches/:id', route((c) => c.batch.get));
salesCallsRouter.get('/batches/:id/items', route((c) => c.batch.items));
salesCallsRouter.post('/batches/:id/:action', route((c) => c.batch.setStatus));

// Dispatcher progressive (Vercel Cron cada minuto; también invocable con GET para pruebas)
salesCallsRouter.post('/cron/dispatch', verifyCronSecret, route((c) => c.batch.dispatch));
salesCallsRouter.get('/cron/dispatch', verifyCronSecret, route((c) => c.batch.dispatch));

// Webhooks de Fonema
salesCallsRouter.post('/webhooks/fonema/call-update', route((c) => c.call.callUpdateWebhook));
salesCallsRouter.post('/webhooks/fonema/end-of-call', route((c) => c.call.endOfCallWebhook));
salesCallsRouter.post('/webhooks/fonema/end-of-session', route((c) => c.call.endOfSessionWebhook));
