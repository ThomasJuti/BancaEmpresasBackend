import { describe, expect, it } from 'vitest';
import type { Call } from './Call.js';
import { isCallQualified } from './qualification.js';

function makeCall(overrides: Partial<Call> = {}): Call {
  return {
    id: 'call-1',
    agentId: 'agent',
    phoneNumber: '+573001234567',
    variables: {},
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isCallQualified', () => {
  it('requiere estado completed', () => {
    expect(isCallQualified(makeCall({ status: 'queued' }))).toBe(false);
  });

  it('califica con identidad e interés verdaderos', () => {
    expect(
      isCallQualified(
        makeCall({
          structuredData: { identidad_verificada: 'Verdadero', cliente_interesado: 'sí' },
        }),
      ),
    ).toBe(true);
  });

  it('califica con successEvaluation cuando no hay datos explícitos negativos', () => {
    expect(isCallQualified(makeCall({ successEvaluation: true }))).toBe(true);
  });

  it('no califica con identidad falsa', () => {
    expect(
      isCallQualified(
        makeCall({
          successEvaluation: true,
          structuredData: { identidad_verificada: 'Falso' },
        }),
      ),
    ).toBe(false);
  });

  it('parsea valores tri-state en string', () => {
    expect(
      isCallQualified(
        makeCall({
          structuredData: { identidadVerificada: '1', clienteInteresado: 'no' },
        }),
      ),
    ).toBe(false);
  });
});
