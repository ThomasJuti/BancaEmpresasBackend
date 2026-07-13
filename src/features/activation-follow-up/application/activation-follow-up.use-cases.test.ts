import { describe, expect, it, vi } from 'vitest';
import { RegisterUsageUseCase } from './register-usage.use-case.js';
import { ListFollowUpCasesUseCase } from './list-follow-up-cases.use-case.js';
import { ProcessUsageRemindersUseCase } from './process-usage-reminders.use-case.js';
import { FinalizeDeliveryUseCase } from './finalize-delivery.use-case.js';
import { NotFoundError } from '../../../shared/exceptions/app-error.js';
import type { FollowUpCase } from '../domain/entities.js';

const dayMs = 86_400_000;

function sampleCase(overrides: Partial<FollowUpCase> = {}): FollowUpCase {
  return {
    id: '1',
    clienteId: '9001234567',
    caseId: 'case-1',
    clienteNombre: 'Empresa',
    telefono: '3001234567',
    correo: 'a@test.com',
    deliveredAt: '2026-01-01T00:00:00.000Z',
    congratulatedAt: null,
    congratulationCallId: null,
    lastUsedAt: '2026-01-01T00:00:00.000Z',
    lastReminderAt: null,
    reminderCount: 0,
    ...overrides,
  };
}

describe('activation-follow-up use cases', () => {
  it('RegisterUsageUseCase registra uso y retorna vista', async () => {
    const repo = {
      registerUsage: vi.fn().mockResolvedValue(sampleCase({ lastUsedAt: '2026-07-01T00:00:00.000Z' })),
    };
    const view = await new RegisterUsageUseCase(repo as never, dayMs).execute('9001234567');
    expect(view.clienteId).toBe('9001234567');
  });

  it('RegisterUsageUseCase lanza NotFoundError', async () => {
    await expect(
      new RegisterUsageUseCase({ registerUsage: vi.fn().mockResolvedValue(null) } as never, dayMs).execute('x'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ListFollowUpCasesUseCase ordena por diasSinUso desc', async () => {
    const repo = {
      findAll: vi.fn().mockResolvedValue([
        sampleCase({ id: 'a', lastUsedAt: '2026-06-01T00:00:00.000Z' }),
        sampleCase({ id: 'b', lastUsedAt: '2026-01-01T00:00:00.000Z' }),
      ]),
    };
    const list = await new ListFollowUpCasesUseCase(repo as never, dayMs).execute();
    expect(list[0].diasSinUso).toBeGreaterThanOrEqual(list[1].diasSinUso);
  });

  it('ProcessUsageRemindersUseCase inicia llamadas vencidas', async () => {
    const lastUsed = new Date(Date.now() - 31 * dayMs).toISOString();
    const repo = {
      findAll: vi.fn().mockResolvedValue([sampleCase({ lastUsedAt: lastUsed })]),
      registerReminder: vi.fn().mockResolvedValue(undefined),
    };
    const followUpCalls = { initiate: vi.fn().mockResolvedValue({ callId: 'call-1' }) };
    const result = await new ProcessUsageRemindersUseCase(repo as never, followUpCalls, dayMs).execute();
    expect(result.llamadasIniciadas).toBe(1);
  });

  it('ProcessUsageRemindersUseCase omite casos sin teléfono válido', async () => {
    const lastUsed = new Date(Date.now() - 31 * dayMs).toISOString();
    const repo = {
      findAll: vi.fn().mockResolvedValue([sampleCase({ lastUsedAt: lastUsed, telefono: '123' })]),
      registerReminder: vi.fn(),
    };
    const result = await new ProcessUsageRemindersUseCase(
      repo as never,
      { initiate: vi.fn() },
      dayMs,
    ).execute();
    expect(result.llamadasIniciadas).toBe(0);
  });

  it('FinalizeDeliveryUseCase crea caso nuevo e inicia felicitación', async () => {
    const repo = {
      findByClienteId: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleCase({ congratulationCallId: 'call-1' })),
      create: vi.fn().mockResolvedValue(sampleCase()),
      setCongratulation: vi.fn().mockResolvedValue(undefined),
    };
    const followUpCalls = { initiate: vi.fn().mockResolvedValue({ callId: 'call-1' }) };
    const pipelineCases = { ensureByLeadId: vi.fn().mockResolvedValue({ id: 'case-1' }) };
    const pipeline = { advance: vi.fn().mockResolvedValue(undefined) };

    const result = await new FinalizeDeliveryUseCase(
      repo as never,
      followUpCalls,
      pipelineCases as never,
      pipeline,
      dayMs,
    ).execute({ clienteId: '9001234567', nombre: 'Empresa', telefono: '3001234567' });

    expect(result.yaExistia).toBe(false);
    expect(result.llamadaFelicitacionIniciada).toBe(true);
  });

  it('FinalizeDeliveryUseCase retorna existente sin duplicar', async () => {
    const repo = { findByClienteId: vi.fn().mockResolvedValue(sampleCase()) };
    const result = await new FinalizeDeliveryUseCase(
      repo as never,
      { initiate: vi.fn() },
      { ensureByLeadId: vi.fn() } as never,
      { advance: vi.fn() },
      dayMs,
    ).execute({ clienteId: '9001234567' });
    expect(result.yaExistia).toBe(true);
  });

  it('FinalizeDeliveryUseCase tolera fallo de pipeline y teléfono inválido', async () => {
    const repo = {
      findByClienteId: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(sampleCase()),
      create: vi.fn().mockResolvedValue(sampleCase()),
      setCongratulation: vi.fn(),
    };
    const pipelineCases = { ensureByLeadId: vi.fn().mockRejectedValue(new Error('pipeline down')) };
    const result = await new FinalizeDeliveryUseCase(
      repo as never,
      { initiate: vi.fn() },
      pipelineCases as never,
      { advance: vi.fn() },
      dayMs,
    ).execute({ clienteId: '9001234567', nombre: 'Empresa' });
    expect(result.llamadaFelicitacionIniciada).toBe(false);
  });

  it('FinalizeDeliveryUseCase tolera fallo en llamada de felicitación', async () => {
    const repo = {
      findByClienteId: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(sampleCase()),
      create: vi.fn().mockResolvedValue(sampleCase()),
      setCongratulation: vi.fn(),
    };
    const followUpCalls = { initiate: vi.fn().mockRejectedValue(new Error('fonema down')) };
    const result = await new FinalizeDeliveryUseCase(
      repo as never,
      followUpCalls,
      { ensureByLeadId: vi.fn().mockResolvedValue({ id: 'case-1' }) } as never,
      { advance: vi.fn().mockResolvedValue(undefined) },
      dayMs,
    ).execute({ clienteId: '9001234567', nombre: 'Empresa', telefono: '3001234567' });
    expect(result.llamadaFelicitacionIniciada).toBe(false);
  });
});
