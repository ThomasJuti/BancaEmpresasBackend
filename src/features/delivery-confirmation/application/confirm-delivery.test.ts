import { describe, expect, it, vi } from 'vitest';
import { confirmDelivery } from './confirm-delivery.js';
import { HmacConfirmationTokenService } from '../infrastructure/token-service.js';
import type { DeliveryConfirmationCase } from '../domain/types.js';

function makeCase(overrides: Partial<DeliveryConfirmationCase> = {}): DeliveryConfirmationCase {
  return {
    id: 'delivery-1',
    caseId: 'case-1',
    cardId: 'card-1',
    companyId: '9001234567',
    cardHolderName: 'Juan',
    cardLastFour: '1234',
    status: 'awaiting_confirmation',
    physicalShippedAt: '2026-01-01T00:00:00.000Z',
    emailScheduledAt: '2026-01-04T00:00:00.000Z',
    attemptCount: 1,
    ...overrides,
  };
}

describe('confirmDelivery', () => {
  const tokens = new HmacConfirmationTokenService('secret', 60_000);

  it('confirma entrega exitosa', async () => {
    const token = tokens.generate('delivery-1', 'mgr@test.com');
    const repository = {
      findEmailAttemptByTokenHash: vi.fn().mockResolvedValue({
        deliveryCaseId: 'delivery-1',
        status: 'pending',
      }),
      findById: vi.fn().mockResolvedValue(makeCase()),
      markTokenUsed: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(undefined),
      scheduleRetry: vi.fn(),
    };
    const finalizer = { finalize: vi.fn().mockResolvedValue(undefined) };

    const result = await confirmDelivery(
      { token, outcome: 'delivered_to_holder' },
      {
        repository: repository as never,
        tokens,
        leadContacts: { findByCompanyId: vi.fn().mockResolvedValue({ nombre: 'Empresa', telefono: '300', correo: 'a@b.co' }) },
        finalizer,
        dayMs: 5000,
      },
    );

    expect(result.status).toBe('confirmed');
    expect(repository.confirm).toHaveBeenCalled();
    expect(finalizer.finalize).toHaveBeenCalled();
  });

  it('programa reintento para outcomes de retry', async () => {
    const token = tokens.generate('delivery-1', 'mgr@test.com');
    const repository = {
      findEmailAttemptByTokenHash: vi.fn().mockResolvedValue({ deliveryCaseId: 'delivery-1' }),
      findById: vi.fn().mockResolvedValue(makeCase()),
      markTokenUsed: vi.fn().mockResolvedValue(undefined),
      scheduleRetry: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn(),
    };

    const result = await confirmDelivery(
      { token, outcome: 'not_arrived' },
      {
        repository: repository as never,
        tokens,
        leadContacts: { findByCompanyId: vi.fn() },
        finalizer: { finalize: vi.fn() },
        dayMs: 5000,
      },
    );

    expect(result.status).toBe('retry_scheduled');
    expect(result.nextEmailAt).toBeTruthy();
  });

  it('rechaza token inválido', async () => {
    await expect(
      confirmDelivery(
        { token: 'bad', outcome: 'delivered_to_holder' },
        {
          repository: {} as never,
          tokens,
          leadContacts: { findByCompanyId: vi.fn() },
          finalizer: { finalize: vi.fn() },
          dayMs: 5000,
        },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('rechaza token ya usado', async () => {
    const token = tokens.generate('delivery-1', 'mgr@test.com');
    const repository = {
      findEmailAttemptByTokenHash: vi.fn().mockResolvedValue({
        deliveryCaseId: 'delivery-1',
        status: 'used',
      }),
    };
    await expect(
      confirmDelivery(
        { token, outcome: 'delivered_to_holder' },
        {
          repository: repository as never,
          tokens,
          leadContacts: { findByCompanyId: vi.fn() },
          finalizer: { finalize: vi.fn() },
          dayMs: 5000,
        },
      ),
    ).rejects.toMatchObject({ code: 'TOKEN_ALREADY_USED' });
  });

  it('continúa si el finalizer falla', async () => {
    const token = tokens.generate('delivery-1', 'mgr@test.com');
    const repository = {
      findEmailAttemptByTokenHash: vi.fn().mockResolvedValue({ deliveryCaseId: 'delivery-1', status: 'pending' }),
      findById: vi.fn().mockResolvedValue(makeCase()),
      markTokenUsed: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(undefined),
    };
    const result = await confirmDelivery(
      { token, outcome: 'delivered_to_holder' },
      {
        repository: repository as never,
        tokens,
        leadContacts: { findByCompanyId: vi.fn().mockRejectedValue(new Error('contact fail')) },
        finalizer: { finalize: vi.fn() },
        dayMs: 5000,
      },
    );
    expect(result.status).toBe('confirmed');
  });
});
