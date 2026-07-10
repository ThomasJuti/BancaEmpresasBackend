import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { ClienteFinal, EmpresaRues } from '../domain/entities.js';
import type {
  ClientesFinalesPageQuery,
  ClientesFinalesPageResult,
  ClientesFinalesRepository,
} from '../domain/repositories.js';
import { chunk } from './chunk.js';

const INSERT_BATCH_SIZE = 500;

/** Columnas devueltas en los GET (base del cruce + contacto + enriquecimiento RUES). */
const SELECT_COLUMNS =
  'cliente_id, nombre, ciudad, subsegmento, cupo_disponible, lea_aprobado, correo, telefono, ' +
  'representante_legal_nombre, representante_legal_documento, representante_legal_cargo, ' +
  'direccion_comercial, municipio_comercial, tipo_sociedad, actividad_economica, rues_found, rues_enriched_at';

export type TablaClientesFinales = 'clientes_finales' | 'clientes_finales_sin_pagare';

interface ClienteFinalRow {
  cliente_id: string;
  nombre: string | null;
  ciudad: string | null;
  subsegmento: string | null;
  cupo_disponible: number | null;
  lea_aprobado: number | null;
  correo: string | null;
  telefono: string | null;
  representante_legal_nombre: string | null;
  representante_legal_documento: string | null;
  representante_legal_cargo: string | null;
  direccion_comercial: string | null;
  municipio_comercial: string | null;
  tipo_sociedad: string | null;
  actividad_economica: string | null;
  rues_found: boolean | null;
  rues_enriched_at: string | null;
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

    // Tabla derivada: cada regeneración parte del cruce y limpia el enriquecimiento
    // RUES (se vuelve a poblar con POST /enrich-rues).
    const rows = clientes.map((cliente) => ({
      cliente_id: cliente.clienteId,
      nombre: cliente.nombre,
      ciudad: cliente.ciudad,
      subsegmento: cliente.subsegmento,
      cupo_disponible: cliente.cupoDisponible,
      lea_aprobado: cliente.leaAprobado,
      correo: cliente.correo,
      telefono: cliente.telefono,
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
      .select(SELECT_COLUMNS)
      .order('cliente_id');

    if (error) {
      throw new AppError(
        `Error consultando ${this.tabla}: ${error.message}`,
        502,
        'DATABASE_ERROR',
      );
    }

    return (data as unknown as ClienteFinalRow[]).map((row) => this.toEntity(row));
  }

  async findPage(query: ClientesFinalesPageQuery): Promise<ClientesFinalesPageResult> {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(50, Math.max(1, query.limit));
    const offset = (page - 1) * pageSize;

    let builder = this.supabase
      .from(this.tabla)
      .select(SELECT_COLUMNS, { count: 'exact' })
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
      clientes: (data as unknown as ClienteFinalRow[]).map((row) => this.toEntity(row)),
    };
  }

  async findByClienteId(clienteId: string): Promise<ClienteFinal | null> {
    const { data, error } = await this.supabase
      .from(this.tabla)
      .select(SELECT_COLUMNS)
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

    return this.toEntity(data as unknown as ClienteFinalRow);
  }

  async findClienteIdsSinEnriquecer(limit?: number): Promise<string[]> {
    let builder = this.supabase
      .from(this.tabla)
      .select('cliente_id')
      .is('rues_enriched_at', null)
      .order('cliente_id');

    if (limit !== undefined) {
      builder = builder.limit(limit);
    }

    const { data, error } = await builder;
    if (error) {
      throw new AppError(
        `Error consultando ${this.tabla}: ${error.message}`,
        502,
        'DATABASE_ERROR',
      );
    }

    return (data as { cliente_id: string }[]).map((row) => row.cliente_id);
  }

  async updateRuesEnrichment(clienteId: string, empresa: EmpresaRues | null): Promise<void> {
    const { error } = await this.supabase
      .from(this.tabla)
      .update({
        representante_legal_nombre: empresa?.representanteLegalNombre ?? null,
        representante_legal_documento: empresa?.representanteLegalDocumento ?? null,
        representante_legal_cargo: empresa?.representanteLegalCargo ?? null,
        direccion_comercial: empresa?.direccionComercial ?? null,
        municipio_comercial: empresa?.municipioComercial ?? null,
        tipo_sociedad: empresa?.tipoSociedad ?? null,
        actividad_economica: empresa?.actividadEconomica ?? null,
        rues_found: empresa !== null,
        rues_enriched_at: new Date().toISOString(),
      })
      .eq('cliente_id', clienteId);

    if (error) {
      throw new AppError(
        `Error actualizando RUES en ${this.tabla}: ${error.message}`,
        502,
        'DATABASE_ERROR',
      );
    }
  }

  private toEntity(row: ClienteFinalRow): ClienteFinal {
    return {
      clienteId: row.cliente_id,
      nombre: row.nombre,
      ciudad: row.ciudad,
      subsegmento: row.subsegmento,
      cupoDisponible: row.cupo_disponible,
      leaAprobado: row.lea_aprobado,
      correo: row.correo,
      telefono: row.telefono,
      representanteLegalNombre: row.representante_legal_nombre,
      representanteLegalDocumento: row.representante_legal_documento,
      representanteLegalCargo: row.representante_legal_cargo,
      direccionComercial: row.direccion_comercial,
      municipioComercial: row.municipio_comercial,
      tipoSociedad: row.tipo_sociedad,
      actividadEconomica: row.actividad_economica,
      ruesFound: row.rues_found,
      ruesEnrichedAt: row.rues_enriched_at,
    };
  }
}
