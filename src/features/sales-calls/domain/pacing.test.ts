import { describe, expect, it } from 'vitest';
import type { PacingPolicy } from './CallBatch.js';
import { isWithinContactWindow } from './pacing.js';

const basePacing: PacingPolicy = {
  maxConcurrent: 5,
  perHour: 60,
  timezone: 'America/Bogota',
};

describe('isWithinContactWindow', () => {
  it('respeta earliestAt y latestAt', () => {
    const pacing: PacingPolicy = {
      ...basePacing,
      earliestAt: '2026-07-12T15:00:00.000Z',
      latestAt: '2026-07-12T20:00:00.000Z',
    };
    expect(isWithinContactWindow(pacing, new Date('2026-07-12T14:00:00.000Z'))).toBe(false);
    expect(isWithinContactWindow(pacing, new Date('2026-07-12T16:00:00.000Z'))).toBe(true);
    expect(isWithinContactWindow(pacing, new Date('2026-07-12T21:00:00.000Z'))).toBe(false);
  });

  it('respeta horario laboral en zona horaria', () => {
    const pacing: PacingPolicy = {
      ...basePacing,
      businessHours: { startHour: 8, endHour: 20 },
    };
    // 15:00 UTC ≈ 10:00 Bogotá (UTC-5)
    expect(isWithinContactWindow(pacing, new Date('2026-07-12T15:00:00.000Z'))).toBe(true);
    // 02:00 UTC ≈ 21:00 Bogotá
    expect(isWithinContactWindow(pacing, new Date('2026-07-12T02:00:00.000Z'))).toBe(false);
  });

  it('permite contacto sin restricciones adicionales', () => {
    expect(isWithinContactWindow(basePacing, new Date())).toBe(true);
  });
});
