import { describe, expect, it } from 'vitest';
import {
  isValidColombianMobile,
  isValidEmail,
  looksLikeEmpresaNit,
  looksLikeNaturalPersonDocument,
  looksLikeTarjetahabienteDocument,
  normalizeIdentification,
} from './colombian-id.js';

describe('normalizeIdentification', () => {
  it('elimina puntos, guiones y espacios', () => {
    expect(normalizeIdentification('900.123.456-7')).toBe('9001234567');
  });
});

describe('looksLikeEmpresaNit', () => {
  it('acepta NIT de 9-10 dígitos', () => {
    expect(looksLikeEmpresaNit('900123456')).toBe(true);
    expect(looksLikeEmpresaNit('9001234567')).toBe(true);
  });

  it('rechaza documentos cortos', () => {
    expect(looksLikeEmpresaNit('12345678')).toBe(false);
  });
});

describe('looksLikeTarjetahabienteDocument', () => {
  it('valida cédula sin formato NIT', () => {
    expect(looksLikeTarjetahabienteDocument('12345678', 'CC')).toBe(true);
  });

  it('rechaza NIT como cédula', () => {
    expect(looksLikeTarjetahabienteDocument('9001234567', 'CC')).toBe(false);
  });

  it('valida pasaporte alfanumérico', () => {
    expect(looksLikeTarjetahabienteDocument('AB12345', 'PA')).toBe(true);
  });

  it('valida cédula de extranjería', () => {
    expect(looksLikeTarjetahabienteDocument('123456789012345', 'CE')).toBe(true);
  });

  it('usa fallback para tipo desconocido', () => {
    expect(looksLikeTarjetahabienteDocument('1234567', 'XX' as 'CC')).toBe(true);
  });
});

describe('looksLikeNaturalPersonDocument', () => {
  it('acepta alfanumérico con letras', () => {
    expect(looksLikeNaturalPersonDocument('AB12345')).toBe(true);
  });

  it('rechaza NIT de 9+ dígitos', () => {
    expect(looksLikeNaturalPersonDocument('9001234567')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('valida correos básicos', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
  });
});

describe('isValidColombianMobile', () => {
  it('acepta móvil colombiano de 10 dígitos', () => {
    expect(isValidColombianMobile('3001234567')).toBe(true);
  });

  it('acepta prefijo 57', () => {
    expect(isValidColombianMobile('573001234567')).toBe(true);
  });

  it('rechaza números inválidos', () => {
    expect(isValidColombianMobile('123')).toBe(false);
  });
});
