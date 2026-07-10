import type { PipelineStageAdvancer } from '../../../shared/contracts/pipeline.js';
import { normalizeLeadId } from '../../../core/pipeline/domain/normalize-lead-id.js';
import type { PipelineCaseRepository } from '../../../core/pipeline/domain/pipeline-case.repository.js';
import type { SubmitPowerAppDto } from './dtos/submit-power-app.dto.js';
import { submitPowerAppUseCase, type SubmitPowerAppResult } from './submit-power-app.use-case.js';

export async function submitPowerAppOrchestrator(
  dto: SubmitPowerAppDto,
  deps: {
    cases: PipelineCaseRepository;
    pipeline: PipelineStageAdvancer;
  },
): Promise<SubmitPowerAppResult> {
  const leadId = normalizeLeadId((dto.leadId ?? dto.identificacionEmpresa).trim());
  const pipelineCase = await deps.cases.ensureByLeadId(leadId);
  const result = submitPowerAppUseCase(dto);

  if (result.valid) {
    await deps.pipeline.advance(pipelineCase.id, 'delivery_confirmation');
    return { ...result, caseId: pipelineCase.id };
  }

  return { ...result, caseId: pipelineCase.id };
}
