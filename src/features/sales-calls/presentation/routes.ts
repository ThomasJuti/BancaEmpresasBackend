import { Router } from 'express';
import { env } from '../../../infrastructure/config/env.js';
import { GetCallRecordingUseCase } from '../application/GetCallRecordingUseCase.js';
import { GetCallUseCase } from '../application/GetCallUseCase.js';
import { HandleCallWebhookUseCase } from '../application/HandleCallWebhookUseCase.js';
import { InitiateCallUseCase } from '../application/InitiateCallUseCase.js';
import { ListCallsUseCase } from '../application/ListCallsUseCase.js';
import { FonemaHttpGateway } from '../infrastructure/FonemaHttpGateway.js';
import { InMemoryCallRepository } from '../infrastructure/InMemoryCallRepository.js';
import { loadSeed } from '../infrastructure/seed/loadSeed.js';
import { CallController } from './call.controller.js';

/** Llamadas agenticas de venta vía Fonema.ia */
export const salesCallsRouter = Router();

// Composición de dependencias de la feature (composition root local).
const callRepository = new InMemoryCallRepository();
if (process.env.SEED_DEMO === 'true') {
  void loadSeed(callRepository);
}

const fonemaGateway = new FonemaHttpGateway(env.fonema.apiUrl, env.fonema.apiKey);

const controller = new CallController(
  new InitiateCallUseCase(fonemaGateway, callRepository, env.fonema.salesAgentId),
  new GetCallUseCase(callRepository),
  new ListCallsUseCase(callRepository),
  new GetCallRecordingUseCase(callRepository, fonemaGateway),
  new HandleCallWebhookUseCase(callRepository),
);

salesCallsRouter.get('/health', (_req, res) => {
  res.json({ feature: 'sales-calls', status: 'ok', provider: 'fonema.ia' });
});

salesCallsRouter.post('/calls', controller.initiate);
salesCallsRouter.get('/calls', controller.list);
salesCallsRouter.get('/calls/:id', controller.get);
salesCallsRouter.get('/calls/:id/recording', controller.recording);
salesCallsRouter.post('/webhooks/fonema/call-update', controller.callUpdateWebhook);
salesCallsRouter.post('/webhooks/fonema/end-of-call', controller.endOfCallWebhook);
salesCallsRouter.post('/webhooks/fonema/end-of-session', controller.endOfSessionWebhook);
