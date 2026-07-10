import type { FollowUpCallService } from '../../../shared/contracts/follow-up-call.js';
import type { FollowUpCase, FollowUpRemindersResumen } from '../domain/entities.js';
import {
  DIA_INACTIVACION,
  diasSinUso,
  faseDe,
  isReminderDue,
  toE164Colombia,
} from '../domain/follow-up-policy.js';
import type { FollowUpCaseRepository } from '../domain/repository.js';

/**
 * Tick del cron de recordatorios por inactividad: para cada caso cuya cadencia
 * lo exige (mes 1: día 30; mes 2: cada 15 días; mes 3: semanal), dispara la
 * llamada de recordatorio y registra el envío. Un fallo puntual no aborta el
 * lote (mismo patrón que process-due-emails / DispatchCallBatches).
 */
export class ProcessUsageRemindersUseCase {
  private isRunning = false;

  constructor(
    private readonly repository: FollowUpCaseRepository,
    private readonly followUpCalls: FollowUpCallService,
    private readonly dayMs: number,
  ) {}

  async execute(now = new Date()): Promise<FollowUpRemindersResumen> {
    if (this.isRunning) {
      return { procesados: 0, llamadasIniciadas: 0, errores: 0 }; // tick solapado: no-op
    }
    this.isRunning = true;
    try {
      const casos = await this.repository.findAll();
      const vencidos = casos.filter((caso) => isReminderDue(caso, now, this.dayMs));

      let llamadasIniciadas = 0;
      let errores = 0;

      for (const caso of vencidos) {
        try {
          await this.llamarRecordatorio(caso, now);
          await this.repository.registerReminder(caso.clienteId, now);
          llamadasIniciadas += 1;
        } catch (error) {
          errores += 1;
          console.error(
            `activation-follow-up: recordatorio falló — ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      return { procesados: vencidos.length, llamadasIniciadas, errores };
    } finally {
      this.isRunning = false;
    }
  }

  private async llamarRecordatorio(caso: FollowUpCase, now: Date): Promise<void> {
    const phoneNumber = caso.telefono ? toE164Colombia(caso.telefono) : null;
    if (!phoneNumber) {
      throw new Error(`caso ${caso.id} sin teléfono válido`);
    }

    const dias = diasSinUso(caso, now, this.dayMs);
    await this.followUpCalls.initiate({
      tipo: 'recordatorio_uso',
      phoneNumber,
      customerName: caso.clienteNombre ?? undefined,
      nit: caso.clienteId,
      caseId: caso.caseId ?? undefined,
      variables: {
        ...(caso.clienteNombre ? { nombre_cliente: caso.clienteNombre, empresa: caso.clienteNombre } : {}),
        dias_sin_uso: String(dias),
        fase: faseDe(dias),
        dias_para_inactivacion: String(Math.max(0, DIA_INACTIVACION - dias)),
      },
    });
  }
}
