import { describe, expect, it } from 'vitest';
import { HmacConfirmationTokenService } from './token-service.js';

describe('HmacConfirmationTokenService', () => {
  const secret = 'test-secret-key';
  const service = new HmacConfirmationTokenService(secret, 60_000);

  it('requiere secret no vacío', () => {
    expect(() => new HmacConfirmationTokenService('')).toThrow(/CONFIRMATION_TOKEN_SECRET/);
  });

  it('genera y verifica token válido', () => {
    const token = service.generate('case-1', 'manager@test.com');
    const payload = service.verify(token);
    expect(payload).toEqual({ deliveryCaseId: 'case-1', managerEmail: 'manager@test.com' });
  });

  it('rechaza token alterado', () => {
    const token = service.generate('case-1', 'manager@test.com');
    expect(service.verify(`${token}x`)).toBeNull();
  });

  it('rechaza token expirado', () => {
    const shortTtl = new HmacConfirmationTokenService(secret, -1);
    const token = shortTtl.generate('case-1', 'manager@test.com');
    expect(shortTtl.verify(token)).toBeNull();
  });

  it('genera hash determinístico', () => {
    const token = service.generate('case-1', 'manager@test.com');
    expect(service.hash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hash(token)).toBe(service.hash(token));
  });

  it('rechaza payload malformado', () => {
    expect(service.verify('not-a-valid-token')).toBeNull();
  });
});
