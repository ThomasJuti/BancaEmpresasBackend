import { describe, expect, it, vi } from 'vitest';
import { processDueEmails } from './process-due-emails.js';
import { HmacConfirmationTokenService } from '../infrastructure/token-service.js';

describe('processDueEmails', () => {
  it('envía correos a gerentes y registra intentos', async () => {
    const tokens = new HmacConfirmationTokenService('secret', 60_000);
    const repository = {
      findDue: vi.fn().mockResolvedValue([
        {
          id: 'delivery-1',
          caseId: 'case-1',
          companyId: '9001234567',
          cardHolderName: 'Juan',
          cardLastFour: '1234',
          attemptCount: 0,
        },
      ]),
      recordEmailAttempt: vi.fn().mockResolvedValue(undefined),
      markSent: vi.fn().mockResolvedValue(undefined),
    };
    const emailSender = { send: vi.fn().mockResolvedValue('msg-1') };

    const count = await processDueEmails({
      repository: repository as never,
      managers: {
        findByCompanyId: vi.fn().mockResolvedValue([{ name: 'María', email: 'mgr@test.com' }]),
      },
      emailSender,
      tokens,
      frontendConfirmationUrl: 'https://app.test/confirm',
    });

    expect(count).toBe(1);
    expect(emailSender.send).toHaveBeenCalled();
    expect(repository.markSent).toHaveBeenCalled();
  });

  it('omite caso sin gerentes', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const repository = {
      findDue: vi.fn().mockResolvedValue([
        { id: 'd1', caseId: 'c1', companyId: '1', cardHolderName: 'J', cardLastFour: '1234', attemptCount: 0 },
      ]),
      markSent: vi.fn(),
    };
    await processDueEmails({
      repository: repository as never,
      managers: { findByCompanyId: vi.fn().mockResolvedValue([]) },
      emailSender: { send: vi.fn() },
      tokens: new HmacConfirmationTokenService('secret'),
      frontendConfirmationUrl: 'https://app.test',
    });
    expect(repository.markSent).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
