import type { PowerAppFormSnapshot, RuesConsultation } from './rues-consultation.js';
import type { ValidationIssue } from './validation-issue.js';

function normalizeId(value: string): string {
  return value.replace(/[.\-\s]/g, '').trim();
}

/** NIT empresarial: RUES usa 9 dígitos; el formulario puede traer el dígito de verificación (10). */
function normalizeEmpresaNit(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && (digits[0] === '8' || digits[0] === '9')) {
    return digits.slice(0, 9);
  }
  return digits;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeName(value).split(' ').filter((token) => token.length > 2));
}

function nameSimilarity(a: string, b: string): number {
  const tokensA = tokenSet(a);
  const tokensB = tokenSet(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }
  return intersection / Math.max(tokensA.size, tokensB.size);
}

function issue(
  code: ValidationIssue['code'],
  field: string,
  message: string,
  suggestion?: string,
  severity: ValidationIssue['severity'] = 'error',
): ValidationIssue {
  return { code, field, message, severity, suggestion };
}

function findMunicipio(datos: Record<string, string>): string | null {
  const entries = Object.entries(datos);
  for (const [key, value] of entries) {
    const lower = key.toLowerCase();
    if (lower.includes('municipio') || lower.includes('ciudad')) {
      return value;
    }
  }
  return null;
}

export function crossCheckPowerAppWithRues(
  form: PowerAppFormSnapshot,
  consultation: RuesConsultation,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const formNit = normalizeEmpresaNit(form.identificacionEmpresa ?? '');
  const ruesNit = normalizeEmpresaNit(consultation.nit);

  if (formNit && ruesNit && formNit !== ruesNit) {
    issues.push(
      issue(
        'RUES_NIT_MISMATCH',
        'identificacionEmpresa',
        'El NIT del formulario no coincide con el registrado en RUES.',
        `En RUES figura ${consultation.nit}.`,
      ),
    );
  }

  const similarity = nameSimilarity(form.nombreEmpresa ?? '', consultation.razonSocial);
  if (form.nombreEmpresa?.trim() && similarity < 0.45) {
    issues.push(
      issue(
        'RUES_RAZON_SOCIAL_MISMATCH',
        'nombreEmpresa',
        'El nombre de la empresa no coincide claramente con la razón social en RUES.',
        `RUES reporta: ${consultation.razonSocial}.`,
        'warning',
      ),
    );
  }

  const estadoMatricula =
    consultation.datos['Estado de la matrícula'] ??
    consultation.datos['Estado de la matricula'] ??
    '';
  if (estadoMatricula && !/activa/i.test(estadoMatricula)) {
    issues.push(
      issue(
        'RUES_MATRICULA_INACTIVA',
        'archivosAdjuntos',
        'La matrícula en RUES no aparece como activa.',
        `Estado reportado: ${estadoMatricula}.`,
      ),
    );
  }

  const docTarjetahabiente = normalizeId(form.numeroIdentificacionTarjetahabiente ?? '');
  const reps = consultation.representantes ?? [];
  if (docTarjetahabiente && reps.length > 0) {
    const match = reps.some((rep) => normalizeId(rep.documento) === docTarjetahabiente);
    if (!match) {
      const repsLabel = reps.map((rep) => `${rep.documento} - ${rep.nombre}`).join('; ');
      issues.push(
        issue(
          'RUES_REPRESENTANTE_NO_COINCIDE',
          'numeroIdentificacionTarjetahabiente',
          'El tarjetahabiente no figura como representante legal en RUES.',
          `Representantes en RUES: ${repsLabel}. Verifique si hubo cambio de representante legal.`,
          'warning',
        ),
      );
    }
  }

  const municipio = findMunicipio(consultation.datos);
  if (municipio && form.ciudadPuntoEntrega) {
    const citySimilarity = nameSimilarity(form.ciudadPuntoEntrega, municipio);
    if (citySimilarity < 0.5) {
      issues.push(
        issue(
          'RUES_RAZON_SOCIAL_MISMATCH',
          'ciudadPuntoEntrega',
          'La ciudad del punto de entrega no coincide con el municipio reportado en RUES.',
          `RUES reporta municipio: ${municipio}.`,
          'warning',
        ),
      );
    }
  }

  return issues;
}

export function manualPdfWithoutRuesIssue(): ValidationIssue {
  return issue(
    'RUES_MANUAL_PDF_SIN_CONSULTA',
    'archivosAdjuntos',
    'Se adjuntó PDF manual sin consulta previa al RUES.',
    'Se recomienda consultar RUES para contrastar representantes legales y estado de matrícula.',
    'warning',
  );
}
