import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './infrastructure/config/env.js';
import { startDeliveryConfirmationScheduler } from './features/delivery-confirmation/infrastructure/scheduler.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`Banca Empresas API listening on port ${env.port} [${env.nodeEnv}]`);
  startDeliveryConfirmationScheduler();
});
