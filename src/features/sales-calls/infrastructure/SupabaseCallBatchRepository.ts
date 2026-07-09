import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type {
  BatchCounts,
  BatchItemStatus,
  BatchStatus,
  BusinessHours,
  CallBatch,
  CallBatchItem,
  NewBatchLead,
  NewCallBatch,
  PacingPolicy,
} from '../domain/CallBatch.js';
import type {
  BatchItemPatch,
  CallBatchRepository,
} from '../domain/CallBatchRepository.js';

const BATCHES_TABLE = 'call_batches';
const ITEMS_TABLE = 'call_batch_items';

interface BatchRow {
  id: string;
  name: string;
  agent_id: string;
  status: BatchStatus;
  max_concurrent: number;
  per_hour: number;
  window_earliest_at: string | null;
  window_latest_at: string | null;
  business_hours: BusinessHours | null;
  timezone: string;
  default_variables: Record<string, string> | null;
  total: number;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  batch_id: string;
  lead_id: string;
  phone_number: string;
  customer_name: string | null;
  customer_email: string | null;
  variables: Record<string, string> | null;
  status: BatchItemStatus;
  call_id: string | null;
  session_id: string | null;
  qualified: boolean | null;
  attempts: number;
  last_error: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

function batchToDomain(row: BatchRow): CallBatch {
  const pacing: PacingPolicy = {
    maxConcurrent: row.max_concurrent,
    perHour: row.per_hour,
    earliestAt: row.window_earliest_at ?? undefined,
    latestAt: row.window_latest_at ?? undefined,
    businessHours: row.business_hours ?? undefined,
    timezone: row.timezone,
  };
  return {
    id: row.id,
    name: row.name,
    agentId: row.agent_id,
    status: row.status,
    pacing,
    defaultVariables: row.default_variables ?? {},
    total: row.total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function itemToDomain(row: ItemRow): CallBatchItem {
  return {
    id: row.id,
    batchId: row.batch_id,
    leadId: row.lead_id,
    phoneNumber: row.phone_number,
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    variables: row.variables ?? {},
    status: row.status,
    callId: row.call_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    qualified: row.qualified ?? undefined,
    attempts: row.attempts,
    lastError: row.last_error ?? undefined,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Dedupe de leads por leadId conservando el primero (idempotencia de entrada). */
function dedupeLeads(leads: NewBatchLead[]): NewBatchLead[] {
  const seen = new Set<string>();
  const unique: NewBatchLead[] = [];
  for (const lead of leads) {
    if (seen.has(lead.leadId)) continue;
    seen.add(lead.leadId);
    unique.push(lead);
  }
  return unique;
}

function dbError(operation: string, error: { message: string }): AppError {
  console.error(`call-batch repository: ${operation} failed — ${error.message}`);
  return new AppError('Database operation failed', 500, 'DB_ERROR');
}

export class SupabaseCallBatchRepository implements CallBatchRepository {
  constructor(private readonly db: SupabaseClient) {}

  async createBatch(data: NewCallBatch): Promise<CallBatch> {
    const leads = dedupeLeads(data.leads);

    const { data: batchRow, error } = await this.db
      .from(BATCHES_TABLE)
      .insert({
        name: data.name,
        agent_id: data.agentId,
        status: 'running',
        max_concurrent: data.pacing.maxConcurrent,
        per_hour: data.pacing.perHour,
        window_earliest_at: data.pacing.earliestAt ?? null,
        window_latest_at: data.pacing.latestAt ?? null,
        business_hours: data.pacing.businessHours ?? null,
        timezone: data.pacing.timezone,
        default_variables: data.defaultVariables,
        total: leads.length,
      })
      .select()
      .single();

    if (error) throw dbError('createBatch', error);
    const batch = batchToDomain(batchRow as BatchRow);

    if (leads.length > 0) {
      const { error: itemsError } = await this.db.from(ITEMS_TABLE).insert(
        leads.map((lead) => ({
          batch_id: batch.id,
          lead_id: lead.leadId,
          phone_number: lead.phoneNumber,
          customer_name: lead.customerName ?? null,
          customer_email: lead.customerEmail ?? null,
          variables: lead.variables ?? {},
          status: 'queued',
        })),
      );
      if (itemsError) throw dbError('createBatch(items)', itemsError);
    }

    return batch;
  }

  async findBatchById(id: string): Promise<CallBatch | null> {
    const { data, error } = await this.db.from(BATCHES_TABLE).select().eq('id', id).maybeSingle();
    if (error) throw dbError('findBatchById', error);
    return data ? batchToDomain(data as BatchRow) : null;
  }

  async listBatches(): Promise<CallBatch[]> {
    const { data, error } = await this.db
      .from(BATCHES_TABLE)
      .select()
      .order('created_at', { ascending: false });
    if (error) throw dbError('listBatches', error);
    return (data as BatchRow[]).map(batchToDomain);
  }

  async updateBatchStatus(id: string, status: BatchStatus): Promise<void> {
    const { error } = await this.db
      .from(BATCHES_TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw dbError('updateBatchStatus', error);
  }

  async findRunningBatches(): Promise<CallBatch[]> {
    const { data, error } = await this.db
      .from(BATCHES_TABLE)
      .select()
      .eq('status', 'running')
      .order('created_at', { ascending: true });
    if (error) throw dbError('findRunningBatches', error);
    return (data as BatchRow[]).map(batchToDomain);
  }

  async listItems(batchId: string): Promise<CallBatchItem[]> {
    const { data, error } = await this.db
      .from(ITEMS_TABLE)
      .select()
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    if (error) throw dbError('listItems', error);
    return (data as ItemRow[]).map(itemToDomain);
  }

  async countByStatus(batchId: string): Promise<BatchCounts> {
    const items = await this.listItems(batchId);
    const counts: BatchCounts = {
      queued: 0,
      dialing: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      total: items.length,
    };
    for (const item of items) {
      counts[item.status] += 1;
    }
    return counts;
  }

  async countActive(batchId: string): Promise<number> {
    return this.countByStatuses(batchId, ['dialing', 'in_progress']);
  }

  async countByStatuses(batchId: string, statuses: BatchItemStatus[]): Promise<number> {
    const { count, error } = await this.db
      .from(ITEMS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .in('status', statuses);
    if (error) throw dbError('countByStatuses', error);
    return count ?? 0;
  }

  async countStartedSince(batchId: string, since: Date): Promise<number> {
    const { count, error } = await this.db
      .from(ITEMS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .gte('started_at', since.toISOString());
    if (error) throw dbError('countStartedSince', error);
    return count ?? 0;
  }

  async claimQueued(batchId: string, limit: number): Promise<CallBatchItem[]> {
    if (limit <= 0) return [];

    // 1) candidatos en cola (orden estable por creación).
    const { data: candidates, error: selError } = await this.db
      .from(ITEMS_TABLE)
      .select('id')
      .eq('batch_id', batchId)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (selError) throw dbError('claimQueued(select)', selError);

    const ids = (candidates as { id: string }[]).map((c) => c.id);
    if (ids.length === 0) return [];

    // 2) claim atómico: solo transiciona los que SIGUEN en cola (guard anti doble-tick).
    const now = new Date().toISOString();
    const { data: claimed, error: updError } = await this.db
      .from(ITEMS_TABLE)
      .update({ status: 'dialing', started_at: now, updated_at: now })
      .in('id', ids)
      .eq('status', 'queued')
      .select();
    if (updError) throw dbError('claimQueued(update)', updError);

    return (claimed as ItemRow[]).map(itemToDomain);
  }

  async findItemById(id: string): Promise<CallBatchItem | null> {
    const { data, error } = await this.db.from(ITEMS_TABLE).select().eq('id', id).maybeSingle();
    if (error) throw dbError('findItemById', error);
    return data ? itemToDomain(data as ItemRow) : null;
  }

  async findItemByCallId(callId: string): Promise<CallBatchItem | null> {
    const { data, error } = await this.db
      .from(ITEMS_TABLE)
      .select()
      .eq('call_id', callId)
      .maybeSingle();
    if (error) throw dbError('findItemByCallId', error);
    return data ? itemToDomain(data as ItemRow) : null;
  }

  async findItemBySessionId(sessionId: string): Promise<CallBatchItem | null> {
    const { data, error } = await this.db
      .from(ITEMS_TABLE)
      .select()
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) throw dbError('findItemBySessionId', error);
    return data ? itemToDomain(data as ItemRow) : null;
  }

  async markItem(itemId: string, status: BatchItemStatus, patch?: BatchItemPatch): Promise<void> {
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (patch?.callId !== undefined) update.call_id = patch.callId;
    if (patch?.sessionId !== undefined) update.session_id = patch.sessionId;
    if (patch?.qualified !== undefined) update.qualified = patch.qualified;
    if (patch?.lastError !== undefined) update.last_error = patch.lastError;
    if (patch?.startedAt !== undefined) update.started_at = patch.startedAt;
    if (patch?.endedAt !== undefined) update.ended_at = patch.endedAt;

    if (patch?.incrementAttempts) {
      const { data: row, error: readError } = await this.db
        .from(ITEMS_TABLE)
        .select('attempts')
        .eq('id', itemId)
        .single();
      if (readError) throw dbError('markItem(read attempts)', readError);
      update.attempts = ((row.attempts as number) ?? 0) + 1;
    }

    const { error } = await this.db.from(ITEMS_TABLE).update(update).eq('id', itemId);
    if (error) throw dbError('markItem', error);
  }
}
