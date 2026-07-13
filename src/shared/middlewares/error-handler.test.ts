import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../exceptions/app-error.js';
import { errorHandler } from './error-handler.js';

describe('errorHandler', () => {
  it('responde AppError con status y código', () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    errorHandler(new AppError('bad', 400, 'BAD'), {} as Request, res, vi.fn() as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'BAD', message: 'bad' } });
  });

  it('responde 500 para errores desconocidos', () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('boom'), {} as Request, res, vi.fn() as NextFunction);
    expect(res.status).toHaveBeenCalledWith(500);
    consoleSpy.mockRestore();
  });
});
