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
} as const;
