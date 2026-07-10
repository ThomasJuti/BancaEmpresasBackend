import nodemailer, { type Transporter } from 'nodemailer';
import type { DeliveryEmailPayload, DeliveryEmailSender } from '../domain/email-sender.js';
import { buildDeliveryHtml, buildDeliverySubject } from './email-template.js';

/**
 * ATAJO DE DEMO — envía por SMTP de Gmail con un App Password, para poder
 * mandar a destinatarios arbitrarios sin verificar un dominio (que en Resend
 * tarda por DNS). Para producción, volver a un proveedor transaccional con
 * dominio verificado (ResendDeliveryEmailSender).
 *
 * Credenciales por entorno (GMAIL_USER / GMAIL_APP_PASSWORD); nunca en código.
 */
export class NodemailerGmailEmailSender implements DeliveryEmailSender {
  private readonly transporter: Transporter;

  constructor(
    private readonly user: string,
    appPassword: string,
  ) {
    if (!user) {
      throw new Error('GMAIL_USER is required to send delivery confirmation emails');
    }
    if (!appPassword) {
      throw new Error('GMAIL_APP_PASSWORD is required to send delivery confirmation emails');
    }
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass: appPassword },
    });
  }

  async send(payload: DeliveryEmailPayload): Promise<string | undefined> {
    const info = await this.transporter.sendMail({
      from: this.user,
      to: payload.to,
      subject: buildDeliverySubject(payload.isRetry),
      html: buildDeliveryHtml(payload),
    });
    return info.messageId;
  }
}
