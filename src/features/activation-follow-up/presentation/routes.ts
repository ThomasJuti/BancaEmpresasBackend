import { Router } from 'express';
import type { FollowUpCallService } from '../../../shared/contracts/follow-up-call.js';
import { verifyCronSecret } from '../../../shared/middlewares/verify-cron-secret.js';
import { getActivationFollowUpDeps } from '../infrastructure/composition.js';
import { ActivationFollowUpController } from './controller.js';

/**
 * Seguimiento de uso de la TC (etapa activation_follow_up):
 * - POST /cases: check "entrega finalizada" (1ª vez → llamada de felicitación)
 * - cron process-reminders: llamadas por inactividad (mes 1 / cada 15 días / semanal)
 * El FollowUpCallService lo implementa sales-calls y llega del composition root.
 */
export function createActivationFollowUpRouter(followUpCalls: FollowUpCallService): Router {
  const router = Router();

  // Composición perezosa: /health debe responder aunque Supabase no esté configurado.
  let controller: ActivationFollowUpController | null = null;
  const getController = (): ActivationFollowUpController => {
    if (!controller) {
      controller = new ActivationFollowUpController(getActivationFollowUpDeps(followUpCalls));
    }
    return controller;
  };

  router.get('/health', (_req, res) => {
    res.json({ feature: 'activation-follow-up', status: 'ok', provider: 'fonema.ia' });
  });

  router.get('/cases', (req, res) => getController().listCases(req, res));
  router.post('/cases', (req, res) => getController().finalizeDelivery(req, res));
  // Disparo del procesador desde la app (botón "Actualizar" de Seguimiento).
  // No lleva secreto como el cron: la propia cadencia (isReminderDue +
  // lastReminderAt) evita reenvíos, así que no puede spamear a un cliente.
  router.post('/cases/process-reminders', (req, res) =>
    getController().processReminders(req, res),
  );
  router.post('/cases/:clienteId/usage', (req, res) => getController().registerUsage(req, res));

  router.get('/cron/process-reminders', verifyCronSecret, (req, res) =>
    getController().processReminders(req, res),
  );
  router.post('/cron/process-reminders', verifyCronSecret, (req, res) =>
    getController().processReminders(req, res),
  );

  return router;
}
