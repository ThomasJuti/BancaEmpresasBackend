import { Router } from 'express';
import { z } from 'zod';
import { registerShipment } from '../application/register-shipment.js';
import { confirmDelivery } from '../application/confirm-delivery.js';
import { getCaseStatus, getConfirmationView } from '../application/get-case-status.js';
import { processDueEmails } from '../application/process-due-emails.js';
import { getDeliveryConfirmationDeps } from '../infrastructure/composition.js';
import { ValidationError } from '../../../shared/exceptions/app-error.js';
import { verifyCronSecret } from '../../../shared/middlewares/verify-cron-secret.js';

/**
 * Confirmación de entrega física de tarjeta al gerente de la empresa.
 * Tras ~3–4 días (emulados) del envío se notifica por correo (Resend);
 * el gerente confirma desde el frontend y el pipeline avanza o se
 * reprograma un reintento a +1 día.
 */
export const deliveryConfirmationRouter = Router();

const registerShipmentSchema = z.object({
  caseId: z.string().uuid(),
  cardId: z.string().min(1).max(64),
  companyId: z.string().min(1).max(64),
  cardHolderName: z.string().min(1).max(120),
  cardLastFour: z.string().regex(/^\d{4}$/, 'cardLastFour must be exactly 4 digits'),
  physicalShippedAt: z.string().datetime().optional(),
});

const confirmSchema = z.object({
  token: z.string().min(10).max(2048),
  outcome: z.enum(['delivered_to_holder', 'not_arrived', 'holder_absent', 'return_to_bank']),
});

const tokenParamSchema = z.string().min(10).max(2048);
const caseIdParamSchema = z.string().uuid();

/** Registra el envío físico de una tarjeta y agenda el correo (t0 + 3–4 días). */
deliveryConfirmationRouter.post('/shipments', async (req, res) => {
  const parsed = registerShipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid shipment payload');
  }

  const deps = getDeliveryConfirmationDeps();
  const created = await registerShipment(parsed.data, deps);

  res.status(201).json({
    id: created.id,
    caseId: created.caseId,
    status: created.status,
    emailScheduledAt: created.emailScheduledAt,
  });
});

/** Datos mínimos para renderizar la página de confirmación del frontend. */
deliveryConfirmationRouter.get('/confirmations/:token', async (req, res) => {
  const parsed = tokenParamSchema.safeParse(req.params.token);
  if (!parsed.success) {
    throw new ValidationError('Invalid token');
  }

  const deps = getDeliveryConfirmationDeps();
  const view = await getConfirmationView(parsed.data, deps);
  res.json(view);
});

/** Respuesta del gerente: confirma entrega o reprograma reintento (+1 día). */
deliveryConfirmationRouter.post('/confirm', async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid confirmation payload');
  }

  const deps = getDeliveryConfirmationDeps();
  const result = await confirmDelivery(parsed.data, deps);
  res.json(result);
});

/**
 * Procesa correos vencidos. En Vercel lo invoca el cron cada 5 min;
 * en local el scheduler hace lo mismo cada 5 s.
 */
deliveryConfirmationRouter.get('/cron/process-due', verifyCronSecret, async (_req, res) => {
  const deps = getDeliveryConfirmationDeps();
  const processed = await processDueEmails(deps);
  res.json({ processed });
});

/** Estado del caso por caseId del pipeline (UI/ops). */
deliveryConfirmationRouter.get('/cases/:caseId', async (req, res) => {
  const parsed = caseIdParamSchema.safeParse(req.params.caseId);
  if (!parsed.success) {
    throw new ValidationError('caseId must be a valid UUID');
  }

  const deps = getDeliveryConfirmationDeps();
  const status = await getCaseStatus(parsed.data, deps.repository);
  res.json(status);
});
