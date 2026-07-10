import { randomUUID } from 'node:crypto';
import type {
  ScheduleShipmentInput,
  ShipmentScheduler,
} from '../../../shared/contracts/shipment-scheduler.js';
import { registerShipment } from '../application/register-shipment.js';
import type { DeliveryConfirmationRepository } from '../domain/repository.js';

/**
 * Adaptador de demo: al aprobar la Power App la tarjeta física todavía no
 * existe (no hay número ni GOPTC del plástico), así que fabricamos un cardId y
 * los últimos 4 dígitos para poder agendar el correo de confirmación
 * end-to-end. En producción estos datos vendrían de operaciones al registrar
 * el envío físico real vía POST /shipments.
 */
export class DemoShipmentScheduler implements ShipmentScheduler {
  constructor(
    private readonly repository: DeliveryConfirmationRepository,
    private readonly dayMs: number,
  ) {}

  async scheduleShipment(input: ScheduleShipmentInput): Promise<void> {
    // Idempotencia: card_id es unique pero case_id no, y fabricamos un cardId
    // nuevo por llamada. Sin este guard, reenviar el mismo caso duplicaría el
    // envío (y el correo). Si ya hay un envío para el caso, no reprogramamos.
    const existing = await this.repository.findByCaseId(input.caseId);
    if (existing) return;

    await registerShipment(
      {
        caseId: input.caseId,
        cardId: randomUUID(),
        companyId: input.companyId,
        cardHolderName: input.cardHolderName,
        cardLastFour: String(Math.floor(1000 + Math.random() * 9000)),
      },
      { repository: this.repository, dayMs: this.dayMs },
    );
  }
}
