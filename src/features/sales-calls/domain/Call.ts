export type CallStatus = 'queued' | 'initiated' | 'in_progress' | 'completed' | 'failed';

export interface TranscriptMessage {
  role: string;
  message: string;
}

export interface Call {
  id: string;
  sessionId?: string;
  fonemaCallId?: string;
  /** Caso del pipeline (pipeline_cases.id) al que pertenece esta llamada. */
  caseId?: string;
  agentId: string;
  phoneNumber: string;
  customerName?: string;
  customerEmail?: string;
  script?: string;
  /** Variables de ENTRADA enviadas al agente al iniciar (empresa, nit, script...). */
  variables: Record<string, string>;
  /** Variables de SALIDA que Fonema devuelve tras la conversación (agente recolecta/actualiza). */
  outputVariables?: Record<string, string>;
  status: CallStatus;
  recordingUrl?: string;
  detailsUrl?: string;
  transcript?: TranscriptMessage[];
  summary?: string;
  endedReason?: string;
  /** Inicio real de la llamada según Fonema (distinto de createdAt/encolado). */
  startedAt?: string;
  durationSeconds?: number;
  successEvaluation?: boolean | string;
  structuredData?: Record<string, unknown>;
  totalAttempts?: number;
  createdAt: string;
  updatedAt: string;
}
