import { describe, expect, it, vi } from 'vitest';
import { DispatchCallBatchesUseCase } from './DispatchCallBatchesUseCase.js';
import { InitiateCallUseCase } from './InitiateCallUseCase.js';
import { InMemoryCallRepository } from '../infrastructure/InMemoryCallRepository.js';
import type { CallBatch } from '../domain/CallBatch.js';

const batch: CallBatch = {
  id: 'batch-1',
  name: 'Camp',
  agentId: 'agent',
  status: 'running',
  pacing: { maxConcurrent: 2, perHour: 10, timezone: 'America/Bogota' },
  defaultVariables: { campana: 'test' },
  total: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('DispatchCallBatchesUseCase', () => {
  it('marca batch completado cuando no hay items pendientes', async () => {
    const batchRepository = {
      findRunningBatches: vi.fn().mockResolvedValue([batch]),
      countActive: vi.fn().mockResolvedValue(0),
      countByStatuses: vi.fn().mockResolvedValue(0),
      updateBatchStatus: vi.fn().mockResolvedValue(undefined),
    };
    const initiate = new InitiateCallUseCase(
      { initiateCall: vi.fn() },
      new InMemoryCallRepository(),
      'agent',
    );
    const useCase = new DispatchCallBatchesUseCase(batchRepository, initiate);

    const result = await useCase.execute(new Date('2026-07-12T15:00:00.000Z'));
    expect(result.completedBatches).toBe(1);
    expect(batchRepository.updateBatchStatus).toHaveBeenCalledWith('batch-1', 'completed');
  });

  it('disca items en ventana de contacto', async () => {
    const batchRepository = {
      findRunningBatches: vi.fn().mockResolvedValue([batch]),
      countActive: vi.fn().mockResolvedValue(0),
      countByStatuses: vi.fn().mockResolvedValue(1),
      countStartedSince: vi.fn().mockResolvedValue(0),
      claimQueued: vi.fn().mockResolvedValue([
        {
          id: 'item-1',
          phoneNumber: '+573001234567',
          customerName: 'Juan',
          variables: { nit: '9001234567' },
        },
      ]),
      markItem: vi.fn().mockResolvedValue(undefined),
    };
    const gateway = { initiateCall: vi.fn().mockResolvedValue({ sessionId: 's-1' }) };
    const initiate = new InitiateCallUseCase(gateway, new InMemoryCallRepository(), 'agent');
    const useCase = new DispatchCallBatchesUseCase(batchRepository, initiate);

    const result = await useCase.execute(new Date('2026-07-12T15:00:00.000Z'));
    expect(result.dialed).toBe(1);
    expect(batchRepository.markItem).toHaveBeenCalledWith(
      'item-1',
      'dialing',
      expect.objectContaining({ sessionId: 's-1' }),
    );
  });

  it('marca item failed si falla el discado', async () => {
    const batchRepository = {
      findRunningBatches: vi.fn().mockResolvedValue([batch]),
      countActive: vi.fn().mockResolvedValue(0),
      countByStatuses: vi.fn().mockResolvedValue(1),
      countStartedSince: vi.fn().mockResolvedValue(0),
      claimQueued: vi.fn().mockResolvedValue([{ id: 'item-1', phoneNumber: '+573001234567', variables: {} }]),
      markItem: vi.fn().mockResolvedValue(undefined),
    };
    const initiate = new InitiateCallUseCase(
      { initiateCall: vi.fn().mockRejectedValue(new Error('dial fail')) },
      new InMemoryCallRepository(),
      'agent',
    );
    const useCase = new DispatchCallBatchesUseCase(batchRepository, initiate);
    const result = await useCase.execute(new Date('2026-07-12T15:00:00.000Z'));
    expect(result.dialed).toBe(0);
    expect(batchRepository.markItem).toHaveBeenCalledWith('item-1', 'failed', expect.any(Object));
  });
});
