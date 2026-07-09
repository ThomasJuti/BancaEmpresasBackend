import {
  isValidColombianMobile,
  isValidEmail,
  looksLikeEmpresaNit,
  looksLikeNaturalPersonDocument,
  normalizeIdentification,
} from './colombian-id.js';
import type { PowerAppRequest } from './power-app-request.js';
import type { ValidationIssue } from './validation-issue.js';

const PRODUCTO_ESPERADO = 'TC_LATAM_BUSINESS';
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

function validateIdentificationSwap(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nit = normalizeIdentification(request.empresa.nit);
  const doc = normalizeIdentification(request.tarjetahabiente.numeroDocumento);

  if (nit === doc) {
    issues.push(
      issue(
        'DUPLICATE_IDENTIFICATION',
        'empresa.nit',
        'El NIT de la empresa y el documento del tarjetahabiente son iguales.',
        'La empresa (NIT) y el tarjetahabiente (persona natural) deben ser identificaciones distintas.',
      ),
    );
    return issues;
  }

  const nitLooksLikeCedula =
    looksLikeNaturalPersonDocument(request.empresa.nit) && !looksLikeEmpresaNit(request.empresa.nit);
  const docLooksLikeNit =
    looksLikeEmpresaNit(request.tarjetahabiente.numeroDocumento) &&
    !looksLikeNaturalPersonDocument(request.tarjetahabiente.numeroDocumento);

  if (nitLooksLikeCedula && docLooksLikeNit) {
    issues.push(
      issue(
        'FIELD_SWAP_NIT_CEDULA',
        'empresa.nit',
        'Parece que el NIT de la empresa y el documento del tarjetahabiente están invertidos.',
        `Intercambie los valores: use ${doc} como NIT de empresa y ${nit} como documento del tarjetahabiente.`,
      ),
      issue(
        'FIELD_SWAP_NIT_CEDULA',
        'tarjetahabiente.numeroDocumento',
        'El documento del tarjetahabiente tiene formato de NIT empresarial.',
        'El tarjetahabiente debe ser una persona natural (cédula u otro doc. PN), no el NIT de la empresa.',
      ),
    );
    return issues;
  }

  if (!looksLikeEmpresaNit(request.empresa.nit)) {
    issues.push(
      issue(
        'INVALID_FORMAT',
        'empresa.nit',
        'El NIT de la empresa no tiene un formato válido de persona jurídica.',
        'Verifique que ingresó el NIT de la empresa (típicamente 9 dígitos, suele iniciar en 8 o 9) y no la cédula del tarjetahabiente.',
      ),
    );
  }

  if (!looksLikeNaturalPersonDocument(request.tarjetahabiente.numeroDocumento)) {
    issues.push(
      issue(
        'INVALID_FORMAT',
        'tarjetahabiente.numeroDocumento',
        'El documento del tarjetahabiente no parece corresponder a una persona natural.',
        'Ingrese la cédula (u otro documento PN) del colaborador o representante designado, no el NIT de la empresa.',
      ),
    );
  }

  return issues;
}

function validateCupo(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { solicitado, disponibleCec } = request.cupo;

  if (!Number.isFinite(solicitado) || solicitado <= 0) {
    issues.push(
      issue(
        'CUPO_INVALIDO',
        'cupo.solicitado',
        'El cupo solicitado debe ser un valor mayor a cero.',
      ),
    );
    return issues;
  }

  if (disponibleCec !== undefined && solicitado > disponibleCec) {
    issues.push(
      issue(
        'CUPO_EXCEDE_DISPONIBLE',
        'cupo.solicitado',
        'El cupo solicitado supera el disponible reportado en CEC.',
        `El cupo máximo disponible es ${disponibleCec.toLocaleString('es-CO')}.`,
      ),
    );
  }

  return issues;
}

function validateAgendamiento(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fecha = new Date(`${request.entrega.fechaAgendamiento}T12:00:00`);

  if (Number.isNaN(fecha.getTime())) {
    issues.push(
      issue('INVALID_FORMAT', 'entrega.fechaAgendamiento', 'La fecha de agendamiento no es válida.'),
    );
    return issues;
  }

  const day = fecha.getDay();
  if (day === 0 || day === 6) {
    issues.push(
      issue(
        'AGENDAMIENTO_FIN_DE_SEMANA',
        'entrega.fechaAgendamiento',
        'El agendamiento solo se permite de lunes a viernes.',
        'Seleccione un día hábil para la entrega.',
      ),
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (fecha < today) {
    issues.push(
      issue(
        'AGENDAMIENTO_PASADO',
        'entrega.fechaAgendamiento',
        'La fecha de agendamiento no puede ser anterior a hoy.',
      ),
    );
  }

  return issues;
}

function validateCamaraComercio(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { camaraComercio, empresa } = request;

  if (!camaraComercio.archivoNombre?.trim()) {
    issues.push(
      issue(
        'CAMARA_COMERCIO_REQUERIDA',
        'camaraComercio.archivoNombre',
        'Debe adjuntar el certificado de Cámara de Comercio.',
      ),
    );
    return issues;
  }

  const nombre = camaraComercio.archivoNombre.toLowerCase();
  if (!nombre.endsWith('.pdf')) {
    issues.push(
      issue(
        'INVALID_FORMAT',
        'camaraComercio.archivoNombre',
        'El certificado de Cámara de Comercio debe ser un archivo PDF.',
        'Adjunte el certificado en formato .pdf',
        'warning',
      ),
    );
  }

  if (camaraComercio.nitCertificado) {
    const nitEmpresa = normalizeIdentification(empresa.nit);
    const nitCert = normalizeIdentification(camaraComercio.nitCertificado);
    if (nitEmpresa !== nitCert) {
      issues.push(
        issue(
          'CAMARA_COMERCIO_NIT_NO_COINCIDE',
          'camaraComercio.nitCertificado',
          'El NIT del certificado de Cámara de Comercio no coincide con el NIT de la empresa.',
          'Verifique que el PDF corresponde a la empresa solicitante.',
        ),
      );
    }
  }

  return issues;
}

function validateContacto(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { tarjetahabiente } = request;

  if (!tarjetahabiente.nombres.trim() || !tarjetahabiente.apellidos.trim()) {
    issues.push(
      issue(
        'MISSING_TARJETAHABIENTE_DATA',
        'tarjetahabiente.nombres',
        'Debe registrar el nombre completo del tarjetahabiente.',
      ),
    );
  }

  if (!isValidEmail(tarjetahabiente.email)) {
    issues.push(
      issue(
        'INVALID_FORMAT',
        'tarjetahabiente.email',
        'El correo del tarjetahabiente no es válido.',
      ),
    );
  }

  if (!isValidColombianMobile(tarjetahabiente.telefono)) {
    issues.push(
      issue(
        'INVALID_FORMAT',
        'tarjetahabiente.telefono',
        'El teléfono debe ser un celular colombiano válido (10 dígitos, inicia en 3).',
      ),
    );
  }

  return issues;
}

function validateProductoYSegmento(request: PowerAppRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (request.producto.codigo.toUpperCase() !== PRODUCTO_ESPERADO) {
    issues.push(
      issue(
        'PRODUCTO_INVALIDO',
        'producto.codigo',
        `El producto debe ser ${PRODUCTO_ESPERADO}.`,
        'La campaña actual solo permite solicitudes de Tarjeta de Crédito LATAM Business.',
      ),
    );
  }

  const segmento = request.empresa.segmento.trim().toLowerCase();
  if (!SEGMENTOS_ELEGIBLES.has(segmento)) {
    issues.push(
      issue(
        'SEGMENTO_NO_ELEGIBLE',
        'empresa.segmento',
        'El segmento de la empresa no es elegible para esta campaña.',
        'Segmentos válidos: Pyme Pequeña, Pyme Mediana, Empresarial 1, Empresarial o Corporativo.',
        'warning',
      ),
    );
  }

  return issues;
}

export function validatePowerAppRequest(request: PowerAppRequest): ValidationIssue[] {
  return [
    ...validateIdentificationSwap(request),
    ...validateCupo(request),
    ...validateAgendamiento(request),
    ...validateCamaraComercio(request),
    ...validateContacto(request),
    ...validateProductoYSegmento(request),
  ];
}
