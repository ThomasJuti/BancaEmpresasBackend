import type { PipelineCaseRepository } from '../../../core/pipeline/domain/pipeline-case.repository.js';
import type { FollowUpCallService } from '../../../shared/contracts/follow-up-call.js';
import type { PipelineStageAdvancer } from '../../../shared/contracts/pipeline.js';
import type { FollowUpCaseView } from '../domain/entities.js';
import { buildFollowUpView, toE164Colombia } from '../domain/follow-up-policy.js';
import type { FollowUpCaseRepository } from '../domain/repository.js';

export interface FinalizeDeliveryInput {
  clienteId: string;
  nombre?: string;
  telefono?: string;
  correo?: string;
}

export interface FinalizeDeliveryResult {
  caso: FollowUpCaseView;
  /** true solo la primera vez, si la llamada de felicitación se pudo iniciar. */
  llamadaFelicitacionIniciada: boolean;
  yaExistia: boolean;
}

/**
 * Check del punto 5 del portafolio: "entrega de la TC finalizada".
 * Idempotente por cliente: la PRIMERA vez crea el caso de seguimiento, dispara
 * la llamada de felicitación (best-effort) y avanza el pipeline a
 * activation_follow_up. Las siguientes veces devuelve el caso sin re-llamar.
 */
export class FinalizeDeliveryUseCase {
  constructor(
    private readonly repository: FollowUpCaseRepository,
    private readonly followUpCalls: FollowUpCallService,
    private readonly pipelineCases: PipelineCaseRepository,
    private readonly pipeline: PipelineStageAdvancer,
    private readonly dayMs: number,
  ) {}

  async execute(input: FinalizeDeliveryInput): Promise<FinalizeDeliveryResult> {
    const now = new Date();

    const existente = await this.repository.findByClienteId(input.clienteId);
    if (existente) {
      return {
        caso: buildFollowUpView(existente, now, this.dayMs),
        llamadaFelicitacionIniciada: false,
        yaExistia: true,
      };
    }

    // Vincular el caso del pipeline y avanzarlo (best-effort: en demos parciales
    // puede no existir o ya estar adelante; eso no bloquea el seguimiento).
    let caseId: string | null = null;
    try {
      caseId = (await this.pipelineCases.ensureByLeadId(input.clienteId)).id;
      await this.pipeline.advance(caseId, 'activation_follow_up');
    } catch (error) {
      console.warn(
        `activation-follow-up: no se pudo avanzar el pipeline — ${error instanceof Error ? error.message : error}`,
      );
    }

    const caso = await this.repository.create({
      clienteId: input.clienteId,
      caseId,
      clienteNombre: input.nombre ?? null,
      telefono: input.telefono ?? null,
      correo: input.correo ?? null,
    });

    const llamadaFelicitacionIniciada = await this.iniciarFelicitacion(caso.clienteId, input, caseId);

    const actualizado = (await this.repository.findByClienteId(input.clienteId)) ?? caso;
    return {
      caso: buildFollowUpView(actualizado, now, this.dayMs),
      llamadaFelicitacionIniciada,
      yaExistia: false,
    };
  }

  /** Llamada de felicitación por la nueva TC (best-effort, solo primera vez). */
  private async iniciarFelicitacion(
    clienteId: string,
    input: FinalizeDeliveryInput,
    caseId: string | null,
  ): Promise<boolean> {
    const phoneNumber = input.telefono ? toE164Colombia(input.telefono) : null;
    if (!phoneNumber) {
      console.warn('activation-follow-up: caso sin teléfono válido, se omite felicitación');
      return false;
    }

    try {
      const { callId } = await this.followUpCalls.initiate({
        tipo: 'felicitacion',
        phoneNumber,
        customerName: input.nombre,
        nit: clienteId,
        caseId: caseId ?? undefined,
        variables: {
          ...(input.nombre ? { nombre_cliente: input.nombre, empresa: input.nombre } : {}),
        },
      });
      await this.repository.setCongratulation(clienteId, callId);
      return true;
    } catch (error) {
      console.error(
        `activation-follow-up: llamada de felicitación falló — ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }
}
