import { describe, expect, it } from 'vitest';
import { chunk } from './chunk.js';

describe('chunk', () => {
  it('divide arreglos en bloques', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('retorna arreglo vacío para entrada vacía', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});
