export interface InitiateFonemaCallInput {
  agentId: string;
  phoneNumber: string;
  customerName?: string;
  customerEmail?: string;
  variableValues?: Record<string, string>;
  delaySeconds?: number;
}

export interface InitiateFonemaCallResult {
  sessionId: string;
  raw: unknown;
}

export interface FonemaRecording {
  data: Buffer;
  contentType: string;
}

export interface FonemaGateway {
  initiateCall(input: InitiateFonemaCallInput): Promise<InitiateFonemaCallResult>;
  fetchRecording(recordingUrl: string): Promise<FonemaRecording | null>;
}
