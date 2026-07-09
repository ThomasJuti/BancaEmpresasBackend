import type { CallBatch } from '../domain/CallBatch.js';
import type { CallBatchRepository } from '../domain/CallBatchRepository.js';
import { isWithinContactWindow } from '../domain/pacing.js';
import type { InitiateCallUseCase } from './InitiateCallUseCase.js';

export interface DispatchResult {
  /** Batches evaluados (running). */
  batchesConsidered: number;
  /** Llamadas efectivamente disparadas en este tick. */
  dialed: number;
  /** Batches cerrados a completed en este tick. */
  completedBatches: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Dispatcher PROGRESSIVE: en cada tick (Vercel Cron) drena las colas respetando
 * concurrencia (maxConcurrent), throughput (perHour) y ventana de contacto.
 * "Dispara la siguiente cuando se libera un slot" — sin sobre-marcado ni abandono,
 * porque un agente de voz-IA es un slot que contesta al instante.
 *
 * No abre conexiones persistentes ni usa timers en memoria: es idempotente por tick
 * y seguro en serverless (el estado vive en Supabase).
 */
export class DispatchCallBatchesUseCase {
  constructor(
    private readonly batchRepository: CallBatchRepository,
    private readonly initiateCallUseCase: InitiateCallUseCase,
  ) {}

  async execute(now: Date = new Date()): Promise<DispatchResult> {
    const batches = await this.batchRepository.findRunningBatches();
    let dialed = 0;
    let completedBatches = 0;

    for (const batch of batches) {
      // 1) Cierre del batch: sin activos ni en cola → completed.
      const active = await this.batchRepository.countActive(batch.id);
      const queued = await this.batchRepository.countByStatuses(batch.id, ['queued']);
      if (active === 0 && queued === 0) {
        await this.batchRepository.updateBatchStatus(batch.id, 'completed');
        completedBatches += 1;
        continue;
      }

      // 2) Fuera de ventana de contacto → no marcar (cumplimiento).
      if (!isWithinContactWindow(batch.pacing, now)) continue;
      if (queued === 0) continue;

      // 3) Headroom = min(slots libres, cupo del rate horario, en cola).
      const startedLastHour = await this.batchRepository.countStartedSince(
        batch.id,
        new Date(now.getTime() - ONE_HOUR_MS),
      );
      const concurrencyHeadroom = batch.pacing.maxConcurrent - active;
      const rateHeadroom = batch.pacing.perHour - startedLastHour;
      const headroom = Math.min(concurrencyHeadroom, rateHeadroom, queued);
      if (headroom <= 0) continue;

      // 4) Claim atómico y disparo de cada llamada (reusa InitiateCallUseCase).
      const claimed = await this.batchRepository.claimQueued(batch.id, headroom);
      for (const item of claimed) {
        dialed += await this.dialOne(batch, item.id, item);
      }
    }

    return { batchesConsidered: batches.length, dialed, completedBatches };
  }

  private async dialOne(
    batch: CallBatch,
    itemId: string,
    item: { phoneNumber: string; customerName?: string; customerEmail?: string; variables: Record<string, string> },
  ): Promise<number> {
    try {
      const call = await this.initiateCallUseCase.execute({
        phoneNumber: item.phoneNumber,
        customerName: item.customerName,
        customerEmail: item.customerEmail,
        variables: { ...batch.defaultVariables, ...item.variables },
      });

      // Item queda dialing con la correlación (sessionId/callId) para el webhook.
      await this.batchRepository.markItem(itemId, 'dialing', {
        callId: call.id,
        sessionId: call.sessionId,
        incrementAttempts: true,
      });
      return 1;
    } catch (error) {
      // No aborta el lote: los demás items deben seguir (patrón process-due-emails).
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`call-batch dispatch: failed to dial item ${itemId} — ${message}`);
      await this.batchRepository.markItem(itemId, 'failed', {
        lastError: message,
        endedAt: new Date().toISOString(),
        incrementAttempts: true,
      });
      return 0;
    }
  }
}
