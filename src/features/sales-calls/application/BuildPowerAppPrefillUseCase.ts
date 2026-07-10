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

type PuntoEntrega = NonNullable<PowerAppPrefill['puntoEntrega']>;

/** Normaliza lo que el agente haya dicho ("courier", "a comercial"...) al enum del submit. */
function puntoEntrega(value: string | undefined): PuntoEntrega | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v.includes('courier') || v.includes('envio') || v.includes('envío') || v.includes('certificad'))
    return 'ENVIO_CERTIFICADO_COURIER';
  if (v.includes('comercial') || v.includes('punto') || v.includes('gerente'))
    return 'PUNTO_ENTREGA_A_COMERCIAL';
  const upper = value.toUpperCase();
  if (upper === 'ENVIO_CERTIFICADO_COURIER' || upper === 'PUNTO_ENTREGA_A_COMERCIAL')
    return upper as PuntoEntrega;
  return undefined;
}

function buildPrefill(call: Call): PowerAppPrefill {
  // Prioridad: variables de ENTRADA (semilla de file-matching) < análisis <
  // variables de SALIDA (lo que el agente recolectó/confirmó en la llamada).
  const vars = call.variables ?? {};
  const data = (call.structuredData ?? {}) as Record<string, unknown>;
  const output = call.outputVariables ?? {};
  const merged: Record<string, unknown> = { ...vars, ...data, ...output };

  const nombreCompleto =
    str(merged, 'tarjetahabienteNombre', 'nombreCompleto', 'nombre') ?? call.customerName;

  return {
    leadId: str(merged, 'leadId', 'lead_id'),
    campana: str(merged, 'campana', 'campaign'),
    asesorId: str(merged, 'asesorId', 'asesor_id'),
    segmento: str(merged, 'segmento', 'subsegmento'),
    tipoIdentificacionEmpresa: 'NIT',
    tipoIdentificacionTarjetahabiente: docType(str(merged, 'tipoDocumento', 'tipoIdentificacionTarjetahabiente')),
    numeroIdentificacionTarjetahabiente: str(
      merged,
      'numeroDocumento',
      'documento',
      'cedula',
      'numeroIdentificacionTarjetahabiente',
    ),
    unidadNegocios: str(merged, 'unidadNegocios', 'unidad_negocios'),
    tipoTarjetaNueva: 'LATAM BUSINESS',
    identificacionEmpresa: str(merged, 'nit', 'empresaNit', 'cliente_id', 'identificacionEmpresa'),
    nombreEmpresa: str(merged, 'razonSocial', 'empresa', 'empresaNombre', 'nombreEmpresa'),
    nombreTarjetahabiente: nombreCompleto,
    binProducto: str(merged, 'binProducto', 'bin'),
    cargoDebitoAutomatico: str(merged, 'cargoDebitoAutomatico', 'cargo'),
    cupoTarjetaNueva: num(merged, 'cupoTarjetaNueva', 'cupoSolicitado', 'cupo'),
    cupoDisponibleCec: num(merged, 'cupoDisponibleCec', 'cupoDisponible', 'disponibleCec'),
    codigoOficinaCentroServicio: str(
      merged,
      'codigoOficinaCentroServicio',
      'codigoOficina',
      'oficina',
      'centroServicio',
    ),
    ciudadPuntoEntrega: str(merged, 'ciudadPuntoEntrega', 'ciudadEntrega', 'ciudad', 'empresaCiudad'),
    direccionPuntoComercial: str(
      merged,
      'direccionPuntoComercial',
      'direccionEntrega',
      'direccion',
      'empresaDireccion',
    ),
    puntoEntrega: puntoEntrega(str(merged, 'puntoEntrega', 'tipoEntrega', 'entrega', 'medioEntrega')),
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
