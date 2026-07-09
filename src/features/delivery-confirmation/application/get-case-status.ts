import type { DeliveryConfirmationRepository } from '../domain/repository.js';
import type { ConfirmationTokenService } from '../domain/token-service.js';
import type { DeliveryConfirmationOutcome, DeliveryEmailStatus } from '../domain/types.js';
import { AppError, NotFoundError } from '../../../shared/exceptions/app-error.js';

export interface CaseStatusView {
  caseId: string;
  status: DeliveryEmailStatus;
  outcome?: DeliveryConfirmationOutcome;
  emailScheduledAt: string;
  sentAt?: string;
  confirmedAt?: string;
  attemptCount: number;
}

/** Estado del caso por caseId del pipeline (para UI/ops, sin PII). */
export async function getCaseStatus(
  caseId: string,
  repository: DeliveryConfirmationRepository,
): Promise<CaseStatusView> {
  const deliveryCase = await repository.findByCaseId(caseId);
  if (!deliveryCase) {
    throw new NotFoundError('Delivery confirmation case not found');
  }

  return {
    caseId: deliveryCase.caseId,
    status: deliveryCase.status,
    outcome: deliveryCase.outcome,
    emailScheduledAt: deliveryCase.emailScheduledAt,
    sentAt: deliveryCase.sentAt,
    confirmedAt: deliveryCase.confirmedAt,
    attemptCount: deliveryCase.attemptCount,
  };
}

export interface ConfirmationView {
  cardHolderName: string;
  cardLastFour: string;
  companyId: string;
  status: DeliveryEmailStatus;
}

/**
 * Datos mínimos para renderizar la página de confirmación del frontend
 * a partir de un token firmado.
 */
export async function getConfirmationView(
  token: string,
  deps: { repository: DeliveryConfirmationRepository; tokens: ConfirmationTokenService },
): Promise<ConfirmationView> {
  const payload = deps.tokens.verify(token);
  if (!payload) {
    throw new AppError('Invalid or expired confirmation token', 401, 'INVALID_TOKEN');
  }

  const deliveryCase = await deps.repository.findById(payload.deliveryCaseId);
  if (!deliveryCase) {
    throw new NotFoundError('Delivery confirmation case not found');
  }

  return {
    cardHolderName: deliveryCase.cardHolderName,
    cardLastFour: deliveryCase.cardLastFour,
    companyId: deliveryCase.companyId,
    status: deliveryCase.status,
  };
}
