import type { Call } from './Call.js';

export interface CallRepository {
  save(call: Call): Promise<void>;
  findAll(): Promise<Call[]>;
  findById(id: string): Promise<Call | null>;
  findBySessionId(sessionId: string): Promise<Call | null>;
  findByFonemaCallId(fonemaCallId: string): Promise<Call | null>;
}
