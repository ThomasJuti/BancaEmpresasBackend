-- 007 — Arrastre de contacto (correo/telefono) a las tablas resultado del cruce.
-- clientes_finales y clientes_finales_sin_pagare se regeneran por completo en cada
-- POST /api/file-matching/run (delete + insert), así que solo hace falta que las
-- columnas existan: el próximo run las llena con el correo/telefono del cliente
-- (heredado de base_potencial, migración 006).
-- Aplicar con `supabase db push` o pegando en el SQL Editor (Opción B).

alter table clientes_finales
  add column if not exists correo text,
  add column if not exists telefono text;

alter table clientes_finales_sin_pagare
  add column if not exists correo text,
  add column if not exists telefono text;

-- Tras aplicar: re-ejecutar el cruce para poblar el contacto en las filas existentes.
--   curl -X POST localhost:3000/api/file-matching/run
