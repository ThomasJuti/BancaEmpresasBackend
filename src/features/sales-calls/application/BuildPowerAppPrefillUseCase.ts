import type { PowerAppPrefill } from '../../../shared/contracts/power-app-prefill.js';
import type { Call } from '../domain/Call.js';
import type { CallRepository } from '../domain/CallRepository.js';
import { isCallQualified } from '../domain/qualification.js';

type TipoDocumento = NonNullable<PowerAppPrefill['tipoIdentificacionTarjetahabiente']>;

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

function buildPrefill(call: Call): PowerAppPrefill {
  const vars = call.variables ?? {};
  const data = (call.structuredData ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...vars, ...data };

  const nombreCompleto =
    str(merged, 'tarjetahabienteNombre', 'nombreCompleto', 'nombre') ?? call.customerName;

  return {
    leadId: str(merged, 'leadId', 'lead_id'),
    campana: str(merged, 'campana', 'campaign'),
    segmento: str(merged, 'segmento', 'subsegmento'),
    tipoIdentificacionEmpresa: 'NIT',
    tipoIdentificacionTarjetahabiente: docType(str(merged, 'tipoDocumento')),
    numeroIdentificacionTarjetahabiente: str(merged, 'numeroDocumento', 'documento', 'cedula'),
    unidadNegocios: str(merged, 'unidadNegocios', 'unidad_negocios'),
    tipoTarjetaNueva: 'LATAM BUSINESS',
    identificacionEmpresa: str(merged, 'nit', 'empresaNit', 'cliente_id', 'identificacionEmpresa'),
    nombreEmpresa: str(merged, 'razonSocial', 'empresa', 'empresaNombre', 'nombreEmpresa'),
    nombreTarjetahabiente: nombreCompleto,
    binProducto: str(merged, 'binProducto', 'bin'),
    cargoDebitoAutomatico: str(merged, 'cargoDebitoAutomatico', 'cargo'),
    cupoTarjetaNueva: num(merged, 'cupoTarjetaNueva', 'cupoSolicitado', 'cupo'),
    cupoDisponibleCec: num(merged, 'cupoDisponibleCec', 'cupoDisponible', 'disponibleCec'),
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
 * Handoff a la Power App: mapea una llamada CALIFICADA al prefill de la solicitud.
 */
export class BuildPowerAppPrefillUseCase {
  constructor(private readonly callRepository: CallRepository) {}

  async execute(callId: string): Promise<PowerAppPrefill | null> {
    const call = await this.callRepository.findById(callId);
    if (!call || !isCallQualified(call)) return null;
    return buildPrefill(call);
  }
}
