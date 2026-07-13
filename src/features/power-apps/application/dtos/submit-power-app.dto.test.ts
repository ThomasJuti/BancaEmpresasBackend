import { describe, expect, it } from 'vitest';
import { validPowerAppDto } from '../../../../__tests__/fixtures/valid-power-app-dto.js';
import { submitPowerAppSchema } from './submit-power-app.dto.js';

describe('submitPowerAppSchema', () => {
  it('acepta DTO válido', () => {
    expect(submitPowerAppSchema.safeParse(validPowerAppDto).success).toBe(true);
  });

  it('rechaza cupo no positivo', () => {
    const result = submitPowerAppSchema.safeParse({ ...validPowerAppDto, cupoTarjetaNueva: 0 });
    expect(result.success).toBe(false);
  });

  it('rechaza adjuntos vacíos', () => {
    const result = submitPowerAppSchema.safeParse({ ...validPowerAppDto, archivosAdjuntos: [] });
    expect(result.success).toBe(false);
  });

  it('rechaza puntoEntrega inválido', () => {
    const result = submitPowerAppSchema.safeParse({
      ...validPowerAppDto,
      puntoEntrega: 'INVALIDO',
    });
    expect(result.success).toBe(false);
  });
});
