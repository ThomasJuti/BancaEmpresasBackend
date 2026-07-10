/** Datos de negocio que power-apps conoce al aprobar una solicitud. */
export interface ScheduleShipmentInput {
  /** Caso del pipeline al que pertenece la tarjeta. */
  caseId: string;
  /** Identificación (NIT) de la empresa; llave para ubicar a los gerentes. */
  companyId: string;
  /** Nombre del tarjetahabiente que aparecerá en el correo. */
  cardHolderName: string;
}

/**
 * Contrato para que power-apps agende el envío/correo de confirmación sin
 * importar internals de delivery-confirmation. Esa feature lo implementa.
 */
export interface ShipmentScheduler {
  scheduleShipment(input: ScheduleShipmentInput): Promise<void>;
}
