export type ValidationSeverity = 'error' | 'warning';

export type ValidationIssueCode =
  | 'REQUIRED_FIELD'
  | 'INVALID_FORMAT'
  | 'FIELD_SWAP_NIT_CEDULA'
  | 'DUPLICATE_IDENTIFICATION'
  | 'CUPO_EXCEDE_DISPONIBLE'
  | 'CUPO_INVALIDO'
  | 'PRODUCTO_INVALIDO'
  | 'BIN_PRODUCTO_INVALIDO'
  | 'ADJUNTOS_REQUERIDOS'
  | 'SEGMENTO_NO_ELEGIBLE'
  | 'MISSING_TARJETAHABIENTE_DATA';

export interface ValidationIssue {
  code: ValidationIssueCode;
  field: string;
  message: string;
  severity: ValidationSeverity;
  suggestion?: string;
}

export type PowerAppDecision = 'APROBADO' | 'RECHAZADO' | 'DEVUELTO';
