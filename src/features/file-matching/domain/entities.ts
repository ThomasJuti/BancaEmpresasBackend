/** Cliente que superó una validación del cruce; insumo de la etapa sales-calls. */
export interface ClienteFinal {
  clienteId: string;
  nombre: string | null;
  ciudad: string | null;
  subsegmento: string | null;
  /** Cupo disponible para crédito según CEC */
  cupoDisponible: number | null;
  leaAprobado: number | null;
  /** Contacto arrastrado desde base potencial (para sales-calls y activation-email) */
  correo: string | null;
  telefono: string | null;
  /** Enriquecimiento RUES (Croma) — se llena en el paso POST /enrich-rues */
  representanteLegalNombre: string | null;
  representanteLegalDocumento: string | null;
  representanteLegalCargo: string | null;
  direccionComercial: string | null;
  municipioComercial: string | null;
  tipoSociedad: string | null;
  actividadEconomica: string | null;
  /** true/false si Croma respondió; null si aún no se enriqueció */
  ruesFound: boolean | null;
  ruesEnrichedAt: string | null;
}

/**
 * Datos de una empresa normalizados desde la respuesta de Croma RUES.
 * Subconjunto mínimo que consume el enriquecimiento de clientes_finales.
 */
export interface EmpresaRues {
  representanteLegalNombre: string | null;
  representanteLegalDocumento: string | null;
  representanteLegalCargo: string | null;
  direccionComercial: string | null;
  municipioComercial: string | null;
  tipoSociedad: string | null;
  actividadEconomica: string | null;
}

/** Conteos del enriquecimiento RUES; no contiene datos de clientes. */
export interface RuesEnrichmentResumen {
  procesados: number;
  encontrados: number;
  sinCoincidencia: number;
  errores: number;
}

/** Fila de CEC con cupo disponible (solo los campos que usa el cruce). */
export interface CecCliente {
  numeIden: string;
  disponible: number | null;
  leaAprobado: number | null;
}

/** Fila de base potencial gestionable y sin tarjeta (solo los campos que usa el cruce). */
export interface BasePotencialCliente {
  clienteId: string;
  clienteNombre: string | null;
  ciudad: string | null;
  subsegmento: string | null;
  correo: string | null;
  telefono: string | null;
}

/** Conteos de cada paso del cruce; no contiene datos de clientes. */
export interface FileMatchingResumen {
  cecConCupo: number;
  gestionablesSinTc: number;
  conPagareActivo: number;
  clientesFinales: number;
  clientesFinalesSinPagare: number;
  /** Momento en que se ejecutó el cruce (ISO 8601), para mostrar "última generación" en el front. */
  generadoEn: string;
}
