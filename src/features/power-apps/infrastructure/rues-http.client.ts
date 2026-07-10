import { env } from '../../../infrastructure/config/env.js';
import { AppError } from '../../../shared/exceptions/app-error.js';
import type { PowerAppFormSnapshot, RuesConsultarResponse } from '../domain/rues-consultation.js';

interface ConsultarBody {
  nit: string;
  headed?: boolean;
  captcha_timeout_sec?: number;
}

function mapRepresentantes(raw: Array<Record<string, string>> | undefined) {
  return (raw ?? []).map((item) => ({
    documento: item.Documento ?? item.documento ?? '',
    nombre: item.Nombre ?? item.nombre ?? '',
  }));
}

export class RuesHttpClient {
  async health(): Promise<{ status: string }> {
    const response = await this.fetchWithTimeout(`${env.rues.serviceUrl}/health`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new AppError('Servicio RUES no disponible', 503, 'RUES_UNAVAILABLE');
    }
    return (await response.json()) as { status: string };
  }

  async consultar(nit: string, options?: { headed?: boolean; mock?: boolean }): Promise<RuesConsultarResponse> {
    const path = options?.mock ? '/consultar/mock' : '/consultar';
    const body: ConsultarBody = { nit };
    if (!options?.mock) {
      body.headed = options?.headed ?? false;
    }

    const response = await this.fetchWithTimeout(`${env.rues.serviceUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      let message = 'No se pudo consultar el registro RUES.';
      try {
        const parsed = JSON.parse(detail) as { detail?: string; message?: string; error?: string };
        message = parsed.detail ?? parsed.message ?? parsed.error ?? message;
      } catch {
        if (detail.trim()) {
          message = detail.trim();
        }
      }
      const status = response.status === 404 ? 404 : 502;
      throw new AppError(message, status, 'RUES_QUERY_FAILED');
    }

    const payload = (await response.json()) as {
      consultation: {
        solicitudId: string;
        nit: string;
        consultadoEn: string;
        urlConsulta: string;
        razonSocial: string;
        datos: Record<string, string>;
        secciones?: Record<string, Record<string, string>>;
        representantes?: Array<Record<string, string>>;
        actividades?: string[];
      };
      pdfFilename: string;
      pdfBase64?: string | null;
      mock?: boolean;
    };

    return {
      consultation: {
        solicitudId: payload.consultation.solicitudId,
        nit: payload.consultation.nit,
        consultadoEn: payload.consultation.consultadoEn,
        urlConsulta: payload.consultation.urlConsulta,
        razonSocial: payload.consultation.razonSocial,
        datos: payload.consultation.datos ?? {},
        secciones: payload.consultation.secciones ?? {},
        representantes: mapRepresentantes(payload.consultation.representantes),
        actividades: payload.consultation.actividades ?? [],
      },
      pdfFilename: payload.pdfFilename,
      pdfBase64: payload.pdfBase64 ?? null,
      mock: payload.mock,
    };
  }

  toFormSnapshot(form: PowerAppFormSnapshot): PowerAppFormSnapshot {
    return form;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.rues.requestTimeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError('Tiempo de espera agotado consultando RUES', 504, 'RUES_TIMEOUT');
      }
      throw new AppError('No se pudo contactar el servicio RUES', 503, 'RUES_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }
}
