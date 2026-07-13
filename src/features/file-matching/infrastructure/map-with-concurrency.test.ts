import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './map-with-concurrency.js';

describe('mapWithConcurrency', () => {
  it('mapea todos los elementos preservando orden', async () => {
    const result = await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it('respeta límite de concurrencia', async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4], 2, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active -= 1;
      return true;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('maneja arreglo vacío', async () => {
    expect(await mapWithConcurrency([], 5, async () => 1)).toEqual([]);
  });
});
