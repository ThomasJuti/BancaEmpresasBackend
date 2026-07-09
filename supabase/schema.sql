-- Esquema completo de Banca Empresas Backend.
-- Opción A (recomendada): supabase db push  (aplica supabase/migrations/*)
-- Opción B: pegar este archivo en el SQL Editor de Supabase (una sola vez).

-- ── file-matching ────────────────────────────────────────────────────────────

create table if not exists base_potencial (
  id bigint generated always as identity primary key,
  cliente_id text not null,
  cliente_nombre text,
  relacion text,
  tipo_cliente text,
  cliente_gestionable text,
  ciudad text,
  direccion text,
  subsegmento text,
  producto_tc text
);

create index if not exists idx_base_potencial_cliente_id
  on base_potencial (cliente_id);
create index if not exists idx_base_potencial_gestionable_tc
  on base_potencial (cliente_gestionable, producto_tc);

create table if not exists cec (
  id bigint generated always as identity primary key,
  proy_cred text,
  tipo_iden text,
  nume_iden text not null,
  nombre_completo text,
  fecha_revision date,
  lea_aprobado numeric,
  disponible numeric
);

create index if not exists idx_cec_nume_iden on cec (nume_iden);

create table if not exists clientes_potenciales_grabar (
  id bigint generated always as identity primary key,
  segmento text,
  direccion text,
  zona text,
  domicilio text,
  fecha_vigencia_pc date,
  tipo_id text,
  identificacion text not null,
  nombre_completo text,
  lea_total_cliente numeric,
  pct5_lea_total numeric,
  aprobado_familia_kw numeric,
  disponible_familia_kw numeric,
  pct_utilizado_familia_kw numeric,
  max_disponible_tx numeric,
  max_aprobado_limites_kw numeric,
  valor_sugerido numeric,
  vobo_para_grabar text,
  observacion text,
  nuevo_valor_sugerido numeric,
  garantia text,
  estado text,
  tipo text,
  subtipo text
);

create index if not exists idx_grabar_identificacion_estado
  on clientes_potenciales_grabar (identificacion, estado);

create table if not exists clientes_finales (
  id bigint generated always as identity primary key,
  cliente_id text not null unique,
  nombre text,
  ciudad text,
  subsegmento text,
  cupo_disponible numeric,
  lea_aprobado numeric,
  creado_en timestamptz not null default now()
);

create table if not exists clientes_finales_sin_pagare (
  id bigint generated always as identity primary key,
  cliente_id text not null unique,
  nombre text,
  ciudad text,
  subsegmento text,
  cupo_disponible numeric,
  lea_aprobado numeric,
  creado_en timestamptz not null default now()
);

alter table base_potencial enable row level security;
alter table cec enable row level security;
alter table clientes_potenciales_grabar enable row level security;
alter table clientes_finales enable row level security;
alter table clientes_finales_sin_pagare enable row level security;

-- ── delivery-confirmation + pipeline ─────────────────────────────────────────

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

create table if not exists company_managers (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

create index if not exists idx_company_managers_company on company_managers (company_id);

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

alter table pipeline_cases enable row level security;
alter table company_managers enable row level security;
alter table delivery_confirmation_cases enable row level security;
alter table delivery_confirmation_emails enable row level security;
