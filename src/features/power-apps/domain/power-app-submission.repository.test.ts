import { describe, expect, it } from 'vitest';
import { validPowerAppDto } from '../../../__tests__/fixtures/valid-power-app-dto.js';
import { buildSubmissionPayload } from './power-app-submission.repository.js';

describe('buildSubmissionPayload', () => {
  it('mapea campos del DTO al payload de persistencia', () => {
    const payload = buildSubmissionPayload({
      ...validPowerAppDto,
      leadId: 'lead-1',
      campana: 'camp-1',
      asesorId: 'asesor-1',
      cupoDisponibleCec: 10_000_000,
    });

    expect(payload).toMatchObject({
      leadId: 'lead-1',
      campana: 'camp-1',
      asesorId: 'asesor-1',
      segmento: validPowerAppDto.segmento,
      identificacionEmpresa: validPowerAppDto.identificacionEmpresa,
      cupoTarjetaNueva: validPowerAppDto.cupoTarjetaNueva,
      cupoDisponibleCec: 10_000_000,
      puntoEntrega: validPowerAppDto.puntoEntrega,
    });
  });
});
