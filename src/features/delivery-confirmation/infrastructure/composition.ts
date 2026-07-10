import { env } from '../../../infrastructure/config/env.js';
import { getSupabaseClient } from '../../../infrastructure/database/supabase.js';
import { SupabasePipelineStageAdvancer } from '../../../core/pipeline/application/advance-stage.js';
import type { DeliveryConfirmationRepository, ManagerDirectory } from '../domain/repository.js';
import type { DeliveryEmailSender } from '../domain/email-sender.js';
import type { ConfirmationTokenService } from '../domain/token-service.js';
import type { PipelineStageAdvancer } from '../../../shared/contracts/pipeline.js';
import type { ShipmentScheduler } from '../../../shared/contracts/shipment-scheduler.js';
import {
  SupabaseDeliveryConfirmationRepository,
  ClientesFinalesManagerDirectory,
} from './supabase-repository.js';
import { HmacConfirmationTokenService } from './token-service.js';
import { ResendDeliveryEmailSender } from './resend-email-sender.js';
import { DemoShipmentScheduler } from './demo-shipment-scheduler.js';

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
    // DEMO: destinatario tomado de clientes_finales.correo en vez de
    // company_managers. Volver a SupabaseManagerDirectory para producción.
    managers: new ClientesFinalesManagerDirectory(db),
    emailSender: new ResendDeliveryEmailSender(env.resend.apiKey, env.resend.fromEmail),
    tokens: new HmacConfirmationTokenService(env.deliveryConfirmation.tokenSecret),
    pipeline: new SupabasePipelineStageAdvancer(db),
    dayMs: env.deliveryConfirmation.dayMs,
    frontendConfirmationUrl: env.deliveryConfirmation.frontendConfirmationUrl,
  };

  return deps;
}

/**
 * Scheduler para que power-apps agende el correo al aprobar (demo). Solo
 * necesita Supabase + dayMs; no exige Resend/token, que recién hacen falta
 * cuando el cron efectivamente envía.
 */
export function getShipmentScheduler(): ShipmentScheduler {
  const db = getSupabaseClient();
  return new DemoShipmentScheduler(
    new SupabaseDeliveryConfirmationRepository(db),
    env.deliveryConfirmation.dayMs,
  );
}
