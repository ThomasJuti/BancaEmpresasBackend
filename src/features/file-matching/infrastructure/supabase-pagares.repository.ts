import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { PagaresRepository } from '../domain/repositories.js';
import { chunk } from './chunk.js';

const IN_CHUNK_SIZE = 200;
const ESTADO_PAGARE_ACTIVO = 'ACTIVO';

export class SupabasePagaresRepository implements PagaresRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findIdsConPagareActivo(identificaciones: string[]): Promise<Set<string>> {
    const idsConPagare = new Set<string>();

    for (const ids of chunk(identificaciones, IN_CHUNK_SIZE)) {
      const { data, error } = await this.supabase
        .from('clientes_potenciales_grabar')
        .select('identificacion')
        .in('identificacion', ids)
        .eq('estado', ESTADO_PAGARE_ACTIVO);

      if (error) {
        throw new AppError(
          `Error consultando clientes_potenciales_grabar: ${error.message}`,
          502,
          'DATABASE_ERROR',
        );
      }

      for (const row of data as { identificacion: string }[]) {
        idsConPagare.add(row.identificacion);
      }
    }

    return idsConPagare;
  }
}
