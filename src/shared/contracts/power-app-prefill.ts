/**
 * Contrato de handoff entre `sales-calls` y la Power App (`power-apps`).
 *
 * Subconjunto de campos de `SubmitPowerAppDto` / `PowerAppSubmitRequest` que se
 * pueden pre-poblar con la llamada (entrada + variables de salida + análisis del
 * agente). El front pre-diligencia el formulario y el asesor completa lo que no
 * es derivable de la llamada — sobre todo `archivosAdjuntos` (PDF Cámara de
 * Comercio) — antes de `POST /api/power-apps/submit`.
 */
export interface PowerAppPrefill {
  leadId?: string;
  campana?: string;
  asesorId?: string;

  segmento?: string;
  tipoIdentificacionEmpresa?: 'NIT';
  tipoIdentificacionTarjetahabiente?: 'CC' | 'CE' | 'PA' | 'TI';
  numeroIdentificacionTarjetahabiente?: string;
  unidadNegocios?: string;
  tipoTarjetaNueva?: string;
  identificacionEmpresa?: string;
  nombreEmpresa?: string;
  nombreTarjetahabiente?: string;

  binProducto?: string;
  cargoDebitoAutomatico?: string;
  cupoTarjetaNueva?: number;
  cupoDisponibleCec?: number;

  // Entrega: se pre-pobla si el agente la acordó en la llamada; el asesor la ajusta.
  codigoOficinaCentroServicio?: string;
  ciudadPuntoEntrega?: string;
  direccionPuntoComercial?: string;
  puntoEntrega?: 'PUNTO_ENTREGA_A_COMERCIAL' | 'ENVIO_CERTIFICADO_COURIER';

  origenLlamada: {
    callId: string;
    sessionId?: string;
    resumen?: string;
    grabacionUrl?: string;
    finalizadaEn?: string;
  };
}
