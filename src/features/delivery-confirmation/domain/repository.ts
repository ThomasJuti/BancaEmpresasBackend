import type {
  CompanyManager,
  DeliveryConfirmationCase,
  DeliveryConfirmationOutcome,
  DeliveryEmailAttempt,
  NewDeliveryConfirmationCase,
} from './types.js';

export interface DeliveryConfirmationRepository {
  create(data: NewDeliveryConfirmationCase): Promise<DeliveryConfirmationCase>;
  findById(id: string): Promise<DeliveryConfirmationCase | null>;
  findByCaseId(caseId: string): Promise<DeliveryConfirmationCase | null>;
  /** Casos scheduled/retry_scheduled cuyo email_scheduled_at ya venció. */
  findDue(now: Date): Promise<DeliveryConfirmationCase[]>;
  markSent(id: string, sentAt: Date): Promise<void>;
  confirm(id: string, outcome: DeliveryConfirmationOutcome, confirmedAt: Date): Promise<void>;
  scheduleRetry(
    id: string,
    outcome: DeliveryConfirmationOutcome,
    nextEmailAt: Date,
  ): Promise<void>;
  recordEmailAttempt(attempt: DeliveryEmailAttempt): Promise<void>;
  /** Busca el intento de correo por hash de token (para validar y marcar uso único). */
  findEmailAttemptByTokenHash(
    tokenHash: string,
  ): Promise<{ deliveryCaseId: string; managerEmail: string; status: string } | null>;
  markTokenUsed(tokenHash: string): Promise<void>;
}

export interface ManagerDirectory {
  findByCompanyId(companyId: string): Promise<CompanyManager[]>;
}
