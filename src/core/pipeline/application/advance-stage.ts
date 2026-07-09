import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineStage, PipelineStageAdvancer } from '../../../shared/contracts/pipeline.js';
import { PIPELINE_ORDER } from '../../../shared/contracts/pipeline.js';
import { AppError, ValidationError } from '../../../shared/exceptions/app-error.js';

const PIPELINE_TABLE = 'pipeline_cases';

/** Avanza el stage de un caso del pipeline en Supabase, validando el orden. */
export class SupabasePipelineStageAdvancer implements PipelineStageAdvancer {
  constructor(private readonly db: SupabaseClient) {}

  async advance(caseId: string, toStage: PipelineStage): Promise<void> {
    if (!PIPELINE_ORDER.includes(toStage)) {
      throw new ValidationError(`Stage ${toStage} is not part of the pipeline order`);
    }

    const { data: row, error: readError } = await this.db
      .from(PIPELINE_TABLE)
      .select('stage')
      .eq('id', caseId)
      .maybeSingle();

    if (readError) {
      console.error(`pipeline advance: read failed — ${readError.message}`);
      throw new AppError('Database operation failed', 500, 'DB_ERROR');
    }
    if (!row) {
      // El caso puede no existir aún en demos parciales; avisamos sin romper el flujo.
      console.warn(`pipeline advance: case ${caseId} not found in ${PIPELINE_TABLE}, skipping`);
      return;
    }

    const currentIndex = PIPELINE_ORDER.indexOf(row.stage as PipelineStage);
    const targetIndex = PIPELINE_ORDER.indexOf(toStage);
    if (currentIndex !== -1 && targetIndex < currentIndex) {
      throw new ValidationError(`Cannot move case backwards from ${row.stage} to ${toStage}`);
    }

    const { error } = await this.db
      .from(PIPELINE_TABLE)
      .update({ stage: toStage, updated_at: new Date().toISOString() })
      .eq('id', caseId);

    if (error) {
      console.error(`pipeline advance: update failed — ${error.message}`);
      throw new AppError('Database operation failed', 500, 'DB_ERROR');
    }
  }
}
