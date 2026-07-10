import { AppError } from '../../../shared/exceptions/app-error.js';
import type { RuesEnrichmentResumen } from '../domain/entities.js';
import type { ClientesFinalesRepository, RuesProvider } from '../domain/repositories.js';
import { mapWithConcurrency } from '../infrastructure/map-with-concurrency.js';

const CONCURRENCIA = 5;

export interface EnrichRuesOptions {
  /** Solo enriquece los que aún no tienen RUES (por defecto). Si false, reprocesa todos. */
  soloFaltantes?: boolean;
  /** Tope de clientes a procesar en esta corrida. */
  limit?: number;
}

/**
 * Enriquece clientes_finales con datos de RUES (Croma) por NIT: representante
 * legal y datos de empresa para la Power App. Paso intermedio disparado por POST.
 * Consulta la fuente pequeña (clientes_finales), no la base potencial completa.
 */
export class EnrichClientesFinalesRuesUseCase {
  private isRunning = false;

  constructor(
    private readonly clientesFinalesRepository: ClientesFinalesRepository,
    private readonly ruesProvider: RuesProvider,
  ) {}

  async execute(options: EnrichRuesOptions = {}): Promise<RuesEnrichmentResumen> {
    if (this.isRunning) {
      throw new AppError('Ya hay un enriquecimiento RUES en curso.', 409, 'ENRICH_IN_PROGRESS');
    }
    this.isRunning = true;
    try {
      const soloFaltantes = options.soloFaltantes ?? true;
      const clienteIds = soloFaltantes
        ? await this.clientesFinalesRepository.findClienteIdsSinEnriquecer(options.limit)
        : (await this.clientesFinalesRepository.findAll())
            .map((cliente) => cliente.clienteId)
            .slice(0, options.limit ?? undefined);

      let encontrados = 0;
      let sinCoincidencia = 0;
      let errores = 0;

      await mapWithConcurrency(clienteIds, CONCURRENCIA, async (clienteId) => {
        try {
          const empresa = await this.ruesProvider.findByNit(clienteId);
          await this.clientesFinalesRepository.updateRuesEnrichment(clienteId, empresa);
          if (empresa) {
            encontrados += 1;
          } else {
            sinCoincidencia += 1;
          }
        } catch {
          // Un fallo puntual (timeout, NIT problemático) no aborta el lote.
          errores += 1;
        }
      });

      return { procesados: clienteIds.length, encontrados, sinCoincidencia, errores };
    } finally {
      this.isRunning = false;
    }
  }
}
