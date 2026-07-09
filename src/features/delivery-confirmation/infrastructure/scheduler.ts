import { processDueEmails } from '../application/process-due-emails.js';
import { getDeliveryConfirmationDeps } from './composition.js';

const TICK_INTERVAL_MS = 5_000;

let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Arranca el loop que revisa casos con correo vencido y los envía.
 * Si el feature no está configurado (Supabase/Resend/secret), lo reporta
 * una vez y no programa el loop.
 */
export function startDeliveryConfirmationScheduler(): void {
  if (timer) return;

  let deps;
  try {
    deps = getDeliveryConfirmationDeps();
  } catch (error) {
    console.warn(
      `delivery-confirmation scheduler disabled: ${error instanceof Error ? error.message : error}`,
    );
    return;
  }

  timer = setInterval(async () => {
    if (running) return; // evita ticks solapados si un lote tarda más que el intervalo
    running = true;
    try {
      const processed = await processDueEmails(deps);
      if (processed > 0) {
        console.log(`delivery-confirmation: processed ${processed} due case(s)`);
      }
    } catch (error) {
      console.error('delivery-confirmation scheduler tick failed', error);
    } finally {
      running = false;
    }
  }, TICK_INTERVAL_MS);

  console.log(
    `delivery-confirmation scheduler started (tick=${TICK_INTERVAL_MS}ms, 1 día emulado=${deps.dayMs}ms)`,
  );
}

export function stopDeliveryConfirmationScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
