import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  FONEMA_API_URL: z.string().url().optional().or(z.literal('')),
  FONEMA_API_KEY: z.string().optional().default(''),
  FONEMA_SALES_AGENT_ID: z.string().optional().default(''),
  FONEMA_FOLLOWUP_AGENT_ID: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().email().optional().or(z.literal('')).default(''),
  POWERAPPS_WEBHOOK_SECRET: z.string().optional().default(''),
  TIME_COMPRESSION_DAY_MS: z.coerce.number().int().positive().default(60_000),
  CONFIRMATION_TOKEN_SECRET: z.string().optional().default(''),
  FRONTEND_CONFIRMATION_URL: z.string().url().optional().or(z.literal('')).default(''),
  CRON_SECRET: z.string().optional().default(''),
  // Pacing por defecto de las campañas de llamadas (dos perillas + ventana).
  // El techo real de concurrencia es el de la cuenta Fonema (~500); el pacing de
  // negocio nunca debe excederlo.
  CALL_BATCH_MAX_CONCURRENT: z.coerce.number().int().positive().default(20),
  CALL_BATCH_PER_HOUR: z.coerce.number().int().positive().default(60),
  CALL_BATCH_BUSINESS_START_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  CALL_BATCH_BUSINESS_END_HOUR: z.coerce.number().int().min(1).max(24).default(20),
  CALL_BATCH_TIMEZONE: z.string().default('America/Bogota'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

const data = parsed.data;

export const env = {
  nodeEnv: data.NODE_ENV,
  port: data.PORT,
  supabase: {
    url: data.SUPABASE_URL || '',
    serviceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: data.SUPABASE_ANON_KEY,
  },
  fonema: {
    apiUrl: data.FONEMA_API_URL || '',
    apiKey: data.FONEMA_API_KEY,
    salesAgentId: data.FONEMA_SALES_AGENT_ID,
    followUpAgentId: data.FONEMA_FOLLOWUP_AGENT_ID,
  },
  resend: {
    apiKey: data.RESEND_API_KEY,
    fromEmail: data.RESEND_FROM_EMAIL,
  },
  powerApps: {
    webhookSecret: data.POWERAPPS_WEBHOOK_SECRET,
  },
  deliveryConfirmation: {
    /** Milisegundos que representan 1 día emulado (default: 1 min). */
    dayMs: data.TIME_COMPRESSION_DAY_MS,
    tokenSecret: data.CONFIRMATION_TOKEN_SECRET,
    frontendConfirmationUrl: data.FRONTEND_CONFIRMATION_URL || '',
  },
  cron: {
    secret: data.CRON_SECRET,
  },
  callBatch: {
    maxConcurrent: data.CALL_BATCH_MAX_CONCURRENT,
    perHour: data.CALL_BATCH_PER_HOUR,
    businessHours: {
      startHour: data.CALL_BATCH_BUSINESS_START_HOUR,
      endHour: data.CALL_BATCH_BUSINESS_END_HOUR,
    },
    timezone: data.CALL_BATCH_TIMEZONE,
  },
} as const;
