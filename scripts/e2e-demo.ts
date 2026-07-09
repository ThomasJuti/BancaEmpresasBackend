/**
 * Demo E2E del feature delivery-confirmation con fakes en memoria
 * (sin Supabase ni Resend). Ejecutar: npm run demo:delivery
 *
 * Flujo probado:
 * 1. registerShipment agenda el correo a t0 + 3–4 días comprimidos.
 * 2. processDueEmails envía correo por gerente con token firmado.
 * 3. confirmDelivery con outcome de reintento reprograma a +1 día.
 * 4. Segundo correo, confirmación delivered_to_holder → pipeline avanza.
 */
import { randomUUID } from 'node:crypto';
import { registerShipment } from '../src/features/delivery-confirmation/application/register-shipment.js';
import { processDueEmails } from '../src/features/delivery-confirmation/application/process-due-emails.js';
import { confirmDelivery } from '../src/features/delivery-confirmation/application/confirm-delivery.js';
import { getCaseStatus } from '../src/features/delivery-confirmation/application/get-case-status.js';
import { HmacConfirmationTokenService } from '../src/features/delivery-confirmation/infrastructure/token-service.js';
import type {
  DeliveryConfirmationRepository,
  ManagerDirectory,
} from '../src/features/delivery-confirmation/domain/repository.js';
import type {
  DeliveryEmailPayload,
  DeliveryEmailSender,
} from '../src/features/delivery-confirmation/domain/email-sender.js';
import type {
  DeliveryConfirmationCase,
  DeliveryConfirmationOutcome,
  DeliveryEmailAttempt,
  NewDeliveryConfirmationCase,
} from '../src/features/delivery-confirmation/domain/types.js';
import type {
  PipelineStage,
  PipelineStageAdvancer,
} from '../src/shared/contracts/pipeline.js';

const DAY_MS = 300; // 1 día emulado = 300ms para la demo

class InMemoryRepository implements DeliveryConfirmationRepository {
  cases = new Map<string, DeliveryConfirmationCase>();
  attempts = new Map<string, DeliveryEmailAttempt & { status: string }>();

  async create(data: NewDeliveryConfirmationCase): Promise<DeliveryConfirmationCase> {
    const created: DeliveryConfirmationCase = {
      id: randomUUID(),
      ...data,
      status: 'scheduled',
      attemptCount: 0,
    };
    this.cases.set(created.id, created);
    return created;
  }

  async findById(id: string) {
    return this.cases.get(id) ?? null;
  }

  async findByCaseId(caseId: string) {
    return [...this.cases.values()].find((c) => c.caseId === caseId) ?? null;
  }

  async findDue(now: Date) {
    return [...this.cases.values()].filter(
      (c) =>
        (c.status === 'scheduled' || c.status === 'retry_scheduled') &&
        new Date(c.emailScheduledAt) <= now,
    );
  }

  async markSent(id: string, sentAt: Date) {
    const c = this.cases.get(id)!;
    c.status = 'awaiting_confirmation';
    c.sentAt = sentAt.toISOString();
    c.attemptCount += 1;
  }

  async confirm(id: string, outcome: DeliveryConfirmationOutcome, confirmedAt: Date) {
    const c = this.cases.get(id)!;
    c.status = 'confirmed';
    c.outcome = outcome;
    c.confirmedAt = confirmedAt.toISOString();
  }

  async scheduleRetry(id: string, outcome: DeliveryConfirmationOutcome, nextEmailAt: Date) {
    const c = this.cases.get(id)!;
    c.status = 'retry_scheduled';
    c.outcome = outcome;
    c.emailScheduledAt = nextEmailAt.toISOString();
  }

  async recordEmailAttempt(attempt: DeliveryEmailAttempt) {
    this.attempts.set(attempt.tokenHash, { ...attempt, status: 'sent' });
  }

  async findEmailAttemptByTokenHash(tokenHash: string) {
    const a = this.attempts.get(tokenHash);
    return a
      ? { deliveryCaseId: a.deliveryCaseId, managerEmail: a.managerEmail, status: a.status }
      : null;
  }

  async markTokenUsed(tokenHash: string) {
    const a = this.attempts.get(tokenHash);
    if (a) a.status = 'used';
  }
}

class FakeManagers implements ManagerDirectory {
  async findByCompanyId() {
    return [
      { name: 'Gerente Demo Uno', email: 'gerente1@example.com' },
      { name: 'Gerente Demo Dos', email: 'gerente2@example.com' },
    ];
  }
}

class FakeEmailSender implements DeliveryEmailSender {
  sent: DeliveryEmailPayload[] = [];
  async send(payload: DeliveryEmailPayload) {
    this.sent.push(payload);
    return `fake-msg-${this.sent.length}`;
  }
}

class FakePipeline implements PipelineStageAdvancer {
  advanced: Array<{ caseId: string; toStage: PipelineStage }> = [];
  async advance(caseId: string, toStage: PipelineStage) {
    this.advanced.push({ caseId, toStage });
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`OK: ${message}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const repository = new InMemoryRepository();
  const managers = new FakeManagers();
  const emailSender = new FakeEmailSender();
  const pipeline = new FakePipeline();
  const tokens = new HmacConfirmationTokenService('demo-secret');

  const deps = {
    repository,
    managers,
    emailSender,
    tokens,
    pipeline,
    dayMs: DAY_MS,
    frontendConfirmationUrl: 'http://localhost:4200/delivery-confirmation',
  };

  // 1. Registrar envío físico
  const pipelineCaseId = randomUUID();
  const created = await registerShipment(
    {
      caseId: pipelineCaseId,
      cardId: 'card-001',
      companyId: 'empresa-demo-001',
      cardHolderName: 'Titular Demo',
      cardLastFour: '4321',
    },
    deps,
  );
  const delay = new Date(created.emailScheduledAt).getTime() - Date.now();
  assert(delay >= 2.5 * DAY_MS && delay <= 4.5 * DAY_MS, `correo agendado a 3–4 días (${delay}ms)`);

  // 2. Antes de tiempo no procesa nada
  assert((await processDueEmails(deps)) === 0, 'no envía antes de la fecha agendada');

  // 3. Pasan los 3–4 días comprimidos → envía a ambos gerentes
  await sleep(delay + 50);
  assert((await processDueEmails(deps)) === 1, 'procesa el caso vencido');
  assert(emailSender.sent.length === 2, 'envía un correo por gerente');
  assert(!emailSender.sent[0].isRetry, 'primer correo no es reintento');

  // 4. Gerente responde "titular ausente" → reintento a +1 día
  const firstToken = new URL(emailSender.sent[0].confirmationUrl).searchParams.get('token')!;
  const retryResult = await confirmDelivery({ token: firstToken, outcome: 'holder_absent' }, deps);
  assert(retryResult.status === 'retry_scheduled', 'outcome no entregado reprograma reintento');

  // 5. Token de un solo uso
  const reuse = await confirmDelivery({ token: firstToken, outcome: 'delivered_to_holder' }, deps)
    .then(() => 'accepted')
    .catch((e) => e.code as string);
  assert(reuse === 'TOKEN_ALREADY_USED', 'token no puede reutilizarse');

  // 6. Pasa 1 día comprimido → reenvía correo (marcado como reintento)
  await sleep(DAY_MS + 100);
  assert((await processDueEmails(deps)) === 1, 'reenvía tras 1 día comprimido');
  assert(emailSender.sent.length === 4, 'segundo intento a ambos gerentes');
  assert(emailSender.sent[2].isRetry, 'segundo correo marcado como reintento');

  // 7. Ahora sí entrega → confirmado + pipeline avanza
  const secondToken = new URL(emailSender.sent[2].confirmationUrl).searchParams.get('token')!;
  const confirmed = await confirmDelivery(
    { token: secondToken, outcome: 'delivered_to_holder' },
    deps,
  );
  assert(confirmed.status === 'confirmed', 'entrega confirmada');
  assert(
    pipeline.advanced.some(
      (a) => a.caseId === pipelineCaseId && a.toStage === 'activation_follow_up',
    ),
    'pipeline avanza a activation_follow_up',
  );

  // 8. Estado final consultable
  const status = await getCaseStatus(pipelineCaseId, repository);
  assert(status.status === 'confirmed' && status.attemptCount === 2, 'estado final correcto');

  console.log('\nDemo E2E delivery-confirmation: todos los pasos OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
