export interface DeliveryEmailPayload {
  to: string;
  managerName: string;
  cardHolderName: string;
  cardLastFour: string;
  /** Link firmado hacia la página de confirmación del frontend. */
  confirmationUrl: string;
  /** true cuando es un reintento (outcome previo distinto de entregado). */
  isRetry: boolean;
}

export interface DeliveryEmailSender {
  /** Envía el correo y devuelve el id del mensaje del proveedor (si existe). */
  send(payload: DeliveryEmailPayload): Promise<string | undefined>;
}
