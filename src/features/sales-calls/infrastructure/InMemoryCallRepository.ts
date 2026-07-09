import type { Call } from '../domain/Call.js';
import type { CallRepository } from '../domain/CallRepository.js';

export class InMemoryCallRepository implements CallRepository {
  private readonly calls = new Map<string, Call>();

  async save(call: Call): Promise<void> {
    this.calls.set(call.id, call);
  }

  async findAll(): Promise<Call[]> {
    return [...this.calls.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<Call | null> {
    return this.calls.get(id) ?? null;
  }

  async findBySessionId(sessionId: string): Promise<Call | null> {
    for (const call of this.calls.values()) {
      if (call.sessionId === sessionId) {
        return call;
      }
    }
    return null;
  }

  async findByFonemaCallId(fonemaCallId: string): Promise<Call | null> {
    for (const call of this.calls.values()) {
      if (call.fonemaCallId === fonemaCallId) {
        return call;
      }
    }
    return null;
  }
}
