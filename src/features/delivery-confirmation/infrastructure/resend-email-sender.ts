import { Resend } from 'resend';
import type { DeliveryEmailPayload, DeliveryEmailSender } from '../domain/email-sender.js';

function buildHtml(payload: DeliveryEmailPayload): string {
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

export class ResendDeliveryEmailSender implements DeliveryEmailSender {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly fromEmail: string,
  ) {
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required to send delivery confirmation emails');
    }
    if (!fromEmail) {
      throw new Error('RESEND_FROM_EMAIL is required to send delivery confirmation emails');
    }
    this.client = new Resend(apiKey);
  }

  async send(payload: DeliveryEmailPayload): Promise<string | undefined> {
    const subject = payload.isRetry
      ? 'Recordatorio: confirme la entrega de la tarjeta empresarial'
      : 'Confirme la entrega de la tarjeta empresarial';

    const { data, error } = await this.client.emails.send({
      from: this.fromEmail,
      to: payload.to,
      subject,
      html: buildHtml(payload),
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }
    return data?.id;
  }
}
