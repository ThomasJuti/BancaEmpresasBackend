import { describe, expect, it, vi } from 'vitest';
import { DemoShipmentScheduler } from './demo-shipment-scheduler.js';

function buildDeps(overrides: Record<string, unknown> = {}) {
  return {
    repository: {
      findByCaseId: vi.fn().mockResolvedValue(null),
      findDue: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(undefined),
      scheduleRetry: vi.fn().mockResolvedValue(undefined),
    },
    managers: { findByCompanyId: vi.fn().mockResolvedValue([{ email: 'g@test.com', name: 'Gerente' }]) },
    emailSender: { send: vi.fn().mockResolvedValue(undefined) },
    tokens: { sign: vi.fn().mockReturnValue('token') },
    frontendConfirmationUrl: 'https://app.test/confirmar-entrega',
    ...overrides,
  };
}

describe('DemoShipmentScheduler', () => {
  it('crea envío y procesa correos pendientes', async () => {
    const deps = buildDeps();
    const scheduler = new DemoShipmentScheduler(() => deps as never);
    await scheduler.scheduleShipment({
      caseId: 'case-1',
      companyId: '9001234567',
      cardHolderName: 'Ana',
    });
    expect(deps.repository.create).toHaveBeenCalled();
  });

  it('reintenta envío existente no programado', async () => {
    const existing = { id: 'dc-1', status: 'confirmed', attemptCount: 0, caseId: 'case-1', companyId: '9001234567' };
    const deps = buildDeps({
      repository: {
        findByCaseId: vi.fn().mockResolvedValue(existing),
        findDue: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        scheduleRetry: vi.fn().mockResolvedValue(undefined),
      },
    });
    const scheduler = new DemoShipmentScheduler(() => deps as never);
    await scheduler.scheduleShipment({
      caseId: 'case-1',
      companyId: '9001234567',
      cardHolderName: 'Ana',
    });
    expect(deps.repository.scheduleRetry).toHaveBeenCalledWith('dc-1', 'not_arrived', expect.any(Date));
  });
});
