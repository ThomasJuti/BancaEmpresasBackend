import type { PacingPolicy } from './CallBatch.js';

/** Hora local (0–23) de `date` en la zona horaria dada. */
function localHour(date: Date, timezone: string): number {
  // Intl evita depender de una librería de fechas para resolver la zona.
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(date);
  // '24' puede aparecer para medianoche según runtime; normalizar a 0.
  const hour = Number.parseInt(formatted, 10);
  return Number.isNaN(hour) ? 0 : hour % 24;
}

/**
 * ¿Se permite marcar ahora? Combina la ventana absoluta (earliest/latest) con el
 * horario hábil local. Es control de cumplimiento (habeas data / horarios de
 * contacto), no solo UX: el dispatcher no debe marcar fuera de esta ventana.
 */
export function isWithinContactWindow(pacing: PacingPolicy, now: Date): boolean {
  if (pacing.earliestAt && now < new Date(pacing.earliestAt)) return false;
  if (pacing.latestAt && now > new Date(pacing.latestAt)) return false;

  if (pacing.businessHours) {
    const hour = localHour(now, pacing.timezone);
    const { startHour, endHour } = pacing.businessHours;
    if (hour < startHour || hour >= endHour) return false;
  }

  return true;
}
