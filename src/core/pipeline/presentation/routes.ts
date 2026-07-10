import { Router } from 'express';
import { getSupabaseClient } from '../../../infrastructure/database/supabase.js';
import { SupabasePipelineCaseRepository } from '../infrastructure/supabase-pipeline-case.repository.js';
import { PipelineController } from './pipeline.controller.js';

/**
 * Orquestación del pipeline HITL:
 * file-matching → sales-calls → power-apps → delivery-confirmation → activation-follow-up
 */
export const pipelineRouter = Router();

let controller: PipelineController | null = null;

function getController(): PipelineController {
  if (controller) return controller;
  const cases = new SupabasePipelineCaseRepository(getSupabaseClient());
  controller = new PipelineController(cases);
  return controller;
}

pipelineRouter.get('/health', (_req, res) => {
  res.json({
    feature: 'pipeline',
    status: 'ok',
    flow: [
      'file-matching',
      'sales-calls',
      'power-apps',
      'delivery-confirmation',
      'activation-follow-up',
    ],
  });
});

pipelineRouter.get('/cases/by-lead/:leadId', (req, res, next) => {
  getController()
    .getCaseByLead(req, res)
    .catch(next);
});
