import { describe, expect, it, vi } from 'vitest';
import { BuildClientesFinalesUseCase } from './build-clientes-finales.use-case.js';
import { EnrichClientesFinalesRuesUseCase } from './enrich-clientes-finales-rues.use-case.js';
import { AppError } from '../../../shared/exceptions/app-error.js';

describe('BuildClientesFinalesUseCase', () => {
  it('genera candidatos y clientes finales con pagaré', async () => {
    const cecRepository = {
      findConCupoDisponible: vi.fn().mockResolvedValue([
        { numeIden: '9001234567', disponible: 5_000_000, leaAprobado: true },
      ]),
    };
    const basePotencialRepository = {
      findGestionablesSinTarjeta: vi.fn().mockResolvedValue([
        {
          clienteId: '9001234567',
          clienteNombre: 'Demo',
          ciudad: 'Bogotá',
          subsegmento: 'Pyme',
          correo: 'a@test.com',
          telefono: '300',
        },
      ]),
    };
    const pagaresRepository = {
      findIdsConPagareActivo: vi.fn().mockResolvedValue(new Set(['9001234567'])),
    };
    const clientesFinalesRepository = { replaceAll: vi.fn().mockResolvedValue(undefined) };
    const clientesFinalesSinPagareRepository = { replaceAll: vi.fn().mockResolvedValue(undefined) };

    const useCase = new BuildClientesFinalesUseCase(
      cecRepository as never,
      basePotencialRepository as never,
      pagaresRepository as never,
      clientesFinalesRepository as never,
      clientesFinalesSinPagareRepository as never,
    );

    const resumen = await useCase.execute();
    expect(resumen.clientesFinales).toBe(1);
    expect(clientesFinalesRepository.replaceAll).toHaveBeenCalled();
  });

  it('bloquea ejecución concurrente', async () => {
    const useCase = new BuildClientesFinalesUseCase(
      { findConCupoDisponible: vi.fn().mockImplementation(() => new Promise(() => {})) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const pending = useCase.execute();
    await expect(useCase.execute()).rejects.toBeInstanceOf(AppError);
    pending.catch(() => {});
  });
});

describe('EnrichClientesFinalesRuesUseCase', () => {
  it('enriquece clientes con RUES', async () => {
    const clientesFinalesRepository = {
      findAllClienteIds: vi.fn().mockResolvedValue(['9001234567', '8001112223']),
      updateRuesEnrichment: vi.fn().mockResolvedValue(undefined),
    };
    const ruesProvider = {
      findByNit: vi
        .fn()
        .mockResolvedValueOnce({ razonSocial: 'Demo' })
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('fail')),
    };

    const useCase = new EnrichClientesFinalesRuesUseCase(
      clientesFinalesRepository as never,
      ruesProvider as never,
    );
    const resumen = await useCase.execute();
    expect(resumen.procesados).toBe(2);
    expect(resumen.encontrados).toBe(1);
    expect(resumen.sinCoincidencia).toBe(1);
    expect(resumen.errores).toBe(0);
  });

  it('bloquea enriquecimiento concurrente', async () => {
    const useCase = new EnrichClientesFinalesRuesUseCase(
      { findAllClienteIds: vi.fn().mockImplementation(() => new Promise(() => {})) } as never,
      { findByNit: vi.fn() } as never,
    );
    const pending = useCase.execute();
    await expect(useCase.execute()).rejects.toBeInstanceOf(AppError);
    pending.catch(() => {});
  });
});
