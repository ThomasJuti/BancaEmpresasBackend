import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DeliveryConfirmationRepository,
  ManagerDirectory,
} from '../domain/repository.js';
import type {
  CompanyManager,
  DeliveryConfirmationCase,
  DeliveryConfirmationOutcome,
  DeliveryEmailAttempt,
  NewDeliveryConfirmationCase,
} from '../domain/types.js';
import { AppError } from '../../../shared/exceptions/app-error.js';

const CASES_TABLE = 'delivery_confirmation_cases';
const EMAILS_TABLE = 'delivery_confirmation_emails';
const MANAGERS_TABLE = 'company_managers';

interface CaseRow {
  id: string;
  case_id: string;
  card_id: string;
  company_id: string;
  card_holder_name: string;
  card_last_four: string;
  status: DeliveryConfirmationCase['status'];
  outcome: DeliveryConfirmationOutcome | null;
  physical_shipped_at: string;
  email_scheduled_at: string;
  sent_at: string | null;
  confirmed_at: string | null;
  attempt_count: number;
}

function toDomain(row: CaseRow): DeliveryConfirmationCase {
  return {
    id: row.id,
    caseId: row.case_id,
    cardId: row.card_id,
    companyId: row.company_id,
    cardHolderName: row.card_holder_name,
    cardLastFour: row.card_last_four,
    status: row.status,
    outcome: row.outcome ?? undefined,
    physicalShippedAt: row.physical_shipped_at,
    emailScheduledAt: row.email_scheduled_at,
    sentAt: row.sent_at ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    attemptCount: row.attempt_count,
  };
}

function dbError(operation: string, error: { message: string }): AppError {
  console.error(`delivery-confirmation repository: ${operation} failed — ${error.message}`);
  return new AppError('Database operation failed', 500, 'DB_ERROR');
}

export class SupabaseDeliveryConfirmationRepository implements DeliveryConfirmationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(data: NewDeliveryConfirmationCase): Promise<DeliveryConfirmationCase> {
    const { data: row, error } = await this.db
      .from(CASES_TABLE)
      .insert({
        case_id: data.caseId,
        card_id: data.cardId,
        company_id: data.companyId,
        card_holder_name: data.cardHolderName,
        card_last_four: data.cardLastFour,
        physical_shipped_at: data.physicalShippedAt,
        email_scheduled_at: data.emailScheduledAt,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('A delivery case already exists for this card', 409, 'DUPLICATE_CARD');
      }
      throw dbError('create', error);
    }
    return toDomain(row as CaseRow);
  }

  async findById(id: string): Promise<DeliveryConfirmationCase | null> {
    const { data: row, error } = await this.db
      .from(CASES_TABLE)
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw dbError('findById', error);
    return row ? toDomain(row as CaseRow) : null;
  }

  async findByCaseId(caseId: string): Promise<DeliveryConfirmationCase | null> {
    const { data: row, error } = await this.db
      .from(CASES_TABLE)
      .select()
      .eq('case_id', caseId)
      .maybeSingle();

    if (error) throw dbError('findByCaseId', error);
    return row ? toDomain(row as CaseRow) : null;
  }

  async findDue(now: Date): Promise<DeliveryConfirmationCase[]> {
    const { data: rows, error } = await this.db
      .from(CASES_TABLE)
      .select()
      .in('status', ['scheduled', 'retry_scheduled'])
      .lte('email_scheduled_at', now.toISOString());

    if (error) throw dbError('findDue', error);
    return (rows as CaseRow[]).map(toDomain);
  }

  async markSent(id: string, sentAt: Date): Promise<void> {
    const { data: row, error: readError } = await this.db
      .from(CASES_TABLE)
      .select('attempt_count')
      .eq('id', id)
      .single();

    if (readError) throw dbError('markSent(read)', readError);

    const { error } = await this.db
      .from(CASES_TABLE)
      .update({
        status: 'awaiting_confirmation',
        sent_at: sentAt.toISOString(),
        attempt_count: (row.attempt_count as number) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw dbError('markSent', error);
  }

  async confirm(
    id: string,
    outcome: DeliveryConfirmationOutcome,
    confirmedAt: Date,
  ): Promise<void> {
    const { error } = await this.db
      .from(CASES_TABLE)
      .update({
        status: 'confirmed',
        outcome,
        confirmed_at: confirmedAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw dbError('confirm', error);
  }

  async scheduleRetry(
    id: string,
    outcome: DeliveryConfirmationOutcome,
    nextEmailAt: Date,
  ): Promise<void> {
    const { error } = await this.db
      .from(CASES_TABLE)
      .update({
        status: 'retry_scheduled',
        outcome,
        email_scheduled_at: nextEmailAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw dbError('scheduleRetry', error);
  }

  async recordEmailAttempt(attempt: DeliveryEmailAttempt): Promise<void> {
    const { error } = await this.db.from(EMAILS_TABLE).insert({
      delivery_case_id: attempt.deliveryCaseId,
      manager_email: attempt.managerEmail,
      provider_message_id: attempt.providerMessageId ?? null,
      token_hash: attempt.tokenHash,
      status: 'sent',
    });

    if (error) throw dbError('recordEmailAttempt', error);
  }

  async findEmailAttemptByTokenHash(
    tokenHash: string,
  ): Promise<{ deliveryCaseId: string; managerEmail: string; status: string } | null> {
    const { data: row, error } = await this.db
      .from(EMAILS_TABLE)
      .select('delivery_case_id, manager_email, status')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error) throw dbError('findEmailAttemptByTokenHash', error);
    if (!row) return null;

    return {
      deliveryCaseId: row.delivery_case_id as string,
      managerEmail: row.manager_email as string,
      status: row.status as string,
    };
  }

  async markTokenUsed(tokenHash: string): Promise<void> {
    const { error } = await this.db
      .from(EMAILS_TABLE)
      .update({ status: 'used' })
      .eq('token_hash', tokenHash);

    if (error) throw dbError('markTokenUsed', error);
  }
}

export class SupabaseManagerDirectory implements ManagerDirectory {
  constructor(private readonly db: SupabaseClient) {}

  async findByCompanyId(companyId: string): Promise<CompanyManager[]> {
    const { data: rows, error } = await this.db
      .from(MANAGERS_TABLE)
      .select('name, email')
      .eq('company_id', companyId);

    if (error) throw dbError('findByCompanyId', error);
    return (rows ?? []) as CompanyManager[];
  }
}

/**
 * ATAJO DE DEMO — no es la lógica correcta. El destinatario del correo debería
 * ser el gerente de la empresa (company_managers), no el contacto del lead.
 * Para la demo tomamos el correo directamente de clientes_finales (columna
 * `correo`), cruzando por el NIT (`cliente_id` = companyId). Reemplazar por
 * SupabaseManagerDirectory cuando company_managers esté poblado.
 */
export class ClientesFinalesManagerDirectory implements ManagerDirectory {
  constructor(private readonly db: SupabaseClient) {}

  async findByCompanyId(companyId: string): Promise<CompanyManager[]> {
    const { data: rows, error } = await this.db
      .from('clientes_finales')
      .select('nombre, correo')
      .eq('cliente_id', companyId);

    if (error) throw dbError('findByCompanyId(clientes_finales)', error);

    return (rows ?? [])
      .filter((row) => typeof row.correo === 'string' && row.correo.trim() !== '')
      .map((row) => ({
        name: (row.nombre as string | null) ?? 'Contacto',
        email: (row.correo as string).trim(),
      }));
  }
}
