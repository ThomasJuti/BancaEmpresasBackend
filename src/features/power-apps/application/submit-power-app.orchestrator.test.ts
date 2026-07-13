import { describe, expect, it, vi } from 'vitest';
import { validPowerAppDto } from '../../../__tests__/fixtures/valid-power-app-dto.js';
import { submitPowerAppOrchestrator } from './submit-power-app.orchestrator.js';

describe('submitPowerAppOrchestrator', () => {
  it('persiste y avanza pipeline cuando la solicitud es válida', async () => {
    const cases = {
      ensureByLeadId: vi.fn().mockResolvedValue({ id: 'pipeline-case-1' }),
    };
    const submissions = { save: vi.fn().mockResolvedValue({}) };
    const pipeline = { advance: vi.fn().mockResolvedValue(undefined) };
    const shipmentScheduler = { scheduleShipment: vi.fn().mockResolvedValue(undefined) };

    const result = await submitPowerAppOrchestrator(validPowerAppDto, {
      cases,
      submissions,
      pipeline,
      shipmentScheduler,
    });

    expect(result.valid).toBe(true);
    expect(result.caseId).toBe('pipeline-case-1');
    expect(submissions.save).toHaveBeenCalled();
    expect(pipeline.advance).toHaveBeenCalledWith('pipeline-case-1', 'delivery_confirmation');
    expect(shipmentScheduler.scheduleShipment).toHaveBeenCalled();
  });

  it('no persiste ni agenda envío si la solicitud es inválida', async () => {
    const cases = {
      ensureByLeadId: vi.fn().mockResolvedValue({ id: 'pipeline-case-1' }),
    };
    const submissions = { save: vi.fn() };
    const pipeline = { advance: vi.fn() };
    const shipmentScheduler = { scheduleShipment: vi.fn() };

    const result = await submitPowerAppOrchestrator(
      { ...validPowerAppDto, tipoTarjetaNueva: 'VISA' },
      { cases, submissions, pipeline, shipmentScheduler },
    );

    expect(result.valid).toBe(false);
    expect(submissions.save).not.toHaveBeenCalled();
    expect(pipeline.advance).not.toHaveBeenCalled();
  });

  it('continúa aunque falle el agendamiento de envío', async () => {
    const cases = {
      ensureByLeadId: vi.fn().mockResolvedValue({ id: 'pipeline-case-1' }),
    };
    const submissions = { save: vi.fn().mockResolvedValue({}) };
    const pipeline = { advance: vi.fn().mockResolvedValue(undefined) };
    const shipmentScheduler = {
      scheduleShipment: vi.fn().mockRejectedValue(new Error('scheduler down')),
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await submitPowerAppOrchestrator(validPowerAppDto, {
      cases,
      submissions,
      pipeline,
      shipmentScheduler,
    });

    expect(result.valid).toBe(true);
    consoleSpy.mockRestore();
  });
});
