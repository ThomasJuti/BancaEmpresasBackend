import type { Call } from '../domain/Call.js';
import type { CallRepository } from '../domain/CallRepository.js';

export class ListCallsUseCase {
  constructor(private readonly callRepository: CallRepository) {}

  async execute(): Promise<Call[]> {
    return this.callRepository.findAll();
  }
}
