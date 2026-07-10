import type { PipelineStageAdvancer } from '../../../shared/contracts/pipeline.js';
import type { ShipmentScheduler } from '../../../shared/contracts/shipment-scheduler.js';
import { normalizeLeadId } from '../../../core/pipeline/domain/normalize-lead-id.js';
import type { PipelineCaseRepository } from '../../../core/pipeline/domain/pipeline-case.repository.js';
import type {
  PowerAppSubmissionRepository,
  SavePowerAppSubmissionInput,
} from '../domain/power-app-submission.repository.js';
import { buildSubmissionPayload } from '../domain/power-app-submission.repository.js';
import type { SubmitPowerAppDto } from './dtos/submit-power-app.dto.js';
import { submitPowerAppUseCase, type SubmitPowerAppResult } from './submit-power-app.use-case.js';

export async function submitPowerAppOrchestrator(
  dto: SubmitPowerAppDto,
  deps: {
    cases: PipelineCaseRepository;
    submissions: PowerAppSubmissionRepository;
    pipeline: PipelineStageAdvancer;
    shipmentScheduler: ShipmentScheduler;
  },
): Promise<SubmitPowerAppResult> {
  const leadId = normalizeLeadId((dto.leadId ?? dto.identificacionEmpresa).trim());
  const pipelineCase = await deps.cases.ensureByLeadId(leadId);
  const result = submitPowerAppUseCase(dto);

  if (result.valid) {
    const submissionInput: SavePowerAppSubmissionInput = {
      caseId: pipelineCase.id,
      leadId,
      radicado: result.radicado,
      decision: result.decision,
      valid: result.valid,
      summary: result.summary,
      siguientePaso: result.siguientePaso,
      payload: buildSubmissionPayload(dto),
      issues: result.issues,
      attachmentNames: dto.archivosAdjuntos,
      documentoOrigen: dto.documentoOrigen,
      ruesSolicitudId: dto.ruesSolicitudId,
      submittedAt: result.submittedAt,
    };
    await deps.submissions.save(submissionInput);

    await deps.pipeline.advance(pipelineCase.id, 'delivery_confirmation');

    // Demo: al aprobar, agendamos y disparamos el correo de confirmación de
    // entrega de inmediato (sin esperar al cron diario). Best-effort — un fallo
    // acá no debe invalidar el radicado ya emitido, igual que el auto-avance de sales-calls.
    try {
      await deps.shipmentScheduler.scheduleShipment({
        caseId: pipelineCase.id,
        companyId: leadId,
        cardHolderName: dto.nombreTarjetahabiente,
      });
    } catch (error) {
      console.error(
        `power-apps: no se pudo agendar el envío para el caso ${pipelineCase.id}`,
        error,
      );
    }

    return { ...result, caseId: pipelineCase.id };
  }

  return { ...result, caseId: pipelineCase.id };
}
