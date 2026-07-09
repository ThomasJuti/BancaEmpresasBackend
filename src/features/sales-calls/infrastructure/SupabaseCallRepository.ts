import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { Call, CallStatus, TranscriptMessage } from '../domain/Call.js';
import type { CallRepository } from '../domain/CallRepository.js';

const TABLE = 'calls';

interface CallRow {
  id: string;
  session_id: string | null;
  fonema_call_id: string | null;
  agent_id: string;
  phone_number: string;
  customer_name: string | null;
  customer_email: string | null;
  script: string | null;
  variables: Record<string, string> | null;
  status: CallStatus;
  recording_url: string | null;
  details_url: string | null;
  transcript: TranscriptMessage[] | null;
  summary: string | null;
  ended_reason: string | null;
  duration_seconds: number | null;
  success_evaluation: string | null;
  structured_data: Record<string, unknown> | null;
  total_attempts: number | null;
  batch_item_id: string | null;
  created_at: string;
  updated_at: string;
}

function toDomain(row: CallRow): Call {
  return {
    id: row.id,
    sessionId: row.session_id ?? undefined,
    fonemaCallId: row.fonema_call_id ?? undefined,
    agentId: row.agent_id,
    phoneNumber: row.phone_number,
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    script: row.script ?? undefined,
    variables: row.variables ?? {},
    status: row.status,
    recordingUrl: row.recording_url ?? undefined,
    detailsUrl: row.details_url ?? undefined,
    transcript: row.transcript ?? undefined,
    summary: row.summary ?? undefined,
    endedReason: row.ended_reason ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    successEvaluation: row.success_evaluation ?? undefined,
    structuredData: row.structured_data ?? undefined,
    totalAttempts: row.total_attempts ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(call: Call): Record<string, unknown> {
  // successEvaluation puede ser boolean|string en el dominio; la columna es text.
  const successEvaluation =
    call.successEvaluation === undefined ? null : String(call.successEvaluation);

  return {
    id: call.id,
    session_id: call.sessionId ?? null,
    fonema_call_id: call.fonemaCallId ?? null,
    agent_id: call.agentId,
    phone_number: call.phoneNumber,
    customer_name: call.customerName ?? null,
    customer_email: call.customerEmail ?? null,
    script: call.script ?? null,
    variables: call.variables ?? {},
    status: call.status,
    recording_url: call.recordingUrl ?? null,
    details_url: call.detailsUrl ?? null,
    transcript: call.transcript ?? null,
    summary: call.summary ?? null,
    ended_reason: call.endedReason ?? null,
    duration_seconds: call.durationSeconds ?? null,
    success_evaluation: successEvaluation,
    structured_data: call.structuredData ?? null,
    total_attempts: call.totalAttempts ?? null,
    updated_at: call.updatedAt,
  };
}

function dbError(operation: string, error: { message: string }): AppError {
  console.error(`sales-calls repository: ${operation} failed — ${error.message}`);
  return new AppError('Database operation failed', 500, 'DB_ERROR');
}

/** Persistencia durable de llamadas Fonema (reemplaza InMemoryCallRepository en serverless). */
export class SupabaseCallRepository implements CallRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(call: Call): Promise<void> {
    // upsert por id: initiate crea, los webhooks actualizan la misma fila.
    const { error } = await this.db.from(TABLE).upsert(toRow(call), { onConflict: 'id' });
    if (error) throw dbError('save', error);
  }

  async findAll(): Promise<Call[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select()
      .order('created_at', { ascending: false });
    if (error) throw dbError('findAll', error);
    return (data as CallRow[]).map(toDomain);
  }

  async findById(id: string): Promise<Call | null> {
    const { data, error } = await this.db.from(TABLE).select().eq('id', id).maybeSingle();
    if (error) throw dbError('findById', error);
    return data ? toDomain(data as CallRow) : null;
  }

  async findBySessionId(sessionId: string): Promise<Call | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select()
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) throw dbError('findBySessionId', error);
    return data ? toDomain(data as CallRow) : null;
  }

  async findByFonemaCallId(fonemaCallId: string): Promise<Call | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select()
      .eq('fonema_call_id', fonemaCallId)
      .maybeSingle();
    if (error) throw dbError('findByFonemaCallId', error);
    return data ? toDomain(data as CallRow) : null;
  }
}
