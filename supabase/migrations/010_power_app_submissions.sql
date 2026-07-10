-- Persistencia de solicitudes Power App aprobadas (histórico para consulta por lead).

create table if not exists power_app_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references pipeline_cases (id),
  lead_id text not null,
  radicado text,
  decision text not null check (decision in ('APROBADO', 'RECHAZADO', 'DEVUELTO')),
  valid boolean not null default false,
  summary text,
  siguiente_paso text,
  payload jsonb not null,
  issues jsonb not null default '[]'::jsonb,
  attachment_names text[] not null default '{}',
  documento_origen text check (documento_origen in ('RUES', 'MANUAL')),
  rues_solicitud_id text,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_power_app_submissions_lead
  on power_app_submissions (lead_id, submitted_at desc);

create index if not exists idx_power_app_submissions_case
  on power_app_submissions (case_id, submitted_at desc);

alter table power_app_submissions enable row level security;
