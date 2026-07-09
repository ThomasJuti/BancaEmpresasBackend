import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { BasePotencialCliente } from '../domain/entities.js';
import type { BasePotencialRepository } from '../domain/repositories.js';
import { chunk } from './chunk.js';

const IN_CHUNK_SIZE = 200;

interface BasePotencialRow {
  cliente_id: string;
  cliente_nombre: string | null;
  ciudad: string | null;
  subsegmento: string | null;
}

export class SupabaseBasePotencialRepository implements BasePotencialRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findGestionablesSinTarjeta(clienteIds: string[]): Promise<BasePotencialCliente[]> {
    const clientes: BasePotencialCliente[] = [];

    for (const ids of chunk(clienteIds, IN_CHUNK_SIZE)) {
      const { data, error } = await this.supabase
        .from('base_potencial')
        .select('cliente_id, cliente_nombre, ciudad, subsegmento')
        .in('cliente_id', ids)
        .eq('cliente_gestionable', 'Gestionable')
        .eq('producto_tc', 'SIN TC');

      if (error) {
        throw new AppError(
          `Error consultando base_potencial: ${error.message}`,
          502,
          'DATABASE_ERROR',
        );
      }

      for (const row of data as BasePotencialRow[]) {
        clientes.push({
          clienteId: row.cliente_id,
          clienteNombre: row.cliente_nombre,
          ciudad: row.ciudad,
          subsegmento: row.subsegmento,
        });
      }
    }

    return clientes;
  }
}
