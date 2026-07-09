import type { PowerAppPrefill } from '../../../shared/contracts/power-app-prefill.js';
import type { Call } from '../domain/Call.js';
import type { CallRepository } from '../domain/CallRepository.js';
import { isCallQualified } from '../domain/qualification.js';

type TipoDocumento = NonNullable<NonNullable<PowerAppPrefill['tarjetahabiente']>['tipoDocumento']>;

const DOC_TYPES: readonly TipoDocumento[] = ['CC', 'CE', 'PA', 'TI'];

function str(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function num(source: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function docType(value: string | undefined): TipoDocumento | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  return DOC_TYPES.find((t) => t === upper);
}

/** Divide un nombre completo en nombres/apellidos (heurística: última palabra = apellidos). */
function splitName(full?: string): { nombres?: string; apellidos?: string } {
  if (!full) return {};
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { nombres: parts[0] };
  const mid = Math.ceil(parts.length / 2);
  return { nombres: parts.slice(0, mid).join(' '), apellidos: parts.slice(mid).join(' ') };
}

function buildPrefill(call: Call): PowerAppPrefill {
  // Las variables de la llamada y el análisis estructurado son las dos fuentes.
  const vars = call.variables ?? {};
  const data = (call.structuredData ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...vars, ...data };

  const nombreCompleto =
    str(merged, 'tarjetahabienteNombre', 'nombreCompleto', 'nombre') ?? call.customerName;
  const nameParts = splitName(nombreCompleto);

  return {
    leadId: str(merged, 'leadId', 'lead_id'),
    campana: str(merged, 'campana', 'campaign'),
    empresa: {
      nit: str(merged, 'nit', 'empresaNit', 'cliente_id'),
      razonSocial: str(merged, 'razonSocial', 'empresa', 'empresaNombre'),
      segmento: str(merged, 'segmento', 'subsegmento'),
      ciudad: str(merged, 'empresaCiudad', 'ciudad'),
      direccion: str(merged, 'empresaDireccion', 'direccion'),
    },
    tarjetahabiente: {
      tipoDocumento: docType(str(merged, 'tipoDocumento')),
      numeroDocumento: str(merged, 'numeroDocumento', 'documento', 'cedula'),
      nombres: str(merged, 'nombres') ?? nameParts.nombres,
      apellidos: str(merged, 'apellidos') ?? nameParts.apellidos,
      cargo: str(merged, 'cargo'),
      email: str(merged, 'email', 'correo') ?? call.customerEmail,
      telefono: str(merged, 'telefono') ?? call.phoneNumber,
    },
    cupo: {
      solicitado: num(merged, 'cupoSolicitado', 'cupo'),
      disponibleCec: num(merged, 'cupoDisponible', 'disponibleCec'),
    },
    producto: {
      codigo: str(merged, 'productoCodigo') ?? 'TC_LATAM_BUSINESS',
      franquicia: str(merged, 'franquicia') ?? 'VISA',
    },
    origenLlamada: {
      callId: call.id,
      sessionId: call.sessionId,
      resumen: call.summary,
      grabacionUrl: call.recordingUrl,
      finalizadaEn: call.updatedAt,
    },
  };
}

/**
 * Handoff a la powerup: mapea una llamada CALIFICADA al prefill de la solicitud.
 * Devuelve null si la llamada no existe o no calificó (la ruta responde 404).
 */
export class BuildPowerAppPrefillUseCase {
  constructor(private readonly callRepository: CallRepository) {}

  async execute(callId: string): Promise<PowerAppPrefill | null> {
    const call = await this.callRepository.findById(callId);
    if (!call || !isCallQualified(call)) return null;
    return buildPrefill(call);
  }
}
