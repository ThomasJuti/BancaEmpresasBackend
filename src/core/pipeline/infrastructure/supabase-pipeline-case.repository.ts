import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { PipelineStage } from '../../../shared/contracts/pipeline.js';
import type { PipelineCaseRecord, PipelineCaseRepository } from '../domain/pipeline-case.repository.js';
import { normalizeLeadId } from '../domain/normalize-lead-id.js';

interface PipelineCaseRow {
  id: string;
  lead_id: string;
  stage: PipelineStage;
  created_at: string;
  updated_at: string;
}

export class SupabasePipelineCaseRepository implements PipelineCaseRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByLeadId(leadId: string): Promise<PipelineCaseRecord | null> {
    const candidates = [...new Set([leadId.trim(), normalizeLeadId(leadId)].filter(Boolean))];

    for (const candidate of candidates) {
      const found = await this.findByLeadIdExact(candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  async ensureByLeadId(leadId: string): Promise<PipelineCaseRecord> {
    const existing = await this.findByLeadId(leadId);
    if (existing) {
      return existing;
    }

    const canonicalLeadId = normalizeLeadId(leadId);

    const { data, error } = await this.db
      .from('pipeline_cases')
      .insert({ lead_id: canonicalLeadId, stage: 'file_matching' })
      .select('id, lead_id, stage, created_at, updated_at')
      .single();

    if (error) {
      throw new AppError(`Error creando pipeline_cases: ${error.message}`, 502, 'DATABASE_ERROR');
    }

    return this.toRecord(data as PipelineCaseRow);
  }

  private async findByLeadIdExact(leadId: string): Promise<PipelineCaseRecord | null> {
    const { data, error } = await this.db
      .from('pipeline_cases')
      .select('id, lead_id, stage, created_at, updated_at')
      .eq('lead_id', leadId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(`Error consultando pipeline_cases: ${error.message}`, 502, 'DATABASE_ERROR');
    }

    if (!data) {
      return null;
    }

    return this.toRecord(data as PipelineCaseRow);
  }

  private toRecord(row: PipelineCaseRow): PipelineCaseRecord {
    return {
      id: row.id,
      leadId: row.lead_id,
      stage: row.stage,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
