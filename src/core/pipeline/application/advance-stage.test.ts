import { describe, expect, it, vi } from 'vitest';
import { SupabasePipelineStageAdvancer } from './advance-stage.js';
import { ValidationError } from '../../../shared/exceptions/app-error.js';

function createMockDb(responses: {
  select?: { data: unknown; error: unknown };
  update?: { error: unknown };
}) {
  const maybeSingle = vi.fn().mockResolvedValue(responses.select ?? { data: { stage: 'sales_call' }, error: null });
  const eqSelect = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eqSelect });

  const eqUpdate = vi.fn().mockResolvedValue(responses.update ?? { error: null });
  const update = vi.fn().mockReturnValue({ eq: eqUpdate });

  return {
    from: vi.fn().mockReturnValue({ select, update }),
    maybeSingle,
    eqUpdate,
  };
}

describe('SupabasePipelineStageAdvancer', () => {
  it('avanza etapa válida', async () => {
    const db = createMockDb({});
    const advancer = new SupabasePipelineStageAdvancer(db as never);
    await expect(advancer.advance('case-1', 'power_apps')).resolves.toBeUndefined();
    expect(db.from).toHaveBeenCalledWith('pipeline_cases');
  });

  it('rechaza etapa fuera del pipeline', async () => {
    const advancer = new SupabasePipelineStageAdvancer(createMockDb({}) as never);
    await expect(advancer.advance('case-1', 'invalid' as 'power_apps')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('omite si el caso no existe', async () => {
    const db = createMockDb({ select: { data: null, error: null } });
    const advancer = new SupabasePipelineStageAdvancer(db as never);
    await expect(advancer.advance('missing', 'power_apps')).resolves.toBeUndefined();
  });

  it('rechaza retroceso de etapa', async () => {
    const db = createMockDb({ select: { data: { stage: 'delivery_confirmation' }, error: null } });
    const advancer = new SupabasePipelineStageAdvancer(db as never);
    await expect(advancer.advance('case-1', 'power_apps')).rejects.toBeInstanceOf(ValidationError);
  });

  it('propaga error de lectura', async () => {
    const db = createMockDb({ select: { data: null, error: { message: 'read fail' } } });
    const advancer = new SupabasePipelineStageAdvancer(db as never);
    await expect(advancer.advance('case-1', 'power_apps')).rejects.toMatchObject({ code: 'DB_ERROR' });
  });

  it('propaga error de actualización', async () => {
    const db = createMockDb({ update: { error: { message: 'update fail' } } });
    const advancer = new SupabasePipelineStageAdvancer(db as never);
    await expect(advancer.advance('case-1', 'power_apps')).rejects.toMatchObject({ code: 'DB_ERROR' });
  });
});
