import { describe, expect, it } from 'vitest';
import type { FollowUpCase } from './entities.js';
import {
  buildFollowUpView,
  DIA_INACTIVACION,
  DIA_INICIO_MES_2,
  DIA_PRIMER_RECORDATORIO,
  DIA_RIESGO_INACTIVACION,
  diasSinUso,
  faseDe,
  isReminderDue,
  toE164Colombia,
} from './follow-up-policy.js';

const dayMs = 86_400_000;

function makeCase(overrides: Partial<FollowUpCase> = {}): FollowUpCase {
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

describe('follow-up-policy', () => {
  it('calcula días sin uso acotados a inactivación', () => {
    const now = new Date('2026-04-01T00:00:00.000Z');
    const caso = makeCase({ lastUsedAt: '2026-01-01T00:00:00.000Z' });
    expect(diasSinUso(caso, now, dayMs)).toBeLessThanOrEqual(DIA_INACTIVACION);
  });

  it('determina fase según días', () => {
    expect(faseDe(10)).toBe('al_dia');
    expect(faseDe(DIA_PRIMER_RECORDATORIO)).toBe('mes_1');
    expect(faseDe(DIA_INICIO_MES_2)).toBe('mes_2');
    expect(faseDe(DIA_INACTIVACION)).toBe('mes_3');
  });

  it('programa recordatorio inicial en día 30', () => {
    const lastUsed = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date(lastUsed.getTime() + DIA_PRIMER_RECORDATORIO * dayMs);
    expect(isReminderDue(makeCase({ lastUsedAt: lastUsed.toISOString() }), now, dayMs)).toBe(true);
  });

  it('no repite recordatorio en mes 1', () => {
    const lastUsed = new Date('2026-01-01T00:00:00.000Z');
    const reminder = new Date(lastUsed.getTime() + DIA_PRIMER_RECORDATORIO * dayMs);
    const now = new Date(reminder.getTime() + 2 * dayMs);
    expect(
      isReminderDue(
        makeCase({ lastUsedAt: lastUsed.toISOString(), lastReminderAt: reminder.toISOString() }),
        now,
        dayMs,
      ),
    ).toBe(false);
  });

  it('construye vista con riesgo de inactivación', () => {
    const lastUsed = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date(lastUsed.getTime() + DIA_RIESGO_INACTIVACION * dayMs);
    const view = buildFollowUpView(makeCase({ lastUsedAt: lastUsed.toISOString() }), now, dayMs);
    expect(view.riesgoInactivacion).toBe(true);
    expect(view.diasParaInactivacion).toBe(DIA_INACTIVACION - DIA_RIESGO_INACTIVACION);
    expect(view.proximaLlamadaEstimada).toBeTruthy();
  });

  it('programa recordatorio en mes 2 cada 15 días', () => {
    const lastUsed = new Date('2026-01-01T00:00:00.000Z');
    const reminder = new Date(lastUsed.getTime() + DIA_INICIO_MES_2 * dayMs);
    const now = new Date(reminder.getTime() + 15 * dayMs);
    expect(
      isReminderDue(
        makeCase({ lastUsedAt: lastUsed.toISOString(), lastReminderAt: reminder.toISOString() }),
        now,
        dayMs,
      ),
    ).toBe(true);
  });

  it('estima próxima llamada en mes 2', () => {
    const lastUsed = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date(lastUsed.getTime() + DIA_INICIO_MES_2 * dayMs);
    const view = buildFollowUpView(makeCase({ lastUsedAt: lastUsed.toISOString() }), now, dayMs);
    expect(view.fase).toBe('mes_2');
    expect(view.proximaLlamadaEstimada).toBeTruthy();
  });

  it('estima inicio mes 2 tras primer recordatorio en mes 1', () => {
    const lastUsed = new Date('2026-01-01T00:00:00.000Z');
    const reminder = new Date(lastUsed.getTime() + DIA_PRIMER_RECORDATORIO * dayMs);
    const now = new Date(reminder.getTime() + 2 * dayMs);
    const view = buildFollowUpView(
      makeCase({ lastUsedAt: lastUsed.toISOString(), lastReminderAt: reminder.toISOString() }),
      now,
      dayMs,
    );
    expect(view.fase).toBe('mes_1');
    expect(view.proximaLlamadaEstimada).toContain('2026');
  });

  it('normaliza teléfonos colombianos a E164', () => {
    expect(toE164Colombia('3001234567')).toBe('+573001234567');
    expect(toE164Colombia('+573001234567')).toBe('+573001234567');
    expect(toE164Colombia('123')).toBeNull();
  });
});
