import { describe, expect, it } from 'vitest';
import { normalizeLeadId } from './normalize-lead-id.js';

describe('normalizeLeadId', () => {
  it('extrae solo dígitos', () => {
    expect(normalizeLeadId(' 900-123-456-7 ')).toBe('9001234567');
  });

  it('conserva texto si no hay dígitos', () => {
    expect(normalizeLeadId('ABC')).toBe('ABC');
  });
});
