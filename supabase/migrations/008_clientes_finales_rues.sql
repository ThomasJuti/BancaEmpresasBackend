-- 008 — Enriquecimiento RUES (Croma) en las tablas resultado del cruce.
-- Agrega columnas de representante legal y datos de empresa que llena el paso
-- intermedio POST /api/file-matching/enrich-rues (consulta RUES por NIT).
-- Las tablas se regeneran en cada POST /run, así que solo hace falta que las
-- columnas existan; el enriquecimiento se corre después del run.
-- Aplicar con `supabase db push` o pegando en el SQL Editor (Opción B).

alter table clientes_finales
  add column if not exists representante_legal_nombre text,
  add column if not exists representante_legal_documento text,
  add column if not exists representante_legal_cargo text,
  add column if not exists direccion_comercial text,
  add column if not exists municipio_comercial text,
  add column if not exists tipo_sociedad text,
  add column if not exists actividad_economica text,
  add column if not exists rues_found boolean,
  add column if not exists rues_enriched_at timestamptz;

alter table clientes_finales_sin_pagare
  add column if not exists representante_legal_nombre text,
  add column if not exists representante_legal_documento text,
  add column if not exists representante_legal_cargo text,
  add column if not exists direccion_comercial text,
  add column if not exists municipio_comercial text,
  add column if not exists tipo_sociedad text,
  add column if not exists actividad_economica text,
  add column if not exists rues_found boolean,
  add column if not exists rues_enriched_at timestamptz;

-- Flujo: 1) POST /api/file-matching/run  2) POST /api/file-matching/enrich-rues
