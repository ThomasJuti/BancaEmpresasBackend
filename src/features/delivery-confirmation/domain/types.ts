/** Resultado de la confirmación del gerente sobre la entrega física. */
export type DeliveryConfirmationOutcome =
  | 'delivered_to_holder'
  | 'not_arrived'
  | 'holder_absent'
  | 'return_to_bank';

/** Outcomes que reprograman un nuevo correo (+1 día). */
export const RETRY_OUTCOMES: readonly DeliveryConfirmationOutcome[] = [
  'not_arrived',
  'holder_absent',
  'return_to_bank',
] as const;

export type DeliveryEmailStatus =
  | 'scheduled'
  | 'sent'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'retry_scheduled'
  | 'failed';

export interface DeliveryConfirmationCase {
  id: string;
  /** Caso del pipeline al que pertenece esta tarjeta. */
  caseId: string;
  cardId: string;
  companyId: string;
  cardHolderName: string;
  cardLastFour: string;
  status: DeliveryEmailStatus;
  outcome?: DeliveryConfirmationOutcome;
  /** Fecha/hora emulada o real del envío físico de la tarjeta. */
  physicalShippedAt: string;
  /** Cuándo debe enviarse (o reenviarse) el correo. */
  emailScheduledAt: string;
  sentAt?: string;
  confirmedAt?: string;
  attemptCount: number;
}

export interface NewDeliveryConfirmationCase {
  caseId: string;
  cardId: string;
  companyId: string;
  cardHolderName: string;
  cardLastFour: string;
  physicalShippedAt: string;
  emailScheduledAt: string;
}

/** Registro de auditoría de un correo enviado a un gerente. */
export interface DeliveryEmailAttempt {
  deliveryCaseId: string;
  managerEmail: string;
  providerMessageId?: string;
  tokenHash: string;
}

export interface CompanyManager {
  name: string;
  email: string;
}
