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
