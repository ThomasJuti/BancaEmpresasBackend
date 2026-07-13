import { describe, expect, it, vi } from 'vitest';
import { RegisterManualCallUseCase } from './RegisterManualCallUseCase.js';
import { InMemoryCallRepository } from '../infrastructure/InMemoryCallRepository.js';

describe('RegisterManualCallUseCase', () => {
  it('registra llamada manual calificada y avanza pipeline', async () => {
    const repo = new InMemoryCallRepository();
    const pipelineCases = {
      ensureByLeadId: vi.fn().mockResolvedValue({ id: 'case-1' }),
    };
    const pipeline = { advance: vi.fn().mockResolvedValue(undefined) };
    const useCase = new RegisterManualCallUseCase(repo, pipelineCases, pipeline);

    const call = await useCase.execute({
      customerName: 'Juan',
      variables: { empresa: 'Demo SAS', nit: '900-123-456-7' },
      identidadVerificada: true,
      clienteInteresado: true,
    });

    expect(call.status).toBe('completed');
    expect(pipeline.advance).toHaveBeenCalledWith('case-1', 'power_apps');
  });

  it('no avanza pipeline si la llamada no califica', async () => {
    const repo = new InMemoryCallRepository();
    const pipeline = { advance: vi.fn() };
    const useCase = new RegisterManualCallUseCase(
      repo,
      { ensureByLeadId: vi.fn().mockResolvedValue({ id: 'case-1' }) },
      pipeline,
    );

    await useCase.execute({
      customerName: 'Juan',
      variables: { empresa: 'Demo', nit: '9001234567' },
      identidadVerificada: false,
      clienteInteresado: true,
    });

    expect(pipeline.advance).not.toHaveBeenCalled();
  });

  it('tolera fallo al avanzar pipeline en llamada manual calificada', async () => {
    const repo = new InMemoryCallRepository();
    const pipeline = { advance: vi.fn().mockRejectedValue(new Error('fail')) };
    const useCase = new RegisterManualCallUseCase(
      repo,
      { ensureByLeadId: vi.fn().mockResolvedValue({ id: 'case-1' }) },
      pipeline,
    );
    const call = await useCase.execute({
      customerName: 'Juan',
      variables: { empresa: 'Demo', nit: '9001234567' },
      identidadVerificada: true,
      clienteInteresado: true,
    });
    expect(call.status).toBe('completed');
  });
});
