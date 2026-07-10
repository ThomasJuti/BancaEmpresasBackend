import type { FollowUpCase } from './entities.js';

export interface CreateFollowUpCaseInput {
  clienteId: string;
  caseId?: string | null;
  clienteNombre?: string | null;
  telefono?: string | null;
  correo?: string | null;
}

export interface FollowUpCaseRepository {
  findAll(): Promise<FollowUpCase[]>;
  findByClienteId(clienteId: string): Promise<FollowUpCase | null>;
  create(input: CreateFollowUpCaseInput): Promise<FollowUpCase>;
  /** Marca la llamada de felicitación (solo primera vez que se finaliza la entrega). */
  setCongratulation(clienteId: string, callId: string | null): Promise<void>;
  /** Registra uso de la tarjeta: reinicia el ciclo de recordatorios. */
  registerUsage(clienteId: string, usedAt: Date): Promise<FollowUpCase | null>;
  /** Registra una llamada de recordatorio enviada. */
  registerReminder(clienteId: string, at: Date): Promise<void>;
}
