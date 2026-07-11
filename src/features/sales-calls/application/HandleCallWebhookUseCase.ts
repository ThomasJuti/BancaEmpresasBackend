import type { PipelineStageAdvancer } from '../../../shared/contracts/pipeline.js';
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
    // Opcional: avanza el caso a power_apps cuando la llamada califica.
    // Ausente en seed/demo sin pipeline durable.
    private readonly pipeline?: PipelineStageAdvancer,
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
    call.startedAt = payload.startedAt ?? call.startedAt;
    call.durationSeconds = payload.durationSeconds ?? call.durationSeconds;
    // Variables de salida: lo que el agente recolectó/actualizó en la llamada.
    // Se acumulan (merge) para no perder claves de eventos previos.
    if (payload.variableValues) {
      call.outputVariables = { ...call.outputVariables, ...payload.variableValues };
    }
    call.summary = payload.analysis?.summary ?? call.summary;
    call.successEvaluation = payload.analysis?.successEvaluation ?? call.successEvaluation;
    call.structuredData = payload.analysis?.structuredData ?? call.structuredData;
    call.updatedAt = new Date().toISOString();

    await this.callRepository.save(call);
    await this.syncBatchItem(call, 'completed');
    await this.advancePipelineIfQualified(call);
  }

  /**
   * Handoff automático a la Power App: si la llamada cerró CALIFICADA (identidad
   * verificada + interesado) y está correlacionada con un caso del pipeline,
   * avanza pipeline_cases.stage -> 'power_apps' sin intervención manual. El front
   * ya puede consumir GET /calls/{id}/handoff para pre-diligenciar la solicitud.
   *
   * Best-effort: un fallo aquí (o un caso ya avanzado, que el advancer rechaza por
   * no retroceder) no debe romper el webhook — la grabación/resultado ya se guardó.
   */
  private async advancePipelineIfQualified(call: Call): Promise<void> {
    if (!this.pipeline || !call.caseId) return;
    if (!isCallQualified(call)) return;

    try {
      await this.pipeline.advance(call.caseId, 'power_apps');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.warn(`sales-calls: auto-avance a power_apps omitido (caso ${call.caseId}) — ${message}`);
    }
  }

  // Webhook "fin-de-sesion": se agotaron los reintentos hacia el cliente.
  // Fonema NO envía session.id ni call.id (solo el teléfono), así que se
  // correlaciona con la última llamada a ese número. Trae datos de cierre que
  // el fin-de-llamada no tiene (totalAttempts) y el estado final de variables
  // de salida / análisis; se persiste todo para poder consumirlo después.
  async handleEndOfSession(payload: EndOfSessionPayload): Promise<void> {
    const phoneNumber = payload.customer?.phoneNumber;
    if (!phoneNumber) {
      return;
    }

    const call = await this.callRepository.findLatestByPhoneNumber(phoneNumber);
    if (!call) {
      return;
    }

    if (payload.variableValues) {
      call.outputVariables = { ...call.outputVariables, ...payload.variableValues };
    }
    call.totalAttempts = payload.totalAttempts ?? call.totalAttempts;
    call.endedReason = payload.endedReason ?? call.endedReason;
    call.successEvaluation = payload.analysis?.successEvaluation ?? call.successEvaluation;
    call.structuredData = payload.analysis?.structuredData ?? call.structuredData;
    call.updatedAt = new Date().toISOString();

    await this.callRepository.save(call);
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
