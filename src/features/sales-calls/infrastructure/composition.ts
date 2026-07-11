import { SupabasePipelineStageAdvancer } from '../../../core/pipeline/application/advance-stage.js';
import { SupabasePipelineCaseRepository } from '../../../core/pipeline/infrastructure/supabase-pipeline-case.repository.js';
import { env } from '../../../infrastructure/config/env.js';
import { getSupabaseClient } from '../../../infrastructure/database/supabase.js';
import type {
  FollowUpCallInput,
  FollowUpCallResult,
  FollowUpCallService,
} from '../../../shared/contracts/follow-up-call.js';
import { BuildPowerAppPrefillUseCase } from '../application/BuildPowerAppPrefillUseCase.js';
import { CreateCallBatchUseCase } from '../application/CreateCallBatchUseCase.js';
import { DispatchCallBatchesUseCase } from '../application/DispatchCallBatchesUseCase.js';
import { GetCallBatchUseCase } from '../application/GetCallBatchUseCase.js';
import { GetCallRecordingUseCase } from '../application/GetCallRecordingUseCase.js';
import { GetCallUseCase } from '../application/GetCallUseCase.js';
import { HandleCallWebhookUseCase } from '../application/HandleCallWebhookUseCase.js';
import { InitiateCallUseCase } from '../application/InitiateCallUseCase.js';
import {
  ListBatchItemsUseCase,
  ListCallBatchesUseCase,
} from '../application/ListCallBatchesUseCase.js';
import { ListCallsUseCase } from '../application/ListCallsUseCase.js';
import { RegisterManualCallUseCase } from '../application/RegisterManualCallUseCase.js';
import { SetBatchStatusUseCase } from '../application/SetBatchStatusUseCase.js';
import type { CallBatchRepository } from '../domain/CallBatchRepository.js';
import type { CallRepository } from '../domain/CallRepository.js';
import type { FonemaGateway } from '../domain/FonemaGateway.js';
import { FonemaHttpGateway } from './FonemaHttpGateway.js';
import { SupabaseCallBatchRepository } from './SupabaseCallBatchRepository.js';
import { SupabaseCallRepository } from './SupabaseCallRepository.js';

export interface SalesCallsDeps {
  callRepository: CallRepository;
  batchRepository: CallBatchRepository;
  fonemaGateway: FonemaGateway;
  initiateCall: InitiateCallUseCase;
  getCall: GetCallUseCase;
  listCalls: ListCallsUseCase;
  registerManualCall: RegisterManualCallUseCase;
  getRecording: GetCallRecordingUseCase;
  handleWebhook: HandleCallWebhookUseCase;
  createBatch: CreateCallBatchUseCase;
  dispatchBatches: DispatchCallBatchesUseCase;
  getBatch: GetCallBatchUseCase;
  listBatches: ListCallBatchesUseCase;
  listBatchItems: ListBatchItemsUseCase;
  setBatchStatus: SetBatchStatusUseCase;
  buildPrefill: BuildPowerAppPrefillUseCase;
}

let deps: SalesCallsDeps | null = null;

/**
 * Construye (una sola vez) las dependencias durables de sales-calls.
 * Lanza un error claro si falta configuración (Supabase o Fonema).
 */
export function getSalesCallsDeps(): SalesCallsDeps {
  if (deps) return deps;

  if (!env.fonema.apiUrl || !env.fonema.apiKey || !env.fonema.salesAgentId) {
    throw new Error(
      'Fonema no está configurado. Set FONEMA_API_URL, FONEMA_API_KEY y FONEMA_SALES_AGENT_ID.',
    );
  }

  const db = getSupabaseClient();
  const callRepository = new SupabaseCallRepository(db);
  const batchRepository = new SupabaseCallBatchRepository(db);
  const pipelineCases = new SupabasePipelineCaseRepository(db);
  const pipelineAdvancer = new SupabasePipelineStageAdvancer(db);
  const fonemaGateway = new FonemaHttpGateway(env.fonema.apiUrl, env.fonema.apiKey);
  const initiateCall = new InitiateCallUseCase(
    fonemaGateway,
    callRepository,
    env.fonema.salesAgentId,
  );

  deps = {
    callRepository,
    batchRepository,
    fonemaGateway,
    initiateCall,
    getCall: new GetCallUseCase(callRepository),
    listCalls: new ListCallsUseCase(callRepository),
    registerManualCall: new RegisterManualCallUseCase(
      callRepository,
      pipelineCases,
      pipelineAdvancer,
    ),
    getRecording: new GetCallRecordingUseCase(callRepository, fonemaGateway),
    handleWebhook: new HandleCallWebhookUseCase(
      callRepository,
      batchRepository,
      pipelineAdvancer,
    ),
    createBatch: new CreateCallBatchUseCase(batchRepository, env.fonema.salesAgentId),
    dispatchBatches: new DispatchCallBatchesUseCase(batchRepository, initiateCall),
    getBatch: new GetCallBatchUseCase(batchRepository),
    listBatches: new ListCallBatchesUseCase(batchRepository),
    listBatchItems: new ListBatchItemsUseCase(batchRepository),
    setBatchStatus: new SetBatchStatusUseCase(batchRepository),
    buildPrefill: new BuildPowerAppPrefillUseCase(callRepository),
  };

  return deps;
}

/**
 * Implementación del contrato FollowUpCallService (shared/contracts) para que
 * activation-follow-up dispare llamadas del agente de seguimiento sin importar
 * internals de esta feature. Usa FONEMA_FOLLOWUP_API_KEY + FONEMA_FOLLOWUP_AGENT_ID
 * (cuenta/agente distintos a ventas) y persiste en la misma tabla `calls`
 * (visible en /llamadas y cerrada por los mismos webhooks). Construcción
 * perezosa: valida config en la primera llamada, no al arrancar.
 */
class FonemaFollowUpCallService implements FollowUpCallService {
  private initiateCall: InitiateCallUseCase | null = null;

  async initiate(input: FollowUpCallInput): Promise<FollowUpCallResult> {
    const call = await this.getUseCase().execute({
      phoneNumber: input.phoneNumber,
      customerName: input.customerName,
      caseId: input.caseId,
      variables: {
        ...input.variables,
        tipo_llamada: input.tipo,
        nit: input.nit,
      },
    });
    return { callId: call.id };
  }

  private getUseCase(): InitiateCallUseCase {
    if (this.initiateCall) return this.initiateCall;

    if (!env.fonema.apiUrl || !env.fonema.followUpApiKey || !env.fonema.followUpAgentId) {
      throw new Error(
        'Agente de seguimiento Fonema no configurado. Set FONEMA_API_URL, FONEMA_FOLLOWUP_API_KEY y FONEMA_FOLLOWUP_AGENT_ID.',
      );
    }

    this.initiateCall = new InitiateCallUseCase(
      new FonemaHttpGateway(env.fonema.apiUrl, env.fonema.followUpApiKey),
      new SupabaseCallRepository(getSupabaseClient()),
      env.fonema.followUpAgentId,
    );
    return this.initiateCall;
  }
}

let followUpCallService: FollowUpCallService | null = null;

/** Punto de acceso para el composition root (src/routes.ts). */
export function getFollowUpCallService(): FollowUpCallService {
  if (!followUpCallService) {
    followUpCallService = new FonemaFollowUpCallService();
  }
  return followUpCallService;
}
