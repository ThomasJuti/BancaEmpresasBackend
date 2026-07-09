-- Feature: delivery-confirmation
-- Confirmación de entrega física de tarjetas de crédito al gerente de la empresa.

-- Casos del pipeline (mínima, para poder avanzar el stage desde delivery-confirmation)
create table if not exists pipeline_cases (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  stage text not null default 'file_matching'
    check (stage in (
      'file_matching',
      'sales_call',
      'power_apps',
      'delivery_confirmation',
      'activation_follow_up',
      'completed',
      'rejected',
      'failed'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Gerentes por empresa (fuente de los emails de notificación)
create table if not exists company_managers (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

create index if not exists idx_company_managers_company on company_managers (company_id);

-- Caso de confirmación de entrega (uno por tarjeta)
create table if not exists delivery_confirmation_cases (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references pipeline_cases (id),
  card_id text not null unique,
  company_id text not null,
  card_holder_name text not null,
  card_last_four text not null check (char_length(card_last_four) = 4),
  status text not null default 'scheduled'
    check (status in (
      'scheduled',
      'sent',
      'awaiting_confirmation',
      'confirmed',
      'retry_scheduled',
      'failed'
    )),
  outcome text
    check (outcome is null or outcome in (
      'delivered_to_holder',
      'not_arrived',
      'holder_absent',
      'return_to_bank'
    )),
  physical_shipped_at timestamptz not null,
  email_scheduled_at timestamptz not null,
  sent_at timestamptz,
  confirmed_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_delivery_cases_due
  on delivery_confirmation_cases (email_scheduled_at)
  where status in ('scheduled', 'retry_scheduled');

-- Auditoría de correos enviados (un registro por gerente y por intento)
create table if not exists delivery_confirmation_emails (
  id uuid primary key default gen_random_uuid(),
  delivery_case_id uuid not null references delivery_confirmation_cases (id),
  manager_email text not null,
  provider_message_id text,
  token_hash text not null,
  status text not null default 'sent'
    check (status in ('sent', 'used', 'failed')),
  sent_at timestamptz not null default now()
);

create index if not exists idx_delivery_emails_case on delivery_confirmation_emails (delivery_case_id);
create index if not exists idx_delivery_emails_token on delivery_confirmation_emails (token_hash);

-- RLS: solo backend (service role)
alter table pipeline_cases enable row level security;
alter table company_managers enable row level security;
alter table delivery_confirmation_cases enable row level security;
alter table delivery_confirmation_emails enable row level security;
