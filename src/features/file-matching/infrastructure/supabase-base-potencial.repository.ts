import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { BasePotencialCliente } from '../domain/entities.js';
import type { BasePotencialRepository } from '../domain/repositories.js';
import { chunk } from './chunk.js';

const IN_CHUNK_SIZE = 200;

/**
 * Segmentos objetivo del cruce. En base_potencial, la columna "direccion" no es
 * una dirección postal sino el segmento del cliente (Pequeña / Mediana /
 * Empresarial / Corporativo / Gobierno / Pyme No Gestionable). Solo se gestionan
 * los tres primeros. Deben coincidir exactamente con los valores del Excel (acentos incluidos).
 */
const SEGMENTOS_OBJETIVO = ['Pequeña', 'Mediana', 'Empresarial'];

interface BasePotencialRow {
  cliente_id: string;
  cliente_nombre: string | null;
  ciudad: string | null;
  subsegmento: string | null;
  correo: string | null;
  telefono: string | null;
}

export class SupabaseBasePotencialRepository implements BasePotencialRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findGestionablesSinTarjeta(clienteIds: string[]): Promise<BasePotencialCliente[]> {
    const clientes: BasePotencialCliente[] = [];

    for (const ids of chunk(clienteIds, IN_CHUNK_SIZE)) {
      const { data, error } = await this.supabase
        .from('base_potencial')
        .select('cliente_id, cliente_nombre, ciudad, subsegmento, correo, telefono')
        .in('cliente_id', ids)
        .eq('cliente_gestionable', 'Gestionable')
        .eq('producto_tc', 'SIN TC')
        .in('direccion', SEGMENTOS_OBJETIVO);

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
          correo: row.correo,
          telefono: row.telefono,
        });
      }
    }

    return clientes;
  }
}
