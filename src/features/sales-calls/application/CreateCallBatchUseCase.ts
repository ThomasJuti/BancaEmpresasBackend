import type { CallBatch, NewBatchLead, PacingPolicy } from '../domain/CallBatch.js';
import type { CallBatchRepository } from '../domain/CallBatchRepository.js';

export interface CreateCallBatchRequest {
  name: string;
  agentId?: string;
  leads: NewBatchLead[];
  pacing: PacingPolicy;
  defaultVariables?: Record<string, string>;
}

/** Crea una campaña de llamadas y encola sus leads (dedupe por leadId en el repo). */
export class CreateCallBatchUseCase {
  constructor(
    private readonly batchRepository: CallBatchRepository,
    private readonly defaultAgentId: string,
  ) {}

  async execute(request: CreateCallBatchRequest): Promise<CallBatch> {
    return this.batchRepository.createBatch({
      name: request.name,
      agentId: request.agentId || this.defaultAgentId,
      pacing: request.pacing,
      defaultVariables: request.defaultVariables ?? {},
      leads: request.leads,
    });
  }
}
