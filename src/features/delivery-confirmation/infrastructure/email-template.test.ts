import { describe, expect, it } from 'vitest';
import { buildDeliveryHtml, buildDeliverySubject } from './email-template.js';

describe('email-template', () => {
  const payload = {
    to: 'manager@test.com',
    managerName: 'María',
    cardHolderName: 'Juan Pérez',
    cardLastFour: '1234',
    confirmationUrl: 'https://app.test/confirm?token=abc',
    isRetry: false,
  };

  it('genera asunto inicial y de recordatorio', () => {
    expect(buildDeliverySubject(false)).toContain('Confirme');
    expect(buildDeliverySubject(true)).toContain('Recordatorio');
  });

  it('incluye datos del destinatario en HTML', () => {
    const html = buildDeliveryHtml(payload);
    expect(html).toContain('María');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('1234');
    expect(html).toContain(payload.confirmationUrl);
  });

  it('muestra aviso de recordatorio cuando isRetry es true', () => {
    const html = buildDeliveryHtml({ ...payload, isRetry: true });
    expect(html).toContain('Recordatorio');
  });
});
