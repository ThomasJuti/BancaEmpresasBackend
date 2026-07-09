export type CallStatus = 'queued' | 'initiated' | 'in_progress' | 'completed' | 'failed';

export interface TranscriptMessage {
  role: string;
  message: string;
}

export interface Call {
  id: string;
  sessionId?: string;
  fonemaCallId?: string;
  agentId: string;
  phoneNumber: string;
  customerName?: string;
  customerEmail?: string;
  script?: string;
  variables: Record<string, string>;
  status: CallStatus;
  recordingUrl?: string;
  detailsUrl?: string;
  transcript?: TranscriptMessage[];
  summary?: string;
  endedReason?: string;
  durationSeconds?: number;
  successEvaluation?: boolean | string;
  structuredData?: Record<string, unknown>;
  totalAttempts?: number;
  createdAt: string;
  updatedAt: string;
}
