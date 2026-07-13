import { describe, expect, it } from 'vitest';
import { validPowerAppDto } from '../../../__tests__/fixtures/valid-power-app-dto.js';
import type { PowerAppRequest } from './power-app-request.js';
import { validatePowerAppRequest } from './power-app-validator.js';

function baseRequest(overrides: Partial<PowerAppRequest> = {}): PowerAppRequest {
  return { ...validPowerAppDto, ...overrides };
}

describe('validatePowerAppRequest', () => {
  it('no reporta errores para solicitud válida', () => {
    const issues = validatePowerAppRequest(baseRequest());
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('detecta identificaciones duplicadas', () => {
    const issues = validatePowerAppRequest(
      baseRequest({
        identificacionEmpresa: '9001234567',
        numeroIdentificacionTarjetahabiente: '9001234567',
      }),
    );
    expect(issues.some((i) => i.code === 'DUPLICATE_IDENTIFICATION')).toBe(true);
  });

  it('detecta intercambio NIT/cédula', () => {
    const issues = validatePowerAppRequest(
      baseRequest({
        identificacionEmpresa: '12345678',
        numeroIdentificacionTarjetahabiente: '9001234567',
        tipoIdentificacionTarjetahabiente: 'CC',
      }),
    );
    expect(issues.some((i) => i.code === 'FIELD_SWAP_NIT_CEDULA')).toBe(true);
  });

  it('rechaza NIT inválido', () => {
    const issues = validatePowerAppRequest(baseRequest({ identificacionEmpresa: '123' }));
    expect(issues.some((i) => i.code === 'INVALID_FORMAT' && i.field === 'identificacionEmpresa')).toBe(
      true,
    );
  });

  it('rechaza documento tarjetahabiente inválido', () => {
    const issues = validatePowerAppRequest(
      baseRequest({ numeroIdentificacionTarjetahabiente: '9012345678' }),
    );
    expect(
      issues.some(
        (i) => i.code === 'INVALID_FORMAT' && i.field === 'numeroIdentificacionTarjetahabiente',
      ),
    ).toBe(true);
  });

  it('valida producto LATAM Business y BIN', () => {
    expect(
      validatePowerAppRequest(baseRequest({ tipoTarjetaNueva: 'VISA' })).some(
        (i) => i.code === 'PRODUCTO_INVALIDO',
      ),
    ).toBe(true);
    expect(
      validatePowerAppRequest(baseRequest({ binProducto: '111111' })).some(
        (i) => i.code === 'BIN_PRODUCTO_INVALIDO',
      ),
    ).toBe(true);
    expect(
      validatePowerAppRequest(baseRequest({ binProducto: 'abc' })).some(
        (i) => i.code === 'INVALID_FORMAT' && i.field === 'binProducto',
      ),
    ).toBe(true);
  });

  it('valida cupo', () => {
    expect(
      validatePowerAppRequest(baseRequest({ cupoTarjetaNueva: 0 })).some((i) => i.code === 'CUPO_INVALIDO'),
    ).toBe(true);
    expect(
      validatePowerAppRequest(baseRequest({ cupoTarjetaNueva: 10_000_000, cupoDisponibleCec: 5_000_000 })).some(
        (i) => i.code === 'CUPO_EXCEDE_DISPONIBLE',
      ),
    ).toBe(true);
  });

  it('valida adjuntos', () => {
    expect(
      validatePowerAppRequest(baseRequest({ archivosAdjuntos: [] })).some(
        (i) => i.code === 'ADJUNTOS_REQUERIDOS',
      ),
    ).toBe(true);
    expect(
      validatePowerAppRequest(baseRequest({ archivosAdjuntos: ['foto.jpg'] })).some(
        (i) => i.code === 'ADJUNTOS_REQUERIDOS',
      ),
    ).toBe(true);
  });

  it('valida código de oficina', () => {
    expect(
      validatePowerAppRequest(baseRequest({ codigoOficinaCentroServicio: 'xx' })).some(
        (i) => i.field === 'codigoOficinaCentroServicio',
      ),
    ).toBe(true);
  });

  it('advierte segmento no elegible', () => {
    const issues = validatePowerAppRequest(baseRequest({ segmento: 'Retail' }));
    expect(issues.some((i) => i.code === 'SEGMENTO_NO_ELEGIBLE' && i.severity === 'warning')).toBe(true);
  });
});
