/** Estados del pipeline de venta de tarjetas de crédito (HITL). */
export type PipelineStage =
  | 'file_matching'
  | 'sales_call'
  | 'power_apps'
  | 'delivery_confirmation'
  | 'activation_follow_up'
  | 'completed'
  | 'rejected'
  | 'failed';

export type HitlDecision = 'approve' | 'reject' | 'retry';

export const PIPELINE_ORDER: readonly PipelineStage[] = [
  'file_matching',
  'sales_call',
  'power_apps',
  'delivery_confirmation',
  'activation_follow_up',
  'completed',
] as const;

export interface PipelineLeadRef {
  /** Identificador interno del lead / prospecto */
  leadId: string;
  /** Documento o llave de cruce (sin PII extra en logs) */
  matchKey: string;
}

export interface PipelineCase {
  id: string;
  stage: PipelineStage;
  lead: PipelineLeadRef;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Contrato para que las features avancen el pipeline sin importar
 * internals de core/pipeline.
 */
export interface PipelineStageAdvancer {
  advance(caseId: string, toStage: PipelineStage): Promise<void>;
}
