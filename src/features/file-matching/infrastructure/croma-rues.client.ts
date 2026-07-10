import { AppError } from '../../../shared/exceptions/app-error.js';
import type { EmpresaRues } from '../domain/entities.js';
import type { RuesProvider } from '../domain/repositories.js';

const RUES_PATH = '/co/rues/entity-by-nit/v1';
const REQUEST_TIMEOUT_MS = 15_000;

/** Forma parcial de la respuesta de Croma RUES (solo lo que consumimos). */
interface RelatedParty {
  document_number?: string | null;
  name?: string | null;
  role?: string | null;
}

interface CiiuActivity {
  code?: string | null;
  description?: string | null;
}

interface RuesResponse {
  found?: boolean;
  society_type?: string | null;
  commercial_address?: string | null;
  commercial_municipality?: string | null;
  primary_activity?: string | null;
  ciiu_4?: CiiuActivity | null;
  related_parties?: RelatedParty[] | null;
}

function trimOrNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** Deja solo dígitos (Croma espera document_number numérico). */
function soloDigitos(nit: string): string {
  return nit.replace(/\D/g, '');
}

/** Elige el representante legal (prioriza el principal) de related_parties. */
function pickRepresentanteLegal(parties: RelatedParty[]): RelatedParty | null {
  const legales = parties.filter((party) => (party.role ?? '').toLowerCase().includes('representante legal'));
  if (legales.length === 0) return null;
  const principal = legales.find((party) => (party.role ?? '').toLowerCase().includes('principal'));
  return principal ?? legales[0];
}

function toEmpresaRues(payload: RuesResponse): EmpresaRues {
  const repLegal = pickRepresentanteLegal(payload.related_parties ?? []);
  return {
    representanteLegalNombre: trimOrNull(repLegal?.name),
    representanteLegalDocumento: trimOrNull(repLegal?.document_number),
    representanteLegalCargo: trimOrNull(repLegal?.role),
    direccionComercial: trimOrNull(payload.commercial_address),
    municipioComercial: trimOrNull(payload.commercial_municipality),
    tipoSociedad: trimOrNull(payload.society_type),
    actividadEconomica: trimOrNull(payload.ciiu_4?.description) ?? trimOrNull(payload.primary_activity),
  };
}

export class CromaRuesClient implements RuesProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
  ) {}

  async findByNit(nit: string): Promise<EmpresaRues | null> {
    const documento = soloDigitos(nit);
    if (documento.length < 4) return null;

    const directo = await this.consultar(documento);
    if (directo?.found) return toEmpresaRues(directo);

    // El cliente_id puede incluir el dígito de verificación; RUES lo espera sin él.
    if (documento.length > 4) {
      const sinDv = documento.slice(0, -1);
      const reintento = await this.consultar(sinDv);
      if (reintento?.found) return toEmpresaRues(reintento);
    }

    return null;
  }

  private async consultar(documentNumber: string): Promise<RuesResponse | null> {
    if (!this.apiUrl || !this.apiKey) {
      throw new AppError('Croma no está configurado (CROMA_API_URL / CROMA_API_KEY).', 500, 'CROMA_NOT_CONFIGURED');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.apiUrl}${RUES_PATH}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_number: documentNumber }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // No se propaga el cuerpo (puede exponer detalles/clave); solo el status.
        throw new AppError(`Croma RUES respondió ${response.status}`, 502, 'CROMA_ERROR');
      }

      return (await response.json()) as RuesResponse;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('No se pudo consultar Croma RUES.', 502, 'CROMA_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }
}
