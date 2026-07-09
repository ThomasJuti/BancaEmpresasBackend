/**
 * Contrato de handoff entre `sales-calls` y la powerup (`power-apps`).
 *
 * Cuando una llamada de venta cierra CALIFICADA (identidad verificada + cliente
 * interesado), sales-calls expone este prefill: el subconjunto de campos de la
 * solicitud que ya se conocen desde la llamada + el lead. El front lo usa para
 * pre-diligenciar el formulario y POStea el resultado completo a
 * `POST /api/power-apps/submit`.
 *
 * Vive en `shared/contracts` para no acoplar features entre sí: sales-calls no
 * importa internals de power-apps y viceversa (regla del CLAUDE.md). Todas las
 * secciones son parciales porque una llamada no produce todos los datos de la
 * solicitud (p. ej. Cámara de Comercio o el agendamiento de entrega los
 * completa el asesor).
 */
export interface PowerAppPrefill {
  /** Lead/prospecto de origen (para trazar el caso del pipeline). */
  leadId?: string;
  campana?: string;
  empresa?: {
    nit?: string;
    razonSocial?: string;
    segmento?: string;
    ciudad?: string;
    direccion?: string;
  };
  tarjetahabiente?: {
    tipoDocumento?: 'CC' | 'CE' | 'PA' | 'TI';
    numeroDocumento?: string;
    nombres?: string;
    apellidos?: string;
    cargo?: string;
    email?: string;
    telefono?: string;
  };
  cupo?: {
    solicitado?: number;
    disponibleCec?: number;
  };
  producto?: {
    codigo?: string;
    franquicia?: string;
  };
  /** Metadatos de la llamada que originó el prefill (contexto para el asesor). */
  origenLlamada: {
    callId: string;
    sessionId?: string;
    resumen?: string;
    grabacionUrl?: string;
    finalizadaEn?: string;
  };
}
