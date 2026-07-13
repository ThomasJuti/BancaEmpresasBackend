import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { notFoundHandler } from './not-found.js';

describe('notFoundHandler', () => {
  it('responde 404 con payload estándar', () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    notFoundHandler({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
});
