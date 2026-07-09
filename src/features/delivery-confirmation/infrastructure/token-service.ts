import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import type { ConfirmationTokenService } from '../domain/token-service.js';

interface TokenPayload {
  deliveryCaseId: string;
  managerEmail: string;
  exp: number;
}

/**
 * Token firmado HMAC-SHA256: base64url(payload).base64url(signature).
 * No es un JWT completo a propósito: un solo emisor/consumidor, sin header.
 */
export class HmacConfirmationTokenService implements ConfirmationTokenService {
  constructor(
    private readonly secret: string,
    /** Vida útil del token en ms (default 30 días reales, sobra para la demo). */
    private readonly ttlMs: number = 30 * 24 * 60 * 60 * 1000,
  ) {
    if (!secret) {
      throw new Error(
        'CONFIRMATION_TOKEN_SECRET is required to issue delivery confirmation tokens',
      );
    }
  }

  generate(deliveryCaseId: string, managerEmail: string): string {
    const payload: TokenPayload = {
      deliveryCaseId,
      managerEmail,
      exp: Date.now() + this.ttlMs,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  verify(token: string): { deliveryCaseId: string; managerEmail: string } | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;
    const expected = this.sign(encoded);

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as TokenPayload;
      if (!payload.deliveryCaseId || !payload.managerEmail || typeof payload.exp !== 'number') {
        return null;
      }
      if (Date.now() > payload.exp) return null;

      return { deliveryCaseId: payload.deliveryCaseId, managerEmail: payload.managerEmail };
    } catch {
      return null;
    }
  }

  private sign(encoded: string): string {
    return createHmac('sha256', this.secret).update(encoded).digest('base64url');
  }
}
