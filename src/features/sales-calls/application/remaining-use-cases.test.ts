import { describe, expect, it, vi } from 'vitest';
import { GetCallBatchUseCase } from './GetCallBatchUseCase.js';
import { GetCallRecordingUseCase } from './GetCallRecordingUseCase.js';
import { InitiateCallUseCase } from './InitiateCallUseCase.js';
import {
  ListBatchItemsUseCase,
  ListCallBatchesUseCase,
} from './ListCallBatchesUseCase.js';
import { InMemoryCallRepository } from '../infrastructure/InMemoryCallRepository.js';

describe('sales-calls remaining use cases', () => {
  it('GetCallBatchUseCase calcula progreso', async () => {
    const repo = {
      findBatchById: vi.fn().mockResolvedValue({ id: 'b1', name: 'Camp' }),
      countByStatus: vi.fn().mockResolvedValue({
        total: 4,
        completed: 2,
        failed: 1,
        skipped: 0,
        queued: 1,
        dialing: 0,
      }),
    };
    const result = await new GetCallBatchUseCase(repo as never).execute('b1');
    expect(result?.progress).toBe(0.75);
  });

  it('GetCallBatchUseCase retorna null si no existe batch', async () => {
    const repo = { findBatchById: vi.fn().mockResolvedValue(null) };
    expect(await new GetCallBatchUseCase(repo as never).execute('missing')).toBeNull();
  });

  it('GetCallRecordingUseCase obtiene grabación del gateway', async () => {
    const repo = new InMemoryCallRepository();
    await repo.save({
      id: 'c1',
      agentId: 'agent-a',
      phoneNumber: '+573001234567',
      variables: {},
      status: 'completed',
      recordingUrl: 'https://rec.test/a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const gateways = {
      gatewaysFor: vi.fn().mockReturnValue([
        {
          fetchRecording: vi.fn().mockResolvedValue({ contentType: 'audio/mpeg', data: Buffer.from('x') }),
        },
      ]),
    };
    const recording = await new GetCallRecordingUseCase(repo, gateways).execute('c1');
    expect(recording?.contentType).toBe('audio/mpeg');
  });

  it('GetCallRecordingUseCase retorna null sin grabación', async () => {
    const repo = new InMemoryCallRepository();
    await repo.save({
      id: 'c1',
      agentId: 'agent-a',
      phoneNumber: '+573001234567',
      variables: {},
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(await new GetCallRecordingUseCase(repo, { gatewaysFor: () => [] }).execute('c1')).toBeNull();
  });

  it('ListCallBatchesUseCase y ListBatchItemsUseCase listan datos', async () => {
    const batches = [{ id: 'b1' }];
    const items = [{ id: 'i1' }];
    const repo = {
      listBatches: vi.fn().mockResolvedValue(batches),
      listItems: vi.fn().mockResolvedValue(items),
    };
    expect(await new ListCallBatchesUseCase(repo as never).execute()).toEqual(batches);
    expect(await new ListBatchItemsUseCase(repo as never).execute('b1')).toEqual(items);
  });

  it('InitiateCallUseCase inicia llamada vía gateway', async () => {
    const repo = new InMemoryCallRepository();
    const gateway = {
      initiateCall: vi.fn().mockResolvedValue({ sessionId: 's1', raw: {} }),
      fetchRecording: vi.fn(),
    };
    const useCase = new InitiateCallUseCase(gateway as never, repo, 'agent-1');
    const call = await useCase.execute({
      phoneNumber: '+573001234567',
      customerName: 'Ana',
      variables: { empresa: 'ACME' },
    });
    expect(call.status).toBe('queued');
    expect(gateway.initiateCall).toHaveBeenCalled();
  });
});
