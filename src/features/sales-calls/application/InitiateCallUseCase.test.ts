import { describe, expect, it, vi } from 'vitest';
import { InitiateCallUseCase } from './InitiateCallUseCase.js';
import { InMemoryCallRepository } from '../infrastructure/InMemoryCallRepository.js';

describe('InitiateCallUseCase', () => {
  it('inicia llamada y persiste registro', async () => {
    const gateway = {
      initiateCall: vi.fn().mockResolvedValue({ sessionId: 'session-1' }),
    };
    const repo = new InMemoryCallRepository();
    const useCase = new InitiateCallUseCase(gateway, repo, 'agent-default');

    const call = await useCase.execute({
      phoneNumber: '+573001234567',
      customerName: 'Juan',
      script: 'Hola',
      variables: { empresa: 'Demo' },
      caseId: 'case-1',
    });

    expect(call.status).toBe('queued');
    expect(call.sessionId).toBe('session-1');
    expect(call.variables.script).toBe('Hola');
    expect(await repo.findById(call.id)).toEqual(call);
  });
});
