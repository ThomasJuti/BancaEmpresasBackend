import type { Call } from './Call.js';

export interface CallRepository {
  save(call: Call): Promise<void>;
  findAll(): Promise<Call[]>;
  findById(id: string): Promise<Call | null>;
  findBySessionId(sessionId: string): Promise<Call | null>;
  findByFonemaCallId(fonemaCallId: string): Promise<Call | null>;
  /** Última llamada a un número (correlación de end-of-session, que no trae session.id). */
  findLatestByPhoneNumber(phoneNumber: string): Promise<Call | null>;
}
