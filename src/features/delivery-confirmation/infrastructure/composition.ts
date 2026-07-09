import { env } from '../../../infrastructure/config/env.js';
import { getSupabaseClient } from '../../../infrastructure/database/supabase.js';
import { SupabasePipelineStageAdvancer } from '../../../core/pipeline/application/advance-stage.js';
import type { DeliveryConfirmationRepository, ManagerDirectory } from '../domain/repository.js';
import type { DeliveryEmailSender } from '../domain/email-sender.js';
import type { ConfirmationTokenService } from '../domain/token-service.js';
import type { PipelineStageAdvancer } from '../../../shared/contracts/pipeline.js';
import {
  SupabaseDeliveryConfirmationRepository,
  SupabaseManagerDirectory,
} from './supabase-repository.js';
import { HmacConfirmationTokenService } from './token-service.js';
import { ResendDeliveryEmailSender } from './resend-email-sender.js';

export interface DeliveryConfirmationDeps {
  repository: DeliveryConfirmationRepository;
  managers: ManagerDirectory;
  emailSender: DeliveryEmailSender;
  tokens: ConfirmationTokenService;
  pipeline: PipelineStageAdvancer;
  dayMs: number;
  frontendConfirmationUrl: string;
}

let deps: DeliveryConfirmationDeps | null = null;

/**
 * Construye (una sola vez) las dependencias reales del feature.
 * Lanza un error claro si falta configuración (Supabase, Resend, secret).
 */
export function getDeliveryConfirmationDeps(): DeliveryConfirmationDeps {
  if (deps) return deps;

  const db = getSupabaseClient();

  deps = {
    repository: new SupabaseDeliveryConfirmationRepository(db),
    managers: new SupabaseManagerDirectory(db),
    emailSender: new ResendDeliveryEmailSender(env.resend.apiKey, env.resend.fromEmail),
    tokens: new HmacConfirmationTokenService(env.deliveryConfirmation.tokenSecret),
    pipeline: new SupabasePipelineStageAdvancer(db),
    dayMs: env.deliveryConfirmation.dayMs,
    frontendConfirmationUrl: env.deliveryConfirmation.frontendConfirmationUrl,
  };

  return deps;
}
