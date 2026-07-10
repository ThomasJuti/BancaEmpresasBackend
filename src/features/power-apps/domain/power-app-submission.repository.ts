import type { PowerAppDecision, ValidationIssue } from './validation-issue.js';
import type { SubmitPowerAppDto } from '../application/dtos/submit-power-app.dto.js';

export interface PowerAppSubmissionPayload {
  segmento: string;
  tipoIdentificacionEmpresa: 'NIT';
  tipoIdentificacionTarjetahabiente: string;
  numeroIdentificacionTarjetahabiente: string;
  unidadNegocios: string;
  tipoTarjetaNueva: string;
  identificacionEmpresa: string;
  nombreEmpresa: string;
  nombreTarjetahabiente: string;
  binProducto: string;
  cargoDebitoAutomatico: string;
  cupoTarjetaNueva: number;
  cupoDisponibleCec?: number;
  codigoOficinaCentroServicio: string;
  ciudadPuntoEntrega: string;
  direccionPuntoComercial: string;
  puntoEntrega: string;
  leadId?: string;
  campana?: string;
  asesorId?: string;
}

export interface PowerAppSubmissionRecord {
  id: string;
  caseId: string;
  leadId: string;
  radicado: string | null;
  decision: PowerAppDecision;
  valid: boolean;
  summary: string;
  siguientePaso: string | null;
  payload: PowerAppSubmissionPayload;
  issues: ValidationIssue[];
  attachmentNames: string[];
  documentoOrigen?: 'RUES' | 'MANUAL';
  ruesSolicitudId?: string;
  submittedAt: string;
}

export interface SavePowerAppSubmissionInput {
  caseId: string;
  leadId: string;
  radicado: string | null;
  decision: PowerAppDecision;
  valid: boolean;
  summary: string;
  siguientePaso: string | null;
  payload: PowerAppSubmissionPayload;
  issues: ValidationIssue[];
  attachmentNames: string[];
  documentoOrigen?: 'RUES' | 'MANUAL';
  ruesSolicitudId?: string;
  submittedAt: string;
}

export interface PowerAppSubmissionRepository {
  save(input: SavePowerAppSubmissionInput): Promise<PowerAppSubmissionRecord>;
  findLatestByLeadId(leadId: string): Promise<PowerAppSubmissionRecord | null>;
}

export function buildSubmissionPayload(dto: SubmitPowerAppDto): PowerAppSubmissionPayload {
  return {
    leadId: dto.leadId,
    campana: dto.campana,
    asesorId: dto.asesorId,
    segmento: dto.segmento,
    tipoIdentificacionEmpresa: dto.tipoIdentificacionEmpresa,
    tipoIdentificacionTarjetahabiente: dto.tipoIdentificacionTarjetahabiente,
    numeroIdentificacionTarjetahabiente: dto.numeroIdentificacionTarjetahabiente,
    unidadNegocios: dto.unidadNegocios,
    tipoTarjetaNueva: dto.tipoTarjetaNueva,
    identificacionEmpresa: dto.identificacionEmpresa,
    nombreEmpresa: dto.nombreEmpresa,
    nombreTarjetahabiente: dto.nombreTarjetahabiente,
    binProducto: dto.binProducto,
    cargoDebitoAutomatico: dto.cargoDebitoAutomatico,
    cupoTarjetaNueva: dto.cupoTarjetaNueva,
    cupoDisponibleCec: dto.cupoDisponibleCec,
    codigoOficinaCentroServicio: dto.codigoOficinaCentroServicio,
    ciudadPuntoEntrega: dto.ciudadPuntoEntrega,
    direccionPuntoComercial: dto.direccionPuntoComercial,
    puntoEntrega: dto.puntoEntrega,
  };
}
