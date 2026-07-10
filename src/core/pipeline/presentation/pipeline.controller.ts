import type { Request, Response } from 'express';
import type { PipelineCaseRepository } from '../domain/pipeline-case.repository.js';

export class PipelineController {
  constructor(private readonly cases: PipelineCaseRepository) {}

  async getCaseByLead(req: Request, res: Response): Promise<void> {
    const leadId = String(req.params.leadId ?? '').trim();
    if (!leadId) {
      res.status(400).json({ error: 'leadId requerido' });
      return;
    }

    const ensure = req.query.ensure === 'true';
    const pipelineCase = ensure
      ? await this.cases.ensureByLeadId(leadId)
      : await this.cases.findByLeadId(leadId);

    if (!pipelineCase) {
      res.status(404).json({ error: 'Caso de pipeline no encontrado' });
      return;
    }

    res.json({ case: pipelineCase });
  }
}
