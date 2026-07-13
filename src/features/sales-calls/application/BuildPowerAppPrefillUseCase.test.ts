import { describe, expect, it } from 'vitest';
import { BuildPowerAppPrefillUseCase } from './BuildPowerAppPrefillUseCase.js';
import { InMemoryCallRepository } from '../infrastructure/InMemoryCallRepository.js';
import type { Call } from '../domain/Call.js';

describe('BuildPowerAppPrefillUseCase', () => {
  it('retorna null si la llamada no califica', async () => {
    const repo = new InMemoryCallRepository();
    const useCase = new BuildPowerAppPrefillUseCase(repo);
    const call: Call = {
      id: 'call-1',
      agentId: 'agent',
      phoneNumber: '+573001234567',
      variables: {},
      status: 'queued',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await repo.save(call);
    expect(await useCase.execute('call-1')).toBeNull();
  });

  it('construye prefill desde variables estructuradas', async () => {
    const repo = new InMemoryCallRepository();
    const useCase = new BuildPowerAppPrefillUseCase(repo);
    await repo.save({
      id: 'call-1',
      agentId: 'agent',
      phoneNumber: '+573001234567',
      customerName: 'Juan Pérez',
      variables: { nit: '9001234567', empresa: 'Demo SAS', segmento: 'Pyme' },
      structuredData: {
        identidad_verificada: true,
        cliente_interesado: true,
        numeroDocumento: '1234567890',
        tipoDocumento: 'CC',
        ciudad: 'Bogotá',
        entrega: 'punto comercial',
      },
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const prefill = await useCase.execute('call-1');
    expect(prefill?.identificacionEmpresa).toBe('9001234567');
    expect(prefill?.nombreEmpresa).toBe('Demo SAS');
    expect(prefill?.tipoTarjetaNueva).toBe('LATAM BUSINESS');
    expect(prefill?.puntoEntrega).toBe('PUNTO_ENTREGA_A_COMERCIAL');
    expect(prefill?.origenLlamada.callId).toBe('call-1');
  });

  it('construye prefill con entrega courier y alias numéricos', async () => {
    const repo = new InMemoryCallRepository();
    const useCase = new BuildPowerAppPrefillUseCase(repo);
    await repo.save({
      id: 'call-2',
      agentId: 'agent',
      phoneNumber: '+573001234567',
      variables: { nit: '9001234567', empresa: 'Demo SAS' },
      structuredData: {
        identidad_verificada: true,
        cliente_interesado: true,
        tipoDocumento: 'CE',
        numeroDocumento: '123456789012345',
        entrega: 'envio certificado courier',
        cupo: '2500000',
        bin: '549166',
      },
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const prefill = await useCase.execute('call-2');
    expect(prefill?.puntoEntrega).toBe('ENVIO_CERTIFICADO_COURIER');
    expect(prefill?.cupoTarjetaNueva).toBe(2500000);
    expect(prefill?.binProducto).toBe('549166');
    expect(prefill?.tipoIdentificacionTarjetahabiente).toBe('CE');
  });
});
