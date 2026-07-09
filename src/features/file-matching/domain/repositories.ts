import type { BasePotencialCliente, CecCliente, ClienteFinal } from './entities.js';

/** Clientes CEC con cupo disponible para crédito (disponible > 0). */
export interface CecRepository {
  findConCupoDisponible(): Promise<CecCliente[]>;
}

/** Clientes de base potencial gestionables y sin tarjeta de crédito. */
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
export interface ClientesFinalesRepository {
  /** Regenera la tabla completa: es una lista derivada, cada corrida la reemplaza. */
  replaceAll(clientes: ClienteFinal[]): Promise<void>;
  findAll(): Promise<ClienteFinal[]>;
}
