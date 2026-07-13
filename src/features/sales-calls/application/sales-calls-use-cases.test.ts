import { describe, expect, it, vi } from 'vitest';
import { CreateCallBatchUseCase } from './CreateCallBatchUseCase.js';
import { GetCallUseCase } from './GetCallUseCase.js';
import { ListCallsUseCase } from './ListCallsUseCase.js';
import { SetBatchStatusUseCase } from './SetBatchStatusUseCase.js';
import { InMemoryCallRepository } from '../infrastructure/InMemoryCallRepository.js';
import { NotFoundError, ValidationError } from '../../../shared/exceptions/app-error.js';

describe('sales-calls simple use cases', () => {
  it('CreateCallBatchUseCase delega al repositorio', async () => {
    const batch = { id: 'b1' };
    const repo = { createBatch: vi.fn().mockResolvedValue(batch) };
    const useCase = new CreateCallBatchUseCase(repo as never, 'default-agent');
    const result = await useCase.execute({
      name: 'Camp',
      leads: [],
      pacing: { maxConcurrent: 1, perHour: 1, timezone: 'America/Bogota' },
    });
    expect(result).toBe(batch);
    expect(repo.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'default-agent' }),
    );
  });

  it('GetCallUseCase y ListCallsUseCase usan repositorio en memoria', async () => {
    const repo = new InMemoryCallRepository();
    await repo.save({
      id: 'c1',
      agentId: 'a',
      phoneNumber: '+573001234567',
      variables: {},
      status: 'queued',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(await new GetCallUseCase(repo).execute('c1')).toBeTruthy();
    expect(await new ListCallsUseCase(repo).execute()).toHaveLength(1);
  });

  it('SetBatchStatusUseCase pausa, reanuda y cancela', async () => {
    const running = {
      id: 'b1',
      status: 'running',
    };
    const paused = { ...running, status: 'paused' };
    const repo = {
      findBatchById: vi
        .fn()
        .mockResolvedValueOnce(running)
        .mockResolvedValueOnce(paused)
        .mockResolvedValueOnce(paused)
        .mockResolvedValueOnce({ id: 'b1', status: 'running' }),
      updateBatchStatus: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new SetBatchStatusUseCase(repo as never);
    await useCase.execute('b1', 'pause');
    await useCase.execute('b1', 'resume');
    expect(repo.updateBatchStatus).toHaveBeenCalledWith('b1', 'running');
  });

  it('SetBatchStatusUseCase valida estados', async () => {
    const repo = {
      findBatchById: vi.fn().mockResolvedValue({ id: 'b1', status: 'completed' }),
    };
    const useCase = new SetBatchStatusUseCase(repo as never);
    await expect(useCase.execute('b1', 'pause')).rejects.toBeInstanceOf(ValidationError);
    repo.findBatchById.mockResolvedValue(null);
    await expect(useCase.execute('missing', 'pause')).rejects.toBeInstanceOf(NotFoundError);
  });
});
