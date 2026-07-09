import { env } from '../../../infrastructure/config/env.js';
import { getSupabaseClient } from '../../../infrastructure/database/supabase.js';
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
    getRecording: new GetCallRecordingUseCase(callRepository, fonemaGateway),
    handleWebhook: new HandleCallWebhookUseCase(callRepository, batchRepository),
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
