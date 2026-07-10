import { SupabasePipelineStageAdvancer } from '../../../core/pipeline/application/advance-stage.js';
import { SupabasePipelineCaseRepository } from '../../../core/pipeline/infrastructure/supabase-pipeline-case.repository.js';
import { env } from '../../../infrastructure/config/env.js';
import { getSupabaseClient } from '../../../infrastructure/database/supabase.js';
import type { FollowUpCallService } from '../../../shared/contracts/follow-up-call.js';
import { FinalizeDeliveryUseCase } from '../application/finalize-delivery.use-case.js';
import { ListFollowUpCasesUseCase } from '../application/list-follow-up-cases.use-case.js';
import { ProcessUsageRemindersUseCase } from '../application/process-usage-reminders.use-case.js';
import { RegisterUsageUseCase } from '../application/register-usage.use-case.js';
import { SupabaseFollowUpCaseRepository } from './supabase-follow-up-case.repository.js';

export interface ActivationFollowUpDeps {
  finalizeDelivery: FinalizeDeliveryUseCase;
  registerUsage: RegisterUsageUseCase;
  processReminders: ProcessUsageRemindersUseCase;
  listCases: ListFollowUpCasesUseCase;
}

let deps: ActivationFollowUpDeps | null = null;

/**
 * Construye (una sola vez) las dependencias del feature. El FollowUpCallService
 * llega del composition root (src/routes.ts) — lo implementa sales-calls.
 * Reusa la compresión de tiempo global (TIME_COMPRESSION_DAY_MS) para emular días.
 */
export function getActivationFollowUpDeps(
  followUpCalls: FollowUpCallService,
): ActivationFollowUpDeps {
  if (deps) return deps;

  const db = getSupabaseClient();
  const repository = new SupabaseFollowUpCaseRepository(db);
  const dayMs = env.deliveryConfirmation.dayMs;

  deps = {
    finalizeDelivery: new FinalizeDeliveryUseCase(
      repository,
      followUpCalls,
      new SupabasePipelineCaseRepository(db),
      new SupabasePipelineStageAdvancer(db),
      dayMs,
    ),
    registerUsage: new RegisterUsageUseCase(repository, dayMs),
    processReminders: new ProcessUsageRemindersUseCase(repository, followUpCalls, dayMs),
    listCases: new ListFollowUpCasesUseCase(repository, dayMs),
  };

  return deps;
}
