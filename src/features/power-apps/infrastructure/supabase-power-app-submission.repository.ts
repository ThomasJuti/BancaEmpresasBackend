import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeLeadId } from '../../../core/pipeline/domain/normalize-lead-id.js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type {
  PowerAppSubmissionRecord,
  PowerAppSubmissionRepository,
  SavePowerAppSubmissionInput,
} from '../domain/power-app-submission.repository.js';
import type { PowerAppDecision, ValidationIssue } from '../domain/validation-issue.js';

interface PowerAppSubmissionRow {
  id: string;
  case_id: string;
  lead_id: string;
  radicado: string | null;
  decision: PowerAppDecision;
  valid: boolean;
  summary: string | null;
  siguiente_paso: string | null;
  payload: PowerAppSubmissionRecord['payload'];
  issues: ValidationIssue[];
  attachment_names: string[];
  documento_origen: 'RUES' | 'MANUAL' | null;
  rues_solicitud_id: string | null;
  submitted_at: string;
}

export class SupabasePowerAppSubmissionRepository implements PowerAppSubmissionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(input: SavePowerAppSubmissionInput): Promise<PowerAppSubmissionRecord> {
    const { data, error } = await this.db
      .from('power_app_submissions')
      .insert({
        case_id: input.caseId,
        lead_id: input.leadId,
        radicado: input.radicado,
        decision: input.decision,
        valid: input.valid,
        summary: input.summary,
        siguiente_paso: input.siguientePaso,
        payload: input.payload,
        issues: input.issues,
        attachment_names: input.attachmentNames,
        documento_origen: input.documentoOrigen ?? null,
        rues_solicitud_id: input.ruesSolicitudId ?? null,
        submitted_at: input.submittedAt,
      })
      .select(
        'id, case_id, lead_id, radicado, decision, valid, summary, siguiente_paso, payload, issues, attachment_names, documento_origen, rues_solicitud_id, submitted_at',
      )
      .single();

    if (error) {
      throw new AppError(`Error guardando power_app_submissions: ${error.message}`, 502, 'DATABASE_ERROR');
    }

    return this.toRecord(data as PowerAppSubmissionRow);
  }

  async findLatestByLeadId(leadId: string): Promise<PowerAppSubmissionRecord | null> {
    const candidates = [...new Set([leadId.trim(), normalizeLeadId(leadId)].filter(Boolean))];

    for (const candidate of candidates) {
      const found = await this.findLatestByLeadIdExact(candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private async findLatestByLeadIdExact(leadId: string): Promise<PowerAppSubmissionRecord | null> {
    const { data, error } = await this.db
      .from('power_app_submissions')
      .select(
        'id, case_id, lead_id, radicado, decision, valid, summary, siguiente_paso, payload, issues, attachment_names, documento_origen, rues_solicitud_id, submitted_at',
      )
      .eq('lead_id', leadId)
      .eq('valid', true)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(`Error consultando power_app_submissions: ${error.message}`, 502, 'DATABASE_ERROR');
    }

    if (!data) {
      return null;
    }

    return this.toRecord(data as PowerAppSubmissionRow);
  }

  private toRecord(row: PowerAppSubmissionRow): PowerAppSubmissionRecord {
    return {
      id: row.id,
      caseId: row.case_id,
      leadId: row.lead_id,
      radicado: row.radicado,
      decision: row.decision,
      valid: row.valid,
      summary: row.summary ?? '',
      siguientePaso: row.siguiente_paso,
      payload: row.payload,
      issues: row.issues ?? [],
      attachmentNames: row.attachment_names ?? [],
      documentoOrigen: row.documento_origen ?? undefined,
      ruesSolicitudId: row.rues_solicitud_id ?? undefined,
      submittedAt: row.submitted_at,
    };
  }
}
