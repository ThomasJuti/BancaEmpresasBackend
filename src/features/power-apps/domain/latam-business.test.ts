import { describe, expect, it } from 'vitest';
import {
  BINES_LATAM_BUSINESS,
  isBinLatamBusiness,
  isTipoTarjetaLatamBusiness,
  TIPO_TARJETA_LATAM_BUSINESS,
} from './latam-business.js';

describe('latam-business', () => {
  it('expone constantes esperadas', () => {
    expect(TIPO_TARJETA_LATAM_BUSINESS).toBe('LATAM BUSINESS');
    expect(BINES_LATAM_BUSINESS.has('491250')).toBe(true);
  });

  it('detecta tipos de tarjeta LATAM Business', () => {
    expect(isTipoTarjetaLatamBusiness('LATAM BUSINESS')).toBe(true);
    expect(isTipoTarjetaLatamBusiness('TC_LATAM_BUSINESS')).toBe(true);
    expect(isTipoTarjetaLatamBusiness('latam business visa')).toBe(true);
    expect(isTipoTarjetaLatamBusiness('VISA PLATINUM')).toBe(false);
  });

  it('detecta BIN válido ignorando caracteres no numéricos', () => {
    expect(isBinLatamBusiness('491-250')).toBe(true);
    expect(isBinLatamBusiness('549166')).toBe(true);
    expect(isBinLatamBusiness('123456')).toBe(false);
  });
});
