import { randomUUID } from 'node:crypto';
import type {
  ScheduleShipmentInput,
  ShipmentScheduler,
} from '../../../shared/contracts/shipment-scheduler.js';
import { processDueEmails, type ProcessDueEmailsDeps } from '../application/process-due-emails.js';

/**
 * Adaptador de demo: al aprobar la Power App la tarjeta física todavía no
 * existe (no hay número ni GOPTC del plástico), así que fabricamos un cardId y
 * los últimos 4 dígitos para poder agendar el correo de confirmación
 * end-to-end. En producción estos datos vendrían de operaciones al registrar
 * el envío físico real vía POST /shipments.
 *
 * A diferencia del flujo real (correo a t0 + 3–4 días, recogido por el cron
 * diario de Vercel), acá el caso nace ya vencido (emailScheduledAt = ahora) y
 * este mismo request dispara el envío directamente — el cron diario (Hobby)
 * no alcanza para una demo interactiva.
 *
 * Las deps (Resend, token secret) se resuelven recién dentro de
 * scheduleShipment (no en el constructor): si se resolvieran al montar rutas
 * (arranque de la app) y faltara alguna, tumbaría toda la app, no solo este
 * feature. Igual que el patrón perezoso de sales-calls/delivery-confirmation.
 */
export class DemoShipmentScheduler implements ShipmentScheduler {
  constructor(private readonly resolveDeps: () => ProcessDueEmailsDeps) {}

  async scheduleShipment(input: ScheduleShipmentInput): Promise<void> {
    const deps = this.resolveDeps();

    // Idempotencia: card_id es unique pero case_id no, y fabricamos un cardId
    // nuevo por llamada. Sin este guard, reenviar el mismo caso duplicaría el
    // envío (y el correo). Si ya hay un envío para el caso, no reprogramamos.
    const existing = await deps.repository.findByCaseId(input.caseId);
    if (existing) return;

    const now = new Date().toISOString();
    await deps.repository.create({
      caseId: input.caseId,
      cardId: randomUUID(),
      companyId: input.companyId,
      cardHolderName: input.cardHolderName,
      cardLastFour: String(Math.floor(1000 + Math.random() * 9000)),
      physicalShippedAt: now,
      emailScheduledAt: now,
    });

    await processDueEmails(deps);
  }
}
