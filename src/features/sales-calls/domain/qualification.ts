import type { Call } from './Call.js';

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === 'si' || v === 'sí' || v === 'yes' || v === '1';
  }
  return false;
}

/**
 * Una llamada está CALIFICADA para el handoff a power-apps cuando el análisis de
 * Fonema indica identidad verificada + cliente interesado. Se acepta tanto el
 * `successEvaluation` global como banderas en `structuredData` (según cómo el
 * agente configure la extracción en el dashboard).
 */
export function isCallQualified(call: Call): boolean {
  if (call.status !== 'completed') return false;

  const data = call.structuredData ?? {};
  const identidad = asBool(data.identidad_verificada ?? data.identidadVerificada);
  const interesado = asBool(data.cliente_interesado ?? data.clienteInteresado);
  if (identidad && interesado) return true;

  // Fallback: successEvaluation positiva y sin señales negativas explícitas.
  const success = asBool(call.successEvaluation);
  return success && identidad !== false && interesado !== false;
}
