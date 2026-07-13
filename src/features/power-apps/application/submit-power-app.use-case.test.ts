import { describe, expect, it } from 'vitest';
import { validPowerAppDto } from '../../../__tests__/fixtures/valid-power-app-dto.js';
import { submitPowerAppUseCase } from './submit-power-app.use-case.js';

describe('submitPowerAppUseCase', () => {
  it('aprueba solicitud válida con RUES', () => {
    const result = submitPowerAppUseCase(validPowerAppDto);
    expect(result.decision).toBe('APROBADO');
    expect(result.valid).toBe(true);
    expect(result.radicado).toMatch(/^GOPTC-\d{4}-/);
    expect(result.siguientePaso).toContain('Operaciones');
  });

  it('devuelve solicitud con intercambio NIT/cédula', () => {
    const result = submitPowerAppUseCase({
      ...validPowerAppDto,
      identificacionEmpresa: '12345678',
      numeroIdentificacionTarjetahabiente: '9001234567',
    });
    expect(result.decision).toBe('DEVUELTO');
    expect(result.valid).toBe(false);
    expect(result.radicado).toBeNull();
  });

  it('rechaza solicitud con errores graves', () => {
    const result = submitPowerAppUseCase({
      ...validPowerAppDto,
      tipoTarjetaNueva: 'VISA',
      documentoOrigen: 'RUES',
    });
    expect(result.decision).toBe('RECHAZADO');
  });

  it('agrega warning por PDF manual sin RUES', () => {
    const result = submitPowerAppUseCase({
      ...validPowerAppDto,
      documentoOrigen: 'MANUAL',
      ruesSolicitudId: undefined,
    });
    expect(result.issues.some((i) => i.code === 'RUES_MANUAL_PDF_SIN_CONSULTA')).toBe(true);
  });

  it('incluye issues de cross-check RUES', () => {
    const result = submitPowerAppUseCase({
      ...validPowerAppDto,
      ruesConsultation: {
        solicitudId: 'rues-1',
        nit: '8001112223',
        consultadoEn: '2026-01-01',
        urlConsulta: 'https://rues.test',
        razonSocial: 'OTRA EMPRESA',
        datos: { 'Estado de la matrícula': 'Cancelada' },
      },
    });
    expect(result.issues.some((i) => i.code === 'RUES_NIT_MISMATCH')).toBe(true);
    expect(result.issues.some((i) => i.code === 'RUES_MATRICULA_INACTIVA')).toBe(true);
  });
});
