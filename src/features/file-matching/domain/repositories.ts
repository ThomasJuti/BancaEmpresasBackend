import type { BasePotencialCliente, CecCliente, ClienteFinal, EmpresaRues } from './entities.js';

/** Clientes CEC con cupo disponible para crédito (disponible > 0). */
export interface CecRepository {
  findConCupoDisponible(): Promise<CecCliente[]>;
}

/** Consulta de datos de empresa en RUES (Croma) por NIT. */
export interface RuesProvider {
  /** Devuelve la empresa normalizada, o null si RUES no la encuentra. */
  findByNit(nit: string): Promise<EmpresaRues | null>;
}

/**
 * Clientes de base potencial gestionables, sin tarjeta de crédito y en un
 * segmento objetivo (Pequeña / Mediana / Empresarial).
 */
export interface BasePotencialRepository {
  findGestionablesSinTarjeta(clienteIds: string[]): Promise<BasePotencialCliente[]>;
}

/** Pagarés de clientes potenciales para grabar. */
export interface PagaresRepository {
  /** Subconjunto de las identificaciones dadas que tienen al menos un pagaré activo. */
  findIdsConPagareActivo(identificaciones: string[]): Promise<Set<string>>;
}

/**
 * Persistencia de una lista resultado del cruce. Cada instancia apunta a una
 * tabla concreta (clientes_finales o clientes_finales_sin_pagare).
 */
export interface ClientesFinalesPageQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface ClientesFinalesPageResult {
  total: number;
  page: number;
  pageSize: number;
  clientes: ClienteFinal[];
}

export interface ClientesFinalesRepository {
  /** Regenera la tabla completa: es una lista derivada, cada corrida la reemplaza. */
  replaceAll(clientes: ClienteFinal[]): Promise<void>;
  findAll(): Promise<ClienteFinal[]>;
  findPage(query: ClientesFinalesPageQuery): Promise<ClientesFinalesPageResult>;
  findByClienteId(clienteId: string): Promise<ClienteFinal | null>;
  /** cliente_id de las filas aún sin enriquecer con RUES (rues_enriched_at is null). */
  findClienteIdsSinEnriquecer(limit?: number): Promise<string[]>;
  /** Guarda el enriquecimiento RUES de un cliente (empresa=null cuando no hubo coincidencia). */
  updateRuesEnrichment(clienteId: string, empresa: EmpresaRues | null): Promise<void>;
}
