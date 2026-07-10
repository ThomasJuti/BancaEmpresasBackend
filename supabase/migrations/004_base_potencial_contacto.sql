-- 004 — Datos de contacto de prueba en base_potencial.
-- Agrega correo/telefono y los reparte por partes iguales (aleatorio) sobre las
-- filas ya cargadas. Correo y teléfono van EMPAREJADOS por contacto (mismo índice).
-- Aplicar con `supabase db push` o pegando en el SQL Editor (Opción B).
--
-- Contactos (demo): cada uno queda en ~1/4 de las filas.
--   mesacalderon@gmail.com          <-> 3224118118
--   thomasjuti1210@gmail.com        <-> 3142016630
--   juannicolastorrente@gmail.com   <-> 3157294645
--   bryanalexanderbogota@gmail.com  <-> 3104083853

alter table base_potencial
  add column if not exists correo text,
  add column if not exists telefono text;

-- Reparto equitativo y aleatorio: row_number() sobre orden aleatorio, módulo 4.
-- Solo toca filas sin contacto, por lo que re-ejecutar es un no-op (idempotente).
with contacto as (
  select
    id,
    (row_number() over (order by random()) - 1) % 4 as bucket
  from base_potencial
  where correo is null or telefono is null
)
update base_potencial b
set
  correo = (array[
    'mesacalderon@gmail.com',
    'thomasjuti1210@gmail.com',
    'juannicolastorrente@gmail.com',
    'bryanalexanderbogota@gmail.com'
  ])[c.bucket + 1],
  telefono = (array[
    '3224118118',
    '3142016630',
    '3157294645',
    '3104083853'
  ])[c.bucket + 1]
from contacto c
where b.id = c.id;

-- Verificación del reparto (debe dar 4 pares, conteos casi iguales):
--   select correo, telefono, count(*)
--   from base_potencial
--   group by correo, telefono
--   order by count(*) desc;
