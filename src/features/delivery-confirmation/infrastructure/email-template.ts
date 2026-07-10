import type { DeliveryEmailPayload } from '../domain/email-sender.js';

/** Asunto del correo de confirmación de entrega (cambia si es recordatorio). */
export function buildDeliverySubject(isRetry: boolean): string {
  return isRetry
    ? 'Recordatorio: confirme la entrega de la tarjeta empresarial'
    : 'Confirme la entrega de la tarjeta empresarial';
}

/** Cuerpo HTML del correo de confirmación de entrega. */
export function buildDeliveryHtml(payload: DeliveryEmailPayload): string {
  const retryNotice = payload.isRetry
    ? '<p style="color:#b45309;"><strong>Este es un recordatorio:</strong> aún no hemos recibido la confirmación de entrega.</p>'
    : '';

  return `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2>Confirmación de entrega de tarjeta empresarial</h2>
    <p>Hola ${payload.managerName},</p>
    ${retryNotice}
    <p>
      La tarjeta de crédito empresarial terminada en <strong>**** ${payload.cardLastFour}</strong>,
      a nombre de <strong>${payload.cardHolderName}</strong>, fue enviada a su empresa.
    </p>
    <p>Por favor confírmenos si ya fue entregada a su titular:</p>
    <p style="text-align:center; margin: 32px 0;">
      <a href="${payload.confirmationUrl}"
         style="background:#1d4ed8; color:#ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
        Confirmar entrega
      </a>
    </p>
    <p style="font-size: 12px; color: #6b7280;">
      Este enlace es personal y de un solo uso. Si usted no es la persona indicada, ignore este correo.
    </p>
  </div>`;
}
