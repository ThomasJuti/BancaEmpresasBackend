import type { Call } from '../domain/Call.js';
import type { CallRepository } from '../domain/CallRepository.js';

export class GetCallUseCase {
  constructor(private readonly callRepository: CallRepository) {}

  async execute(id: string): Promise<Call | null> {
    return this.callRepository.findById(id);
  }
}
