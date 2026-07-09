# Banca Empresas Backend

Pipeline de venta de tarjetas de crédito con human-in-the-loop.

## Stack

- TypeScript + Express
- Supabase (Postgres)
- Fonema.ia (llamadas agenticas de venta y seguimiento)
- Resend (correos de confirmación de entrega)

## Flujo

```
file-matching (base potencial × CEC)
  → sales-calls (Fonema.ia)
  → power-apps (HITL)
  → delivery-confirmation (Resend → gerente confirma entrega física)
  → activation-follow-up (Fonema.ia — beneficio / inducción a activación)
```

### delivery-confirmation

1. Se emula ~3–4 días desde el envío físico de la tarjeta.
2. Se envía un correo **por tarjeta** a el/los gerentes (emails en Supabase).
3. El gerente abre una página del frontend y elige:
   - entregó al titular → avanza pipeline a `activation-follow-up`
   - no llegó / titular ausente / devolver al banco → reintento de correo a +1 día

## Setup

```bash
cp .env.example .env   # completar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Health: `GET /health`

## Paso 1 — file-matching (cruce de fuentes → clientes finales)

### 1. Crear las tablas

Ejecutar [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor de Supabase (una sola vez).
Crea las 3 tablas fuente (`base_potencial`, `cec`, `clientes_potenciales_grabar`) y las 2 tablas
resultado (`clientes_finales`, `clientes_finales_sin_pagare`), con RLS habilitado sin políticas
(solo el backend accede, vía service role).

### 2. Precargar las fuentes desde Excel

En producción las fuentes llegan de un sistema externo; para pruebas se precargan desde los
Excel de `docs/` (no versionados — contienen datos reales de clientes):

```bash
npm run seed              # parsea y sube las 3 fuentes a Supabase
npm run seed -- --dry-run # solo parsea y muestra conteos, sin tocar la base
```

### 3. Ejecutar el cruce

```bash
curl -X POST localhost:3000/api/file-matching/run
```

Genera dos listas y las persiste (regenerándolas por completo en cada corrida):

| Lista | Tabla | Condiciones |
|---|---|---|
| Validación completa | `clientes_finales` | gestionable + sin TC (base potencial) + cupo disponible (CEC) + pagaré activo |
| Validación sin pagaré | `clientes_finales_sin_pagare` | gestionable + sin TC (base potencial) + cupo disponible (CEC) |

La respuesta trae solo conteos (sin datos de clientes). Para consultar las listas:

```bash
curl localhost:3000/api/file-matching/clientes-finales
curl localhost:3000/api/file-matching/clientes-finales-sin-pagare
```
