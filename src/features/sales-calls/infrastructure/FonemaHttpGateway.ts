import type {
  FonemaGateway,
  FonemaRecording,
  InitiateFonemaCallInput,
  InitiateFonemaCallResult,
} from '../domain/FonemaGateway.js';

export class FonemaHttpGateway implements FonemaGateway {
  // Caché en memoria de grabaciones ya descargadas, para no re-pedir el
  // audio completo a Fonema en cada petición de rango (seek del reproductor).
  private readonly recordingCache = new Map<string, FonemaRecording>();

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async initiateCall(input: InitiateFonemaCallInput): Promise<InitiateFonemaCallResult> {
    const response = await fetch(`${this.baseUrl}/v2/initiate-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        agentId: input.agentId,
        customer: {
          name: input.customerName,
          phoneNumber: input.phoneNumber,
          email: input.customerEmail,
        },
        delay: input.delaySeconds,
        variableValues: input.variableValues,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Fonema initiate-call falló (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as { session?: { id?: string } };
    const sessionId = data.session?.id;

    if (!sessionId) {
      throw new Error('La respuesta de Fonema no incluyó un id de sesión');
    }

    return { sessionId, raw: data };
  }

  async fetchRecording(recordingUrl: string): Promise<FonemaRecording | null> {
    const cached = this.recordingCache.get(recordingUrl);
    if (cached) {
      return cached;
    }

    const response = await fetch(recordingUrl, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      return null;
    }

    const recording: FonemaRecording = {
      data: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'audio/wav',
    };
    this.recordingCache.set(recordingUrl, recording);
    return recording;
  }
}
