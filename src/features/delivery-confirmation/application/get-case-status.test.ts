import { describe, expect, it, vi } from 'vitest';
import { getCaseStatus, getConfirmationView } from './get-case-status.js';
import { HmacConfirmationTokenService } from '../infrastructure/token-service.js';
import { NotFoundError } from '../../../shared/exceptions/app-error.js';

describe('getCaseStatus', () => {
  it('retorna vista del caso', async () => {
    const repository = {
      findByCaseId: vi.fn().mockResolvedValue({
        caseId: 'case-1',
        status: 'sent',
        emailScheduledAt: '2026-01-01',
        attemptCount: 1,
      }),
    };
    const view = await getCaseStatus('case-1', repository as never);
    expect(view.caseId).toBe('case-1');
  });

  it('lanza NotFoundError si no existe', async () => {
    await expect(getCaseStatus('x', { findByCaseId: vi.fn().mockResolvedValue(null) } as never)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('getConfirmationView', () => {
  const tokens = new HmacConfirmationTokenService('secret', 60_000);

  it('retorna datos para token válido', async () => {
    const token = tokens.generate('delivery-1', 'mgr@test.com');
    const repository = {
      findById: vi.fn().mockResolvedValue({
        cardHolderName: 'Juan',
        cardLastFour: '1234',
        companyId: '9001234567',
        status: 'awaiting_confirmation',
      }),
    };
    const view = await getConfirmationView(token, { repository: repository as never, tokens });
    expect(view.cardLastFour).toBe('1234');
  });
});
