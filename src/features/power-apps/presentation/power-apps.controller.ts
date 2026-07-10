import type { NextFunction, Request, Response } from 'express';
import type { ZodError } from 'zod';
import { SupabasePipelineStageAdvancer } from '../../../core/pipeline/application/advance-stage.js';
import { SupabasePipelineCaseRepository } from '../../../core/pipeline/infrastructure/supabase-pipeline-case.repository.js';
import { getSupabaseClient } from '../../../infrastructure/database/supabase.js';
import { submitPowerAppOrchestrator } from '../application/submit-power-app.orchestrator.js';
import { submitPowerAppSchema } from '../application/dtos/submit-power-app.dto.js';
import type { ValidationIssue } from '../domain/validation-issue.js';
import { SupabasePowerAppSubmissionRepository } from '../infrastructure/supabase-power-app-submission.repository.js';
import type { ShipmentScheduler } from '../../../shared/contracts/shipment-scheduler.js';

function mapZodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code: 'REQUIRED_FIELD' as const,
    field: issue.path.join('.'),
    message: issue.message,
    severity: 'error' as const,
  }));
}

/**
 * Factory del handler de submit. Recibe el ShipmentScheduler inyectado desde
 * el composition root (src/routes.ts) para no acoplar power-apps a internals
 * de delivery-confirmation; las deps de core/pipeline sí se arman inline.
 */
export function createSubmitPowerAppHandler(shipmentScheduler: ShipmentScheduler) {
  return async function submitPowerAppHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const parsed = submitPowerAppSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          decision: 'RECHAZADO',
          valid: false,
          radicado: null,
          issues: mapZodIssues(parsed.error),
          summary: 'La solicitud no cumple el formato esperado de la Power App.',
          siguientePaso: 'Revise los campos obligatorios y el formato de la solicitud.',
        });
        return;
      }

      const supabase = getSupabaseClient();
      const result = await submitPowerAppOrchestrator(parsed.data, {
        cases: new SupabasePipelineCaseRepository(supabase),
        submissions: new SupabasePowerAppSubmissionRepository(supabase),
        pipeline: new SupabasePipelineStageAdvancer(supabase),
        shipmentScheduler,
      });
      const statusCode = result.valid ? 201 : 422;

      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  };
}

export async function getPowerAppSubmissionByLeadHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const leadId = String(req.params.leadId ?? '').trim();
    if (!leadId) {
      res.status(400).json({ message: 'leadId es obligatorio' });
      return;
    }

    const supabase = getSupabaseClient();
    const submissions = new SupabasePowerAppSubmissionRepository(supabase);
    const submission = await submissions.findLatestByLeadId(leadId);

    res.json({ submission });
  } catch (error) {
    next(error);
  }
}
