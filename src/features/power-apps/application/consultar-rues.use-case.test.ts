import { describe, expect, it, vi } from 'vitest';
import { consultarRuesUseCase } from './consultar-rues.use-case.js';

describe('consultarRuesUseCase', () => {
  it('consulta RUES y aplica cross-check cuando hay formulario', async () => {
    const client = {
      consultar: vi.fn().mockResolvedValue({
        consultation: {
          solicitudId: 'rues-1',
          nit: '9001234567',
          consultadoEn: '2026-01-01',
          urlConsulta: 'https://rues.test',
          razonSocial: 'EMPRESA DEMO SAS',
          datos: { 'Estado de la matrícula': 'Activa' },
          representantes: [{ documento: '1234567890', nombre: 'JUAN' }],
        },
      }),
    };

    const result = await consultarRuesUseCase(client, {
      nit: '9001234567',
      form: {
        identificacionEmpresa: '9001234567',
        nombreEmpresa: 'EMPRESA DEMO SAS',
        numeroIdentificacionTarjetahabiente: '1234567890',
      },
    });

    expect(client.consultar).toHaveBeenCalledWith('9001234567', { headed: undefined, mock: undefined });
    expect(result.issues).toHaveLength(0);
  });

  it('retorna issues vacíos sin formulario', async () => {
    const client = {
      consultar: vi.fn().mockResolvedValue({
        consultation: {
          solicitudId: 'rues-1',
          nit: '9001234567',
          consultadoEn: '2026-01-01',
          urlConsulta: 'https://rues.test',
          razonSocial: 'EMPRESA',
          datos: {},
        },
      }),
    };

    const result = await consultarRuesUseCase(client, { nit: '9001234567' });
    expect(result.issues).toEqual([]);
  });
});
