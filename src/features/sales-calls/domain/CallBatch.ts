/** Estado de una campaña de llamadas (batch). */
export type BatchStatus = 'running' | 'paused' | 'completed' | 'cancelled';

/** Estado de un item de la cola del batch. */
export type BatchItemStatus =
  | 'queued'
  | 'dialing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

/** Horario hábil de contacto (control de cumplimiento, no solo UX). */
export interface BusinessHours {
  /** Hora local de inicio (0–23). */
  startHour: number;
  /** Hora local de fin exclusiva (1–24). */
  endHour: number;
}

/**
 * Dos perillas independientes + ventana de contacto:
 * - maxConcurrent: slots simultáneos (concurrencia).
 * - perHour: ritmo de arranque (throughput).
 * - window/businessHours: cuándo se permite marcar.
 */
export interface PacingPolicy {
  maxConcurrent: number;
  perHour: number;
  earliestAt?: string;
  latestAt?: string;
  businessHours?: BusinessHours;
  timezone: string;
}

export interface CallBatch {
  id: string;
  name: string;
  agentId: string;
  status: BatchStatus;
  pacing: PacingPolicy;
  defaultVariables: Record<string, string>;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface CallBatchItem {
  id: string;
  batchId: string;
  leadId: string;
  phoneNumber: string;
  customerName?: string;
  customerEmail?: string;
  variables: Record<string, string>;
  status: BatchItemStatus;
  callId?: string;
  sessionId?: string;
  qualified?: boolean;
  attempts: number;
  lastError?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Lead de entrada al crear un batch (una llamada a agendar). */
export interface NewBatchLead {
  leadId: string;
  phoneNumber: string;
  customerName?: string;
  customerEmail?: string;
  variables?: Record<string, string>;
}

/** Datos para crear un batch nuevo (ya validados). */
export interface NewCallBatch {
  name: string;
  agentId: string;
  pacing: PacingPolicy;
  defaultVariables: Record<string, string>;
  leads: NewBatchLead[];
}

/** Conteo de items por estado — insumo del polling de progreso. */
export interface BatchCounts {
  queued: number;
  dialing: number;
  in_progress: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}
