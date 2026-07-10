-- 009 — Seguimiento de uso de TC (activation-follow-up).
-- Un caso por tarjeta entregada: arranca cuando se marca "entrega finalizada"
-- (check del punto 5 del portafolio → llamada de felicitación) y desde ahí se
-- monitorea el uso. La TC se inactiva a los 90 días sin uso; el cron
-- /api/activation-follow-up/cron/process-reminders dispara llamadas de
-- recordatorio: mes 1 (día 30) una llamada, mes 2 (60-89) cada 15 días,
-- mes 3 (>=90) semanal hasta uso o cancelación.
-- Aplicar con `supabase db push` o pegando en el SQL Editor.

create table if not exists follow_up_cases (
  id uuid primary key default gen_random_uuid(),
  -- NIT de la empresa (lead del pipeline); un solo caso de seguimiento por cliente
  cliente_id text not null unique,
  case_id uuid references pipeline_cases (id),
  cliente_nombre text,
  telefono text,
  correo text,
  -- Momento en que se marcó la entrega finalizada (arranca el reloj de uso)
  delivered_at timestamptz not null default now(),
  -- Llamada de felicitación (solo la primera vez que se marca el check)
  congratulated_at timestamptz,
  congratulation_call_id text,
  -- Último uso registrado de la tarjeta (baseline = delivered_at)
  last_used_at timestamptz not null default now(),
  -- Última llamada de recordatorio por inactividad
  last_reminder_at timestamptz,
  reminder_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_follow_up_cases_last_used on follow_up_cases (last_used_at);

alter table follow_up_cases enable row level security;
