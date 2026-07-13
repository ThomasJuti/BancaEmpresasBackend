import { describe, expect, it, vi } from 'vitest';
import { HandleCallWebhookUseCase } from './HandleCallWebhookUseCase.js';
import { InMemoryCallRepository } from '../infrastructure/InMemoryCallRepository.js';
import type { Call } from '../domain/Call.js';

async function seedCall(repo: InMemoryCallRepository, overrides: Partial<Call> = {}) {
  const call: Call = {
    id: 'call-1',
    sessionId: 'session-1',
    fonemaCallId: 'fonema-1',
    agentId: 'agent',
    phoneNumber: '+573001234567',
    variables: { nit: '9001234567' },
    status: 'initiated',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  await repo.save(call);
  return call;
}

describe('HandleCallWebhookUseCase', () => {
  it('actualiza estado en call update', async () => {
    const repo = new InMemoryCallRepository();
    await seedCall(repo);
    const useCase = new HandleCallWebhookUseCase(repo);

    await useCase.handleCallUpdate({ call: { id: 'fonema-1' }, status: 'in-progress' });
    const updated = await repo.findByFonemaCallId('fonema-1');
    expect(updated?.status).toBe('in_progress');
  });

  it('ignora update sin call id', async () => {
    const repo = new InMemoryCallRepository();
    const useCase = new HandleCallWebhookUseCase(repo);
    await expect(useCase.handleCallUpdate({})).resolves.toBeUndefined();
  });

  it('completa llamada en end of call y avanza pipeline si califica', async () => {
    const repo = new InMemoryCallRepository();
    await seedCall(repo, { caseId: 'case-1' });
    const pipeline = { advance: vi.fn().mockResolvedValue(undefined) };
    const batchRepository = {
      findItemBySessionId: vi.fn().mockResolvedValue({ id: 'item-1', status: 'dialing' }),
      markItem: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new HandleCallWebhookUseCase(repo, batchRepository, pipeline);

    await useCase.handleEndOfCall({
      id: 'fonema-1',
      session: { id: 'session-1' },
      analysis: {
        successEvaluation: true,
        structuredData: { identidad_verificada: true, cliente_interesado: true },
        summary: 'OK',
      },
    });

    const updated = await repo.findBySessionId('session-1');
    expect(updated?.status).toBe('completed');
    expect(pipeline.advance).toHaveBeenCalledWith('case-1', 'power_apps');
    expect(batchRepository.markItem).toHaveBeenCalled();
  });

  it('actualiza llamada en end of session por teléfono', async () => {
    const repo = new InMemoryCallRepository();
    await seedCall(repo);
    const useCase = new HandleCallWebhookUseCase(repo);

    await useCase.handleEndOfSession({
      customer: { phoneNumber: '+573001234567' },
      totalAttempts: 2,
      analysis: { successEvaluation: false },
    });

    const updated = await repo.findLatestByPhoneNumber('+573001234567');
    expect(updated?.totalAttempts).toBe(2);
  });

  it('marca item del batch en progreso durante call update', async () => {
    const repo = new InMemoryCallRepository();
    await seedCall(repo);
    const batchRepository = {
      findItemBySessionId: vi.fn().mockResolvedValue({ id: 'item-1', status: 'dialing' }),
      markItem: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new HandleCallWebhookUseCase(repo, batchRepository as never);

    await useCase.handleCallUpdate({ call: { id: 'fonema-1' }, status: 'in-progress' });
    expect(batchRepository.markItem).toHaveBeenCalledWith('item-1', 'in_progress', expect.any(Object));
  });

  it('no avanza pipeline si la llamada no califica', async () => {
    const repo = new InMemoryCallRepository();
    await seedCall(repo, { caseId: 'case-1' });
    const pipeline = { advance: vi.fn() };
    const useCase = new HandleCallWebhookUseCase(repo, undefined, pipeline);

    await useCase.handleEndOfCall({
      id: 'fonema-1',
      session: { id: 'session-1' },
      analysis: { successEvaluation: false, structuredData: {} },
    });

    expect(pipeline.advance).not.toHaveBeenCalled();
  });

  it('resuelve caseId por NIT cuando falta en la llamada', async () => {
    const repo = new InMemoryCallRepository();
    await seedCall(repo, { caseId: undefined, variables: { nit: '9001234567' } });
    const pipeline = { advance: vi.fn().mockResolvedValue(undefined) };
    const pipelineCases = { ensureByLeadId: vi.fn().mockResolvedValue({ id: 'case-from-nit' }) };
    const useCase = new HandleCallWebhookUseCase(repo, undefined, pipeline, pipelineCases as never);

    await useCase.handleEndOfCall({
      id: 'fonema-1',
      session: { id: 'session-1' },
      analysis: {
        successEvaluation: true,
        structuredData: { identidad_verificada: true, cliente_interesado: true },
      },
    });

    expect(pipeline.advance).toHaveBeenCalledWith('case-from-nit', 'power_apps');
  });

  it('ignora end of call sin session id', async () => {
    const repo = new InMemoryCallRepository();
    const useCase = new HandleCallWebhookUseCase(repo);
    await expect(useCase.handleEndOfCall({ id: 'fonema-1' })).resolves.toBeUndefined();
  });
});
