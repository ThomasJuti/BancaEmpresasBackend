import { describe, expect, it, vi } from 'vitest';
import { registerShipment } from './register-shipment.js';
import { ValidationError } from '../../../shared/exceptions/app-error.js';

describe('registerShipment', () => {
  it('crea caso con companyId normalizado', async () => {
    const created = { id: 'delivery-1', companyId: '9001234567' };
    const repository = { create: vi.fn().mockResolvedValue(created) };

    const result = await registerShipment(
      {
        caseId: 'case-1',
        cardId: 'card-1',
        companyId: '900-123-456-7',
        cardHolderName: 'Juan',
        cardLastFour: '1234',
      },
      { repository: repository as never, dayMs: 5000 },
    );

    expect(result).toBe(created);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: '9001234567' }),
    );
  });

  it('rechaza fecha inválida', async () => {
    await expect(
      registerShipment(
        {
          caseId: 'case-1',
          cardId: 'card-1',
          companyId: '9001234567',
          cardHolderName: 'Juan',
          cardLastFour: '1234',
          physicalShippedAt: 'invalid-date',
        },
        { repository: { create: vi.fn() } as never, dayMs: 5000 },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
