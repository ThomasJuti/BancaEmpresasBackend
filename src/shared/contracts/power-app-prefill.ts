/**
 * Contrato de handoff entre `sales-calls` y la Power App (`power-apps`).
 *
 * Subconjunto parcial de campos de `SubmitPowerAppDto` / `PowerAppSubmitRequest`.
 * El front pre-diligencia el formulario y el asesor completa lo faltante
 * (archivosAdjuntos con PDF Cámara de Comercio, datos de entrega, etc.)
 * antes de `POST /api/power-apps/submit`.
 */
export interface PowerAppPrefill {
  leadId?: string;
  campana?: string;

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

  origenLlamada: {
    callId: string;
    sessionId?: string;
    resumen?: string;
    grabacionUrl?: string;
    finalizadaEn?: string;
  };
}
