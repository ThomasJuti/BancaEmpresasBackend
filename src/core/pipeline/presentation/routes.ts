import { Router } from 'express';

/**
 * Orquestación del pipeline HITL:
 * file-matching → sales-calls → power-apps → delivery-confirmation → activation-follow-up
 */
export const pipelineRouter = Router();

pipelineRouter.get('/health', (_req, res) => {
  res.json({
    feature: 'pipeline',
    status: 'scaffold',
    flow: [
      'file-matching',
      'sales-calls',
      'power-apps',
      'delivery-confirmation',
      'activation-follow-up',
    ],
  });
});
