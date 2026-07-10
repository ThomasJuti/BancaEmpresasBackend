/** Tipos de llamada de la etapa activation-follow-up (agente Fonema de seguimiento). */
export type FollowUpCallTipo = 'felicitacion' | 'recordatorio_uso';

export interface FollowUpCallInput {
  tipo: FollowUpCallTipo;
  /** Teléfono E.164 (+57...) del contacto de la empresa. */
  phoneNumber: string;
  customerName?: string;
  /** NIT de la empresa; correlaciona la llamada con el lead del pipeline. */
  nit: string;
  /** Caso del pipeline (opcional) para trazabilidad. */
  caseId?: string;
  /** Variables adicionales para el agente (dias_sin_uso, fase, etc.). */
  variables?: Record<string, string>;
}

export interface FollowUpCallResult {
  /** Id de la llamada persistida (tabla calls). */
  callId: string;
}

/**
 * Contrato para que activation-follow-up dispare llamadas del agente de
 * seguimiento sin importar internals de sales-calls. sales-calls lo implementa
 * (usa FONEMA_FOLLOWUP_API_KEY + FONEMA_FOLLOWUP_AGENT_ID) y el composition root lo inyecta.
 */
export interface FollowUpCallService {
  initiate(input: FollowUpCallInput): Promise<FollowUpCallResult>;
}
