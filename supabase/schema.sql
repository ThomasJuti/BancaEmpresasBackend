-- Esquema del paso 1 del pipeline (file-matching).
-- Ejecutar una vez en el SQL Editor de Supabase.
--
-- Tablas fuente (en producción se poblarán desde una fuente externa;
-- por ahora se precargan con `npm run seed` desde los Excel en docs/):
--   base_potencial              <- "Copia de Base Potencial _ VP Banca Empresas.xlsx" (hoja DATA)
--   cec                         <- "CEC.xlsx" (hoja "activos cec")
--   clientes_potenciales_grabar <- "Clientes potenciales para grabar SG.xlsx" (hoja Base)
--
-- Tablas resultado (regeneradas en cada corrida de POST /api/file-matching/run):
--   clientes_finales            <- validación completa (4 condiciones)
--   clientes_finales_sin_pagare <- validación sin la condición de pagaré activo

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

-- RLS habilitado sin políticas: solo el backend (service role) accede a estos datos;
-- la anon key no puede leer información de clientes.
alter table base_potencial enable row level security;
alter table cec enable row level security;
alter table clientes_potenciales_grabar enable row level security;
alter table clientes_finales enable row level security;
alter table clientes_finales_sin_pagare enable row level security;
