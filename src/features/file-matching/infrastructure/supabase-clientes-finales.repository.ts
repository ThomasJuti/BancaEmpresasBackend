import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { ClienteFinal } from '../domain/entities.js';
import type {
  ClientesFinalesPageQuery,
  ClientesFinalesPageResult,
  ClientesFinalesRepository,
} from '../domain/repositories.js';
import { chunk } from './chunk.js';

const INSERT_BATCH_SIZE = 500;

export type TablaClientesFinales = 'clientes_finales' | 'clientes_finales_sin_pagare';

interface ClienteFinalRow {
  cliente_id: string;
  nombre: string | null;
  ciudad: string | null;
  subsegmento: string | null;
  cupo_disponible: number | null;
  lea_aprobado: number | null;
}

export class SupabaseClientesFinalesRepository implements ClientesFinalesRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tabla: TablaClientesFinales,
  ) {}

  async replaceAll(clientes: ClienteFinal[]): Promise<void> {
    const { error: deleteError } = await this.supabase.from(this.tabla).delete().gte('id', 0);
    if (deleteError) {
      throw new AppError(
        `Error limpiando ${this.tabla}: ${deleteError.message}`,
        502,
        'DATABASE_ERROR',
      );
    }

    const rows: ClienteFinalRow[] = clientes.map((cliente) => ({
      cliente_id: cliente.clienteId,
      nombre: cliente.nombre,
      ciudad: cliente.ciudad,
      subsegmento: cliente.subsegmento,
      cupo_disponible: cliente.cupoDisponible,
      lea_aprobado: cliente.leaAprobado,
    }));

    for (const batch of chunk(rows, INSERT_BATCH_SIZE)) {
      const { error } = await this.supabase.from(this.tabla).insert(batch);
      if (error) {
        throw new AppError(
          `Error insertando en ${this.tabla}: ${error.message}`,
          502,
          'DATABASE_ERROR',
        );
      }
    }
  }

  async findAll(): Promise<ClienteFinal[]> {
    const { data, error } = await this.supabase
      .from(this.tabla)
      .select('cliente_id, nombre, ciudad, subsegmento, cupo_disponible, lea_aprobado')
      .order('cliente_id');

    if (error) {
      throw new AppError(
        `Error consultando ${this.tabla}: ${error.message}`,
        502,
        'DATABASE_ERROR',
      );
    }

    return (data as ClienteFinalRow[]).map((row) => this.toEntity(row));
  }

  async findPage(query: ClientesFinalesPageQuery): Promise<ClientesFinalesPageResult> {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(50, Math.max(1, query.limit));
    const offset = (page - 1) * pageSize;

    let builder = this.supabase
      .from(this.tabla)
      .select('cliente_id, nombre, ciudad, subsegmento, cupo_disponible, lea_aprobado', {
        count: 'exact',
      })
      .order('cliente_id');

    const search = query.search?.trim();
    if (search) {
      const safeSearch = search.replace(/,/g, '').replace(/[%_\\]/g, '\\$&');
      const pattern = `%${safeSearch}%`;
      builder = builder.or(`nombre.ilike.${pattern},cliente_id.ilike.${pattern}`);
    }

    const { data, error, count } = await builder.range(offset, offset + pageSize - 1);

    if (error) {
      throw new AppError(
        `Error consultando ${this.tabla}: ${error.message}`,
        502,
        'DATABASE_ERROR',
      );
    }

    return {
      total: count ?? 0,
      page,
      pageSize,
      clientes: (data as ClienteFinalRow[]).map((row) => this.toEntity(row)),
    };
  }

  async findByClienteId(clienteId: string): Promise<ClienteFinal | null> {
    const { data, error } = await this.supabase
      .from(this.tabla)
      .select('cliente_id, nombre, ciudad, subsegmento, cupo_disponible, lea_aprobado')
      .eq('cliente_id', clienteId)
      .maybeSingle();

    if (error) {
      throw new AppError(
        `Error consultando ${this.tabla}: ${error.message}`,
        502,
        'DATABASE_ERROR',
      );
    }

    if (!data) {
      return null;
    }

    return this.toEntity(data as ClienteFinalRow);
  }

  private toEntity(row: ClienteFinalRow): ClienteFinal {
    return {
      clienteId: row.cliente_id,
      nombre: row.nombre,
      ciudad: row.ciudad,
      subsegmento: row.subsegmento,
      cupoDisponible: row.cupo_disponible,
      leaAprobado: row.lea_aprobado,
    };
  }
}
