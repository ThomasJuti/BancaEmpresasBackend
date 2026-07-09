import { NotFoundError, ValidationError } from '../../../shared/exceptions/app-error.js';
import type { CallBatch } from '../domain/CallBatch.js';
import type { CallBatchRepository } from '../domain/CallBatchRepository.js';

export type BatchAction = 'pause' | 'resume' | 'cancel';

/** Controla el ciclo de vida de una campaña: pausar / reanudar / cancelar. */
export class SetBatchStatusUseCase {
  constructor(private readonly batchRepository: CallBatchRepository) {}

  async execute(batchId: string, action: BatchAction): Promise<CallBatch> {
    const batch = await this.batchRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Campaña no encontrada');

    if (batch.status === 'completed' || batch.status === 'cancelled') {
      throw new ValidationError(`No se puede ${action} una campaña ${batch.status}`);
    }

    switch (action) {
      case 'pause':
        if (batch.status !== 'running') {
          throw new ValidationError('Solo se puede pausar una campaña en ejecución');
        }
        await this.batchRepository.updateBatchStatus(batchId, 'paused');
        break;
      case 'resume':
        if (batch.status !== 'paused') {
          throw new ValidationError('Solo se puede reanudar una campaña pausada');
        }
        await this.batchRepository.updateBatchStatus(batchId, 'running');
        break;
      case 'cancel':
        await this.batchRepository.updateBatchStatus(batchId, 'cancelled');
        break;
    }

    const updated = await this.batchRepository.findBatchById(batchId);
    // El registro existe (lo acabamos de actualizar); el ! es seguro.
    return updated!;
  }
}
