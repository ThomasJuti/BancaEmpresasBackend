import type { PipelineStage } from '../../../shared/contracts/pipeline.js';

export interface PipelineCaseRecord {
  id: string;
  leadId: string;
  stage: PipelineStage;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineCaseRepository {
  findByLeadId(leadId: string): Promise<PipelineCaseRecord | null>;
  ensureByLeadId(leadId: string): Promise<PipelineCaseRecord>;
}
