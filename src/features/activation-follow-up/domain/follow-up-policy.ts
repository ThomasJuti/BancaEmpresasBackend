import type { FollowUpCase, FollowUpCaseView, FollowUpFase } from './entities.js';

/**
 * Política de seguimiento de uso (funciones puras, días emulados con dayMs):
 * la TC se inactiva a los 90 días sin uso. Cadencia de recordatorios:
 *   - mes 1 (día 30–59): UNA llamada por ciclo de uso (al detectar el mes sin uso)
 *   - mes 2 (día 60–89): cada 15 días (riesgo desde el día 75)
 *   - mes 3 (día ≥90):   semanal, hasta que registre uso o se cancele
 * Registrar uso reinicia el ciclo (los recordatorios previos dejan de contar).
 */

export const DIA_PRIMER_RECORDATORIO = 30;
export const DIA_INICIO_MES_2 = 60;
export const DIA_RIESGO_INACTIVACION = 75;
export const DIA_INACTIVACION = 90;
const INTERVALO_MES_2 = 15;
const INTERVALO_MES_3 = 7;

export function diasSinUso(caso: FollowUpCase, now: Date, dayMs: number): number {
  const elapsed = now.getTime() - new Date(caso.lastUsedAt).getTime();
  const dias = Math.floor(Math.max(0, elapsed) / dayMs);
  // La TC se inactiva a los 90 días sin uso: el contador se topa ahí (no tiene
  // sentido de negocio contar más allá de la inactivación).
  return Math.min(DIA_INACTIVACION, dias);
}

export function faseDe(dias: number): FollowUpFase {
  if (dias < DIA_PRIMER_RECORDATORIO) return 'al_dia';
  if (dias < DIA_INICIO_MES_2) return 'mes_1';
  if (dias < DIA_INACTIVACION) return 'mes_2';
  return 'mes_3';
}

/** Último recordatorio del ciclo de uso actual (posterior al último uso), si existe. */
function recordatorioDelCiclo(caso: FollowUpCase): Date | null {
  if (!caso.lastReminderAt) return null;
  const reminder = new Date(caso.lastReminderAt);
  return reminder.getTime() > new Date(caso.lastUsedAt).getTime() ? reminder : null;
}

export function isReminderDue(caso: FollowUpCase, now: Date, dayMs: number): boolean {
  const dias = diasSinUso(caso, now, dayMs);
  if (dias < DIA_PRIMER_RECORDATORIO) return false;

  const ultimoRecordatorio = recordatorioDelCiclo(caso);
  if (!ultimoRecordatorio) return true; // primera llamada del ciclo (día 30)

  const diasDesdeRecordatorio = Math.floor((now.getTime() - ultimoRecordatorio.getTime()) / dayMs);
  if (dias >= DIA_INACTIVACION) return diasDesdeRecordatorio >= INTERVALO_MES_3;
  if (dias >= DIA_INICIO_MES_2) return diasDesdeRecordatorio >= INTERVALO_MES_2;
  return false; // mes 1: una sola llamada por ciclo
}

function proximaLlamadaEstimada(caso: FollowUpCase, now: Date, dayMs: number): string | null {
  const dias = diasSinUso(caso, now, dayMs);
  const desde = (base: string | Date, diasSuma: number): string =>
    new Date(new Date(base).getTime() + diasSuma * dayMs).toISOString();

  const ultimoRecordatorio = recordatorioDelCiclo(caso);
  if (!ultimoRecordatorio) return desde(caso.lastUsedAt, DIA_PRIMER_RECORDATORIO);
  if (dias >= DIA_INACTIVACION) return desde(ultimoRecordatorio, INTERVALO_MES_3);
  if (dias >= DIA_INICIO_MES_2) return desde(ultimoRecordatorio, INTERVALO_MES_2);
  // mes 1 ya llamado: la siguiente cae al entrar al mes 2
  return desde(caso.lastUsedAt, DIA_INICIO_MES_2);
}

export function buildFollowUpView(caso: FollowUpCase, now: Date, dayMs: number): FollowUpCaseView {
  const dias = diasSinUso(caso, now, dayMs);
  return {
    ...caso,
    diasSinUso: dias,
    fase: faseDe(dias),
    riesgoInactivacion: dias >= DIA_RIESGO_INACTIVACION && dias < DIA_INACTIVACION,
    diasParaInactivacion: Math.max(0, DIA_INACTIVACION - dias),
    proximaLlamadaEstimada: proximaLlamadaEstimada(caso, now, dayMs),
  };
}

/**
 * Normaliza un teléfono colombiano a E.164 (lo que exige Fonema).
 * Celulares demo vienen como '3224118118' → '+573224118118'.
 */
export function toE164Colombia(telefono: string): string | null {
  const limpio = telefono.replace(/[\s()-]/g, '');
  if (/^\+\d{8,15}$/.test(limpio)) return limpio;
  const digitos = limpio.replace(/\D/g, '');
  if (digitos.length === 10) return `+57${digitos}`;
  if (digitos.length === 12 && digitos.startsWith('57')) return `+${digitos}`;
  return null;
}
