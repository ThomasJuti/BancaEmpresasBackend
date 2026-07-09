import type { ClienteFinal, FileMatchingResumen } from '../domain/entities.js';
import type {
  BasePotencialRepository,
  CecRepository,
  ClientesFinalesRepository,
  PagaresRepository,
} from '../domain/repositories.js';

/**
 * Cruza las 3 tablas fuente y persiste las dos listas resultado:
 *
 * 1. Validación sin pagaré (clientes_finales_sin_pagare): cliente gestionable
 *    + sin tarjeta de crédito (base potencial) + con cupo disponible (CEC).
 * 2. Validación completa (clientes_finales): la anterior + pagaré activo
 *    (clientes potenciales para grabar).
 *
 * El cruce parte de CEC (la tabla pequeña) para no leer la base potencial completa.
 */
export class BuildClientesFinalesUseCase {
  constructor(
    private readonly cecRepository: CecRepository,
    private readonly basePotencialRepository: BasePotencialRepository,
    private readonly pagaresRepository: PagaresRepository,
    private readonly clientesFinalesRepository: ClientesFinalesRepository,
    private readonly clientesFinalesSinPagareRepository: ClientesFinalesRepository,
  ) {}

  async execute(): Promise<FileMatchingResumen> {
    const { candidatos, cecConCupo } = await this.buildCandidatosSinPagare();
    await this.clientesFinalesSinPagareRepository.replaceAll(candidatos);

    const { clientesFinales, conPagareActivo } = await this.aplicarCondicionPagare(candidatos);
    await this.clientesFinalesRepository.replaceAll(clientesFinales);

    return {
      cecConCupo,
      gestionablesSinTc: candidatos.length,
      conPagareActivo,
      clientesFinales: clientesFinales.length,
      clientesFinalesSinPagare: candidatos.length,
    };
  }

  /** Pasos comunes a ambas validaciones: cupo CEC ∩ gestionable sin TC. */
  private async buildCandidatosSinPagare(): Promise<{
    candidatos: ClienteFinal[];
    cecConCupo: number;
  }> {
    const cecClientes = await this.cecRepository.findConCupoDisponible();
    const cecPorId = new Map(cecClientes.map((cec) => [cec.numeIden, cec]));

    const gestionables = await this.basePotencialRepository.findGestionablesSinTarjeta([
      ...cecPorId.keys(),
    ]);

    // La base potencial puede traer el mismo cliente_id más de una vez; se conserva la primera fila.
    const candidatosPorId = new Map<string, ClienteFinal>();
    for (const cliente of gestionables) {
      const cec = cecPorId.get(cliente.clienteId);
      if (!cec || candidatosPorId.has(cliente.clienteId)) continue;
      candidatosPorId.set(cliente.clienteId, {
        clienteId: cliente.clienteId,
        nombre: cliente.clienteNombre,
        ciudad: cliente.ciudad,
        subsegmento: cliente.subsegmento,
        cupoDisponible: cec.disponible,
        leaAprobado: cec.leaAprobado,
      });
    }

    return { candidatos: [...candidatosPorId.values()], cecConCupo: cecClientes.length };
  }

  /** Condición adicional de la validación completa: pagaré activo. */
  private async aplicarCondicionPagare(candidatos: ClienteFinal[]): Promise<{
    clientesFinales: ClienteFinal[];
    conPagareActivo: number;
  }> {
    const idsConPagare = await this.pagaresRepository.findIdsConPagareActivo(
      candidatos.map((cliente) => cliente.clienteId),
    );
    return {
      clientesFinales: candidatos.filter((cliente) => idsConPagare.has(cliente.clienteId)),
      conPagareActivo: idsConPagare.size,
    };
  }
}
