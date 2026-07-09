import type { Call, CallStatus, TranscriptMessage } from '../domain/Call.js';
import type { CallRepository } from '../domain/CallRepository.js';
import type { CallBatchRepository } from '../domain/CallBatchRepository.js';
import { isCallQualified } from '../domain/qualification.js';

// Esquemas según docs.fonema.ai/api/webhook/*

export interface CallUpdatePayload {
  event?: string;
  status?: string;
  timestamp?: string;
  call?: { id?: string };
  customer?: { name?: string; phoneNumber?: string };
}

export interface EndOfCallPayload {
  id?: string;
  session?: { id?: string };
  startedAt?: string;
  endedReason?: string;
  messages?: TranscriptMessage[];
  customer?: { name?: string; phoneNumber?: string };
  variableValues?: Record<string, string>;
  durationSeconds?: number;
  detailsURL?: string;
  recordingURL?: string;
  analysis?: {
    successEvaluation?: boolean | string;
    structuredData?: Record<string, unknown>;
    summary?: string;
  };
}

export interface EndOfSessionPayload {
  customer?: { name?: string; phoneNumber?: string };
  variableValues?: Record<string, string>;
  totalAttempts?: number;
  endedReason?: string;
  analysis?: {
    successEvaluation?: boolean | string;
    structuredData?: Record<string, unknown>;
  };
}

export class HandleCallWebhookUseCase {
  constructor(
    private readonly callRepository: CallRepository,
    // Opcional: si el call pertenece a una campaña, se sincroniza su item.
    // Ausente en configuraciones sin batch (p. ej. seed/demo in-memory).
    private readonly batchRepository?: CallBatchRepository,
  ) {}

  // Webhook "actualizaciones-de-llamada": cambios de estado en tiempo real.
  async handleCallUpdate(payload: CallUpdatePayload): Promise<void> {
    const callId = payload.call?.id;
    if (!callId) {
      return;
    }

    const call = await this.callRepository.findByFonemaCallId(callId);
    if (!call) {
      // Aún no conocemos esta llamada por su id (solo tenemos el sessionId
      // hasta que llega fin-de-llamada). Se ignora sin fallar.
      return;
    }

    call.status = this.mapStatus(payload.status);
    call.updatedAt = new Date().toISOString();
    await this.callRepository.save(call);

    // Refleja "en progreso" en el item de campaña (ambos estados cuentan como activos).
    if (call.status === 'in_progress' && this.batchRepository && call.sessionId) {
      const item = await this.batchRepository.findItemBySessionId(call.sessionId);
      if (item && item.status === 'dialing') {
        await this.batchRepository.markItem(item.id, 'in_progress', { callId: call.id });
      }
    }
  }

  // Webhook "fin-de-llamada": trae grabación, transcript y análisis.
  async handleEndOfCall(payload: EndOfCallPayload): Promise<void> {
    const sessionId = payload.session?.id;
    if (!sessionId) {
      return;
    }

    const call = await this.callRepository.findBySessionId(sessionId);
    if (!call) {
      return;
    }

    call.fonemaCallId = payload.id ?? call.fonemaCallId;
    call.status = 'completed';
    call.recordingUrl = payload.recordingURL ?? call.recordingUrl;
    call.detailsUrl = payload.detailsURL ?? call.detailsUrl;
    call.transcript = payload.messages ?? call.transcript;
    call.endedReason = payload.endedReason ?? call.endedReason;
    call.durationSeconds = payload.durationSeconds ?? call.durationSeconds;
    call.summary = payload.analysis?.summary ?? call.summary;
    call.successEvaluation = payload.analysis?.successEvaluation ?? call.successEvaluation;
    call.structuredData = payload.analysis?.structuredData ?? call.structuredData;
    call.updatedAt = new Date().toISOString();

    await this.callRepository.save(call);
    await this.syncBatchItem(call, 'completed');
  }

  // Webhook "fin-de-sesion": se agotaron los reintentos hacia el cliente.
  // Fonema NO envía session.id ni call.id en este evento (solo el teléfono),
  // por lo que aún no es correlacionable de forma fiable con una llamada.
  // La grabación/transcript ya llegan por fin-de-llamada; aquí solo se
  // reconoce el evento. Correlacionar por teléfono requeriría indexar el
  // repositorio por número (pendiente si se necesita este dato).
  async handleEndOfSession(_payload: EndOfSessionPayload): Promise<void> {
    return;
  }

  /**
   * Si la llamada pertenece a una campaña, sincroniza su item: estado terminal,
   * bandera `qualified` (para el handoff a power-apps) y fin. Correlaciona por
   * sessionId (fijado al despachar) y, en su defecto, por callId.
   */
  private async syncBatchItem(call: Call, terminal: 'completed' | 'failed'): Promise<void> {
    if (!this.batchRepository) return;

    const item = call.sessionId
      ? await this.batchRepository.findItemBySessionId(call.sessionId)
      : await this.batchRepository.findItemByCallId(call.id);
    if (!item) return;

    const status = call.status === 'failed' ? 'failed' : terminal;
    await this.batchRepository.markItem(item.id, status, {
      callId: call.id,
      qualified: isCallQualified(call),
      endedAt: new Date().toISOString(),
    });
  }

  private mapStatus(status?: string): CallStatus {
    switch (status) {
      case 'initiated':
        return 'initiated';
      case 'in-progress':
        return 'in_progress';
      default:
        return 'initiated';
    }
  }
}
