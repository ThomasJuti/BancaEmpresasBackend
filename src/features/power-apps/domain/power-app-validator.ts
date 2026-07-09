import {
  looksLikeEmpresaNit,
  looksLikeNaturalPersonDocument,
  normalizeIdentification,
} from './colombian-id.js';
import { isBinLatamBusiness, isTipoTarjetaLatamBusiness, TIPO_TARJETA_LATAM_BUSINESS } from './latam-business.js';
import type { PowerAppRequest } from './power-app-request.js';
import type { ValidationIssue } from './validation-issue.js';

const SEGMENTOS_ELEGIBLES = new Set([
  'pyme pequeña',
  'pyme mediana',
  'empresarial 1',
  'empresarial',
  'corporativo',
  'pyme',
]);

function issue(
  code: ValidationIssue['code'],
  field: string,
  message: string,
  suggestion?: string,
  severity: ValidationIssue['severity'] = 'error',
): ValidationIssue {
  return { code, field, message, severity, suggestion };
}

function validateIdentificaciones(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nit = normalizeIdentification(request.identificacionEmpresa);
  const doc = normalizeIdentification(request.numeroIdentificacionTarjetahabiente);

  if (nit === doc) {
    issues.push(
      issue(
        'DUPLICATE_IDENTIFICATION',
        'identificacionEmpresa',
        'La identificación de la empresa y la del tarjetahabiente son iguales.',
        'La empresa (NIT) y el tarjetahabiente (persona natural) deben ser identificaciones distintas.',
      ),
    );
    return issues;
  }

  const nitLooksLikeCedula =
    looksLikeNaturalPersonDocument(request.identificacionEmpresa) &&
    !looksLikeEmpresaNit(request.identificacionEmpresa);
  const docLooksLikeNit =
    looksLikeEmpresaNit(request.numeroIdentificacionTarjetahabiente) &&
    !looksLikeNaturalPersonDocument(request.numeroIdentificacionTarjetahabiente);

  if (nitLooksLikeCedula && docLooksLikeNit) {
    issues.push(
      issue(
        'FIELD_SWAP_NIT_CEDULA',
        'identificacionEmpresa',
        'Parece que la identificación de la empresa y la del tarjetahabiente están invertidas.',
        `Intercambie los valores: use ${doc} como identificación de empresa y ${nit} como número del tarjetahabiente.`,
      ),
      issue(
        'FIELD_SWAP_NIT_CEDULA',
        'numeroIdentificacionTarjetahabiente',
        'El número del tarjetahabiente tiene formato de NIT empresarial.',
        'El tarjetahabiente debe ser una persona natural (cédula u otro documento PN).',
      ),
    );
    return issues;
  }

  if (!looksLikeEmpresaNit(request.identificacionEmpresa)) {
    issues.push(
      issue(
        'INVALID_FORMAT',
        'identificacionEmpresa',
        'La identificación de la empresa no tiene un formato válido de NIT.',
        'Verifique que ingresó el NIT de la empresa y no la cédula del tarjetahabiente.',
      ),
    );
  }

  if (!looksLikeNaturalPersonDocument(request.numeroIdentificacionTarjetahabiente)) {
    issues.push(
      issue(
        'INVALID_FORMAT',
        'numeroIdentificacionTarjetahabiente',
        'El número de identificación del tarjetahabiente no parece corresponder a una persona natural.',
        'Ingrese la cédula (u otro documento PN) del colaborador o representante designado.',
      ),
    );
  }

  return issues;
}

function validateProductoLatamBusiness(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isTipoTarjetaLatamBusiness(request.tipoTarjetaNueva)) {
    issues.push(
      issue(
        'PRODUCTO_INVALIDO',
        'tipoTarjetaNueva',
        `En esta campaña solo se permite solicitar ${TIPO_TARJETA_LATAM_BUSINESS}.`,
        `Seleccione "${TIPO_TARJETA_LATAM_BUSINESS}" en el campo Tipo de tarjeta nueva.`,
      ),
    );
  }

  if (!/^\d{6}$/.test(request.binProducto.replace(/\D/g, ''))) {
    issues.push(
      issue(
        'INVALID_FORMAT',
        'binProducto',
        'El BIN del producto debe ser numérico de 6 dígitos.',
      ),
    );
  } else if (!isBinLatamBusiness(request.binProducto)) {
    issues.push(
      issue(
        'BIN_PRODUCTO_INVALIDO',
        'binProducto',
        'El BIN seleccionado no corresponde al producto LATAM Business.',
        'Seleccione el BIN asociado a Tarjeta de Crédito LATAM Business.',
      ),
    );
  }

  return issues;
}

function validateCupo(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Number.isFinite(request.cupoTarjetaNueva) || request.cupoTarjetaNueva <= 0) {
    issues.push(
      issue(
        'CUPO_INVALIDO',
        'cupoTarjetaNueva',
        'El cupo de la tarjeta nueva debe ser un valor mayor a cero.',
      ),
    );
    return issues;
  }

  if (
    request.cupoDisponibleCec !== undefined &&
    request.cupoTarjetaNueva > request.cupoDisponibleCec
  ) {
    issues.push(
      issue(
        'CUPO_EXCEDE_DISPONIBLE',
        'cupoTarjetaNueva',
        'El cupo solicitado supera el disponible reportado en CEC.',
        `El cupo máximo disponible es ${request.cupoDisponibleCec.toLocaleString('es-CO')}.`,
      ),
    );
  }

  return issues;
}

function validateAdjuntos(request: PowerAppRequest): ValidationIssue[] {
  if (!request.archivosAdjuntos.length) {
    return [
      issue(
        'ADJUNTOS_REQUERIDOS',
        'archivosAdjuntos',
        'Debe adjuntar al menos una imagen del caso.',
        'Use "Subir imágenes del caso" en la Power App e incluya el PDF de Cámara de Comercio.',
      ),
    ];
  }

  const hasPdf = request.archivosAdjuntos.some((name) => name.trim().toLowerCase().endsWith('.pdf'));
  if (!hasPdf) {
    return [
      issue(
        'ADJUNTOS_REQUERIDOS',
        'archivosAdjuntos',
        'Debe adjuntar el PDF de Cámara de Comercio.',
        'Incluya un archivo .pdf del certificado de Cámara de Comercio en archivosAdjuntos.',
      ),
    ];
  }

  return [];
}

function validateEntrega(request: PowerAppRequest): ValidationIssue[] {
  if (!/^\d{3,4}$/.test(request.codigoOficinaCentroServicio.replace(/\D/g, ''))) {
    return [
      issue(
        'INVALID_FORMAT',
        'codigoOficinaCentroServicio',
        'El código de oficina / centro de servicio debe ser numérico (ej. 610).',
      ),
    ];
  }
  return [];
}

function validateSegmento(request: PowerAppRequest): ValidationIssue[] {
  const segmento = request.segmento.trim().toLowerCase();
  if (!SEGMENTOS_ELEGIBLES.has(segmento)) {
    return [
      issue(
        'SEGMENTO_NO_ELEGIBLE',
        'segmento',
        'El segmento de la empresa no es elegible para esta campaña.',
        'Segmentos válidos: Pyme Pequeña, Pyme Mediana, Empresarial 1, Empresarial o Corporativo.',
        'warning',
      ),
    ];
  }
  return [];
}

export function validatePowerAppRequest(request: PowerAppRequest): ValidationIssue[] {
  return [
    ...validateIdentificaciones(request),
    ...validateProductoLatamBusiness(request),
    ...validateCupo(request),
    ...validateAdjuntos(request),
    ...validateEntrega(request),
    ...validateSegmento(request),
  ];
}
