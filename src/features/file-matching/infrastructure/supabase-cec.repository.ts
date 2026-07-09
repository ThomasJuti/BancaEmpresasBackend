import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { CecCliente } from '../domain/entities.js';
import type { CecRepository } from '../domain/repositories.js';

interface CecRow {
  nume_iden: string;
  disponible: number | null;
  lea_aprobado: number | null;
}

export class SupabaseCecRepository implements CecRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findConCupoDisponible(): Promise<CecCliente[]> {
    const { data, error } = await this.supabase
      .from('cec')
      .select('nume_iden, disponible, lea_aprobado')
      .gt('disponible', 0);

    if (error) {
      throw new AppError(`Error consultando cec: ${error.message}`, 502, 'DATABASE_ERROR');
    }

    return (data as CecRow[]).map((row) => ({
      numeIden: row.nume_iden,
      disponible: row.disponible,
      leaAprobado: row.lea_aprobado,
    }));
  }
}
