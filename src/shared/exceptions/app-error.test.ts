import { describe, expect, it } from 'vitest';
import { AppError, NotFoundError, ValidationError } from './app-error.js';

describe('AppError', () => {
  it('conserva statusCode y code', () => {
    const err = new AppError('fail', 418, 'TEAPOT');
    expect(err.message).toBe('fail');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('TEAPOT');
    expect(err.name).toBe('AppError');
  });
});

describe('NotFoundError', () => {
  it('usa 404 por defecto', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ValidationError', () => {
  it('usa 400 por defecto', () => {
    const err = new ValidationError('bad input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});
