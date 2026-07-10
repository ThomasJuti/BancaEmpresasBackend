import type { DeliveryConfirmationRepository, ManagerDirectory } from '../domain/repository.js';
import type { DeliveryEmailSender } from '../domain/email-sender.js';
import type { ConfirmationTokenService } from '../domain/token-service.js';

export interface ProcessDueEmailsDeps {
  repository: DeliveryConfirmationRepository;
  managers: ManagerDirectory;
  emailSender: DeliveryEmailSender;
  tokens: ConfirmationTokenService;
  /** Base de la URL del frontend donde el gerente confirma. */
  frontendConfirmationUrl: string;
}

/**
 * Busca casos cuyo correo ya venció, envía un correo por gerente con link
 * firmado y marca el caso como awaiting_confirmation.
 * Devuelve cuántos casos procesó.
 */
export async function processDueEmails(deps: ProcessDueEmailsDeps): Promise<number> {
  const dueCases = await deps.repository.findDue(new Date());

  for (const dueCase of dueCases) {
    const isRetry = dueCase.attemptCount > 0;
    const managers = await deps.managers.findByCompanyId(dueCase.companyId);

    if (managers.length === 0) {
      console.warn(
        `delivery-confirmation: no managers found for company ${dueCase.companyId} (case ${dueCase.id}), skipping`,
      );
      continue;
    }

    let sentCount = 0;

    for (const manager of managers) {
      const token = deps.tokens.generate(dueCase.id, manager.email);
      const confirmationUrl = `${deps.frontendConfirmationUrl}?token=${encodeURIComponent(token)}`;

      try {
        const providerMessageId = await deps.emailSender.send({
          to: manager.email,
          managerName: manager.name,
          cardHolderName: dueCase.cardHolderName,
          cardLastFour: dueCase.cardLastFour,
          confirmationUrl,
          isRetry,
        });

        await deps.repository.recordEmailAttempt({
          deliveryCaseId: dueCase.id,
          managerEmail: manager.email,
          providerMessageId,
          tokenHash: deps.tokens.hash(token),
        });
        sentCount += 1;
        console.log(
          `delivery-confirmation: email sent to ${manager.email} for case ${dueCase.id} (company ${dueCase.companyId})`,
        );
      } catch (error) {
        // No abortamos el lote: otros gerentes/casos deben seguir procesándose.
        console.error(
          `delivery-confirmation: failed to send email to ${manager.email} for case ${dueCase.id}`,
          error,
        );
      }
    }

    if (sentCount > 0) {
      await deps.repository.markSent(dueCase.id, new Date());
    } else {
      console.error(
        `delivery-confirmation: all email sends failed for case ${dueCase.id} (company ${dueCase.companyId}); case remains scheduled for retry`,
      );
    }
  }

  return dueCases.length;
}
