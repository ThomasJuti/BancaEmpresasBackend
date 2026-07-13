import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const envMock = vi.hoisted(() => ({
  cron: { secret: '' as string },
  nodeEnv: 'test' as string,
}));

vi.mock('../../infrastructure/config/env.js', () => ({ env: envMock }));

import { verifyCronSecret } from './verify-cron-secret.js';

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

describe('verifyCronSecret', () => {
  beforeEach(() => {
    envMock.cron.secret = '';
    envMock.nodeEnv = 'test';
  });

  it('permite paso en desarrollo sin secret configurado', () => {
    const next = vi.fn();
    verifyCronSecret({ headers: {} } as Request, mockRes(), next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('bloquea en producción sin secret', () => {
    envMock.nodeEnv = 'production';
    const res = mockRes();
    const next = vi.fn();
    verifyCronSecret({ headers: {} } as Request, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza bearer inválido', () => {
    envMock.cron.secret = 'cron-secret';
    const res = mockRes();
    const next = vi.fn();
    verifyCronSecret({ headers: { authorization: 'Bearer wrong' } } as Request, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('acepta bearer válido', () => {
    envMock.cron.secret = 'cron-secret';
    const next = vi.fn();
    verifyCronSecret(
      { headers: { authorization: 'Bearer cron-secret' } } as Request,
      mockRes(),
      next as NextFunction,
    );
    expect(next).toHaveBeenCalled();
  });
});
