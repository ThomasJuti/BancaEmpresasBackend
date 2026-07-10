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
import { NodemailerGmailEmailSender } from './nodemailer-gmail-email-sender.js';
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
    // DEMO: envío por SMTP de Gmail (App Password) para poder mandar a los
    // socios sin verificar dominio. Volver a ResendDeliveryEmailSender para prod.
    emailSender: new NodemailerGmailEmailSender(env.gmail.user, env.gmail.appPassword),
    tokens: new HmacConfirmationTokenService(env.deliveryConfirmation.tokenSecret),
    pipeline: new SupabasePipelineStageAdvancer(db),
    dayMs: env.deliveryConfirmation.dayMs,
    frontendConfirmationUrl: env.deliveryConfirmation.frontendConfirmationUrl,
  };

  return deps;
}

/**
 * Scheduler para que power-apps agende y dispare el correo al aprobar (demo).
 * Se le pasa la función `getDeliveryConfirmationDeps` (no su resultado): las
 * deps completas (Resend, token secret) recién se resuelven dentro del
 * submit, no al montar rutas — si faltara alguna, solo falla ese submit
 * (best-effort, capturado por el orchestrator), no el arranque de toda la app.
 */
export function getShipmentScheduler(): ShipmentScheduler {
  return new DemoShipmentScheduler(getDeliveryConfirmationDeps);
}
