import type {
  BatchCounts,
  BatchItemStatus,
  BatchStatus,
  CallBatch,
  CallBatchItem,
  NewCallBatch,
} from './CallBatch.js';

/** Campos actualizables de un item al cambiar su estado. */
export interface BatchItemPatch {
  callId?: string;
  sessionId?: string;
  qualified?: boolean;
  lastError?: string;
  startedAt?: string;
  endedAt?: string;
  incrementAttempts?: boolean;
}

export interface CallBatchRepository {
  /** Crea el batch e inserta sus items (dedupe por leadId dentro del batch). */
  createBatch(data: NewCallBatch): Promise<CallBatch>;

  findBatchById(id: string): Promise<CallBatch | null>;
  listBatches(): Promise<CallBatch[]>;
  updateBatchStatus(id: string, status: BatchStatus): Promise<void>;

  /** Batches que el dispatcher debe considerar (status = running). */
  findRunningBatches(): Promise<CallBatch[]>;

  listItems(batchId: string): Promise<CallBatchItem[]>;
  countByStatus(batchId: string): Promise<BatchCounts>;

  /** Activos = dialing + in_progress (ocupan un slot de concurrencia). */
  countActive(batchId: string): Promise<number>;
  /** Items arrancados desde `since` (para el rate perHour). */
  countStartedSince(batchId: string, since: Date): Promise<number>;
  countByStatuses(batchId: string, statuses: BatchItemStatus[]): Promise<number>;

  /**
   * Claim atómico: mueve hasta `limit` items de queued→dialing y los devuelve.
   * Debe evitar el doble marcado entre ticks del cron (guard por status queued).
   */
  claimQueued(batchId: string, limit: number): Promise<CallBatchItem[]>;

  findItemById(id: string): Promise<CallBatchItem | null>;
  findItemByCallId(callId: string): Promise<CallBatchItem | null>;
  findItemBySessionId(sessionId: string): Promise<CallBatchItem | null>;

  markItem(itemId: string, status: BatchItemStatus, patch?: BatchItemPatch): Promise<void>;
}
