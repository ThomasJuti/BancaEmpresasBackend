import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { FollowUpCase } from '../domain/entities.js';
import type { CreateFollowUpCaseInput, FollowUpCaseRepository } from '../domain/repository.js';

const TABLE = 'follow_up_cases';

interface FollowUpCaseRow {
  id: string;
  cliente_id: string;
  case_id: string | null;
  cliente_nombre: string | null;
  telefono: string | null;
  correo: string | null;
  delivered_at: string;
  congratulated_at: string | null;
  congratulation_call_id: string | null;
  last_used_at: string;
  last_reminder_at: string | null;
  reminder_count: number;
}

const SELECT_COLUMNS =
  'id, cliente_id, case_id, cliente_nombre, telefono, correo, delivered_at, ' +
  'congratulated_at, congratulation_call_id, last_used_at, last_reminder_at, reminder_count';

function toEntity(row: FollowUpCaseRow): FollowUpCase {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    caseId: row.case_id,
    clienteNombre: row.cliente_nombre,
    telefono: row.telefono,
    correo: row.correo,
    deliveredAt: row.delivered_at,
    congratulatedAt: row.congratulated_at,
    congratulationCallId: row.congratulation_call_id,
    lastUsedAt: row.last_used_at,
    lastReminderAt: row.last_reminder_at,
    reminderCount: row.reminder_count,
  };
}

export class SupabaseFollowUpCaseRepository implements FollowUpCaseRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(): Promise<FollowUpCase[]> {
    const { data, error } = await this.db.from(TABLE).select(SELECT_COLUMNS).order('created_at');
    if (error) this.fail('consultando', error.message);
    return ((data ?? []) as unknown as FollowUpCaseRow[]).map(toEntity);
  }

  async findByClienteId(clienteId: string): Promise<FollowUpCase | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq('cliente_id', clienteId)
      .maybeSingle();
    if (error) this.fail('consultando', error.message);
    return data ? toEntity(data as unknown as FollowUpCaseRow) : null;
  }

  async create(input: CreateFollowUpCaseInput): Promise<FollowUpCase> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from(TABLE)
      .insert({
        cliente_id: input.clienteId,
        case_id: input.caseId ?? null,
        cliente_nombre: input.clienteNombre ?? null,
        telefono: input.telefono ?? null,
        correo: input.correo ?? null,
        delivered_at: now,
        last_used_at: now,
      })
      .select(SELECT_COLUMNS)
      .single();
    if (error || !data) this.fail('creando caso en', error?.message ?? 'sin datos');
    return toEntity(data as unknown as FollowUpCaseRow);
  }

  async setCongratulation(clienteId: string, callId: string | null): Promise<void> {
    const { error } = await this.db
      .from(TABLE)
      .update({
        congratulated_at: new Date().toISOString(),
        congratulation_call_id: callId,
        updated_at: new Date().toISOString(),
      })
      .eq('cliente_id', clienteId);
    if (error) this.fail('actualizando', error.message);
  }

  async registerUsage(clienteId: string, usedAt: Date): Promise<FollowUpCase | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .update({ last_used_at: usedAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('cliente_id', clienteId)
      .select(SELECT_COLUMNS)
      .maybeSingle();
    if (error) this.fail('actualizando', error.message);
    return data ? toEntity(data as unknown as FollowUpCaseRow) : null;
  }

  async registerReminder(clienteId: string, at: Date): Promise<void> {
    // Lee el contador actual y lo incrementa; el guard isRunning del use case
    // evita ticks solapados, así que no hay carrera práctica en este update.
    const { data, error } = await this.db
      .from(TABLE)
      .select('reminder_count')
      .eq('cliente_id', clienteId)
      .maybeSingle();
    if (error) this.fail('consultando', error.message);

    const { error: updateError } = await this.db
      .from(TABLE)
      .update({
        last_reminder_at: at.toISOString(),
        reminder_count: ((data as { reminder_count: number } | null)?.reminder_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('cliente_id', clienteId);
    if (updateError) this.fail('actualizando', updateError.message);
  }

  private fail(accion: string, detalle: string): never {
    throw new AppError(`Error ${accion} ${TABLE}: ${detalle}`, 502, 'DATABASE_ERROR');
  }
}
