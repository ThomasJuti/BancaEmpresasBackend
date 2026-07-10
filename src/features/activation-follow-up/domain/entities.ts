/** Fase del seguimiento según días sin uso (la TC se inactiva a los 90 días). */
export type FollowUpFase = 'al_dia' | 'mes_1' | 'mes_2' | 'mes_3';

/** Caso de seguimiento de uso de una TC entregada (tabla follow_up_cases). */
export interface FollowUpCase {
  id: string;
  /** NIT de la empresa (lead del pipeline). */
  clienteId: string;
  caseId: string | null;
  clienteNombre: string | null;
  telefono: string | null;
  correo: string | null;
  /** Cuándo se marcó la entrega finalizada (arranca el reloj de uso). */
  deliveredAt: string;
  congratulatedAt: string | null;
  congratulationCallId: string | null;
  lastUsedAt: string;
  lastReminderAt: string | null;
  reminderCount: number;
}

/** Caso + campos calculados por la política de seguimiento (para la UI). */
export interface FollowUpCaseView extends FollowUpCase {
  diasSinUso: number;
  fase: FollowUpFase;
  /** true desde el día 75: quedan ≤15 días para la inactivación. */
  riesgoInactivacion: boolean;
  diasParaInactivacion: number;
  proximaLlamadaEstimada: string | null;
}

/** Conteos de un tick del cron de recordatorios; sin datos de clientes. */
export interface FollowUpRemindersResumen {
  procesados: number;
  llamadasIniciadas: number;
  errores: number;
}
