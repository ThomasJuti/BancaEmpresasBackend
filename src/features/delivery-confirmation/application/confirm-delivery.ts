import type { DeliveryConfirmationRepository } from '../domain/repository.js';
import type { ConfirmationTokenService } from '../domain/token-service.js';
import type { DeliveryConfirmationOutcome } from '../domain/types.js';
import { RETRY_OUTCOMES } from '../domain/types.js';
import type { PipelineStageAdvancer } from '../../../shared/contracts/pipeline.js';
import { AppError, NotFoundError, ValidationError } from '../../../shared/exceptions/app-error.js';

export interface ConfirmDeliveryInput {
  token: string;
  outcome: DeliveryConfirmationOutcome;
}

export interface ConfirmDeliveryDeps {
  repository: DeliveryConfirmationRepository;
  tokens: ConfirmationTokenService;
  pipeline: PipelineStageAdvancer;
  /** Milisegundos que representan 1 día emulado (para el reintento). */
  dayMs: number;
}

export interface ConfirmDeliveryResult {
  status: 'confirmed' | 'retry_scheduled';
  nextEmailAt?: string;
}

/**
 * Procesa la respuesta del gerente:
 * - delivered_to_holder → caso confirmado y pipeline avanza a activation_follow_up.
 * - cualquier otro outcome → se reprograma el correo a +1 día emulado.
 */
export async function confirmDelivery(
  input: ConfirmDeliveryInput,
  deps: ConfirmDeliveryDeps,
): Promise<ConfirmDeliveryResult> {
  const payload = deps.tokens.verify(input.token);
  if (!payload) {
    throw new AppError('Invalid or expired confirmation token', 401, 'INVALID_TOKEN');
  }

  const tokenHash = deps.tokens.hash(input.token);
  const attempt = await deps.repository.findEmailAttemptByTokenHash(tokenHash);
  if (!attempt || attempt.deliveryCaseId !== payload.deliveryCaseId) {
    throw new AppError('Invalid or expired confirmation token', 401, 'INVALID_TOKEN');
  }
  if (attempt.status === 'used') {
    throw new AppError('This confirmation link was already used', 409, 'TOKEN_ALREADY_USED');
  }

  const deliveryCase = await deps.repository.findById(payload.deliveryCaseId);
  if (!deliveryCase) {
    throw new NotFoundError('Delivery confirmation case not found');
  }
  if (deliveryCase.status === 'confirmed') {
    throw new ValidationError('This delivery was already confirmed');
  }
  if (deliveryCase.status !== 'awaiting_confirmation') {
    throw new ValidationError('This case is not awaiting confirmation');
  }

  await deps.repository.markTokenUsed(tokenHash);

  if (RETRY_OUTCOMES.includes(input.outcome)) {
    const nextEmailAt = new Date(Date.now() + deps.dayMs);
    await deps.repository.scheduleRetry(deliveryCase.id, input.outcome, nextEmailAt);
    return { status: 'retry_scheduled', nextEmailAt: nextEmailAt.toISOString() };
  }

  await deps.repository.confirm(deliveryCase.id, input.outcome, new Date());
  await deps.pipeline.advance(deliveryCase.caseId, 'activation_follow_up');

  return { status: 'confirmed' };
}
