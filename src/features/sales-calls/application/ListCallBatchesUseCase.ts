import type { CallBatch, CallBatchItem } from '../domain/CallBatch.js';
import type { CallBatchRepository } from '../domain/CallBatchRepository.js';

export class ListCallBatchesUseCase {
  constructor(private readonly batchRepository: CallBatchRepository) {}

  execute(): Promise<CallBatch[]> {
    return this.batchRepository.listBatches();
  }
}

export class ListBatchItemsUseCase {
  constructor(private readonly batchRepository: CallBatchRepository) {}

  execute(batchId: string): Promise<CallBatchItem[]> {
    return this.batchRepository.listItems(batchId);
  }
}
