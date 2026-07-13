import { describe, expect, it } from 'vitest';
import {
  crossCheckPowerAppWithRues,
  manualPdfWithoutRuesIssue,
} from './rues-cross-check.js';
import type { RuesConsultation } from './rues-consultation.js';

const baseConsultation: RuesConsultation = {
  solicitudId: 'rues-1',
  nit: '9001234567',
  consultadoEn: '2026-01-01',
  urlConsulta: 'https://rues.test',
  razonSocial: 'EMPRESA DEMO SAS',
  datos: { 'Estado de la matrícula': 'Activa', Municipio: 'Bogotá' },
  secciones: {},
  representantes: [{ documento: '1234567890', nombre: 'JUAN PEREZ' }],
  actividades: [],
};

describe('crossCheckPowerAppWithRues', () => {
  const form = {
    identificacionEmpresa: '9001234567',
    nombreEmpresa: 'EMPRESA DEMO SAS',
    numeroIdentificacionTarjetahabiente: '1234567890',
    nombreTarjetahabiente: 'JUAN PEREZ',
    ciudadPuntoEntrega: 'Bogotá',
  };

  it('no reporta issues cuando todo coincide', () => {
    expect(crossCheckPowerAppWithRues(form, baseConsultation)).toHaveLength(0);
  });

  it('detecta NIT distinto', () => {
    const issues = crossCheckPowerAppWithRues(form, { ...baseConsultation, nit: '8001112223' });
    expect(issues.some((i) => i.code === 'RUES_NIT_MISMATCH')).toBe(true);
  });

  it('advierte razón social distinta', () => {
    const issues = crossCheckPowerAppWithRues(
      { ...form, nombreEmpresa: 'OTRA EMPRESA XYZ' },
      baseConsultation,
    );
    expect(issues.some((i) => i.code === 'RUES_RAZON_SOCIAL_MISMATCH' && i.field === 'nombreEmpresa')).toBe(
      true,
    );
  });

  it('detecta matrícula inactiva', () => {
    const issues = crossCheckPowerAppWithRues(form, {
      ...baseConsultation,
      datos: { 'Estado de la matricula': 'Cancelada' },
    });
    expect(issues.some((i) => i.code === 'RUES_MATRICULA_INACTIVA')).toBe(true);
  });

  it('advierte representante no coincidente', () => {
    const issues = crossCheckPowerAppWithRues(
      { ...form, numeroIdentificacionTarjetahabiente: '9999999999' },
      baseConsultation,
    );
    expect(issues.some((i) => i.code === 'RUES_REPRESENTANTE_NO_COINCIDE')).toBe(true);
  });

  it('advierte ciudad distinta al municipio RUES', () => {
    const issues = crossCheckPowerAppWithRues(
      { ...form, ciudadPuntoEntrega: 'Medellín' },
      baseConsultation,
    );
    expect(issues.some((i) => i.field === 'ciudadPuntoEntrega')).toBe(true);
  });

  it('normaliza NIT de 10 dígitos iniciando en 8/9', () => {
    const issues = crossCheckPowerAppWithRues(
      { ...form, identificacionEmpresa: '8901234567' },
      { ...baseConsultation, nit: '890123456' },
    );
    expect(issues.filter((i) => i.code === 'RUES_NIT_MISMATCH')).toHaveLength(0);
  });
});

describe('manualPdfWithoutRuesIssue', () => {
  it('retorna warning esperado', () => {
    const issue = manualPdfWithoutRuesIssue();
    expect(issue.code).toBe('RUES_MANUAL_PDF_SIN_CONSULTA');
    expect(issue.severity).toBe('warning');
  });
});
