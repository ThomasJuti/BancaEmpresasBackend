import { normalizeLeadId } from '../../../core/pipeline/domain/normalize-lead-id.js';
import type { DeliveryConfirmationRepository } from '../domain/repository.js';
import type { DeliveryConfirmationCase } from '../domain/types.js';
import { ValidationError } from '../../../shared/exceptions/app-error.js';

export interface RegisterShipmentInput {
  caseId: string;
  cardId: string;
  companyId: string;
  cardHolderName: string;
  cardLastFour: string;
  /** Si no viene, se asume que el envío físico ocurre ahora. */
  physicalShippedAt?: string;
}

export interface RegisterShipmentDeps {
  repository: DeliveryConfirmationRepository;
  /** Milisegundos que representan 1 día emulado. */
  dayMs: number;
}

/**
 * Registra el envío físico de una tarjeta y agenda el correo al gerente
 * para dentro de 3–4 días (emulados con tiempo comprimido).
 */
export async function registerShipment(
  input: RegisterShipmentInput,
  deps: RegisterShipmentDeps,
): Promise<DeliveryConfirmationCase> {
  const shippedAt = input.physicalShippedAt ? new Date(input.physicalShippedAt) : new Date();

  if (Number.isNaN(shippedAt.getTime())) {
    throw new ValidationError('physicalShippedAt is not a valid date');
  }

  // Delay aleatorio entre 3 y 4 días emulados.
  const delayDays = 3 + Math.random();
  const emailScheduledAt = new Date(shippedAt.getTime() + delayDays * deps.dayMs);

  return deps.repository.create({
    caseId: input.caseId,
    cardId: input.cardId,
    companyId: normalizeLeadId(input.companyId),
    cardHolderName: input.cardHolderName,
    cardLastFour: input.cardLastFour,
    physicalShippedAt: shippedAt.toISOString(),
    emailScheduledAt: emailScheduledAt.toISOString(),
  });
}
