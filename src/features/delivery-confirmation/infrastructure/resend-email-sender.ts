import { Resend } from 'resend';
import type { DeliveryEmailPayload, DeliveryEmailSender } from '../domain/email-sender.js';
import { buildDeliveryHtml, buildDeliverySubject } from './email-template.js';

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
    const { data, error } = await this.client.emails.send({
      from: this.fromEmail,
      to: payload.to,
      subject: buildDeliverySubject(payload.isRetry),
      html: buildDeliveryHtml(payload),
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }
    return data?.id;
  }
}
