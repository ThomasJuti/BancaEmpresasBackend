# Banca Empresas — Backend

> Pipeline inteligente de venta de **Tarjeta de Crédito LATAM Business** (Visa) para Banca Empresas — Banco de Bogotá.

**Demo en vivo:** [https://bebackend.vercel.app/health](https://bebackend.vercel.app/health)  
**API base:** `https://bebackend.vercel.app/api`  
**Contrato OpenAPI:** [openapi.yaml](./public/docs/openapi.yaml)

---

## ¿Qué resuelve?

Automatiza el ciclo completo de una campaña de tarjetas corporativas — desde identificar empresas elegibles hasta el seguimiento post-activación — combinando **reglas de negocio bancarias**, **IA de voz conversacional** y **supervisión humana (HITL)** en un solo flujo trazable.

No es un CRUD de solicitudes: es un **orquestador de etapas** donde cada caso avanza por el pipeline según resultados reales (cruce de bases, calificación telefónica, validación documental, entrega confirmada, uso de tarjeta).

---

## Flujo end-to-end

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  File Matching  │ →  │   Sales Calls   │ →  │   Power Apps    │
│  Viabilidad     │    │  IA de voz      │    │  Radicación     │
│  Base×CEC×SG    │    │  (Fonema.ia)    │    │  + RUES         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        ↓
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Seguimiento    │ ←  │   Entrega       │ ←  │  Operaciones    │
│  post-activación│    │  confirmada     │    │  (fuera scope)  │
│  (Fonema.ia)    │    │  email + token  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

| # | Etapa | Qué hace | Diferenciador |
|---|-------|----------|---------------|
| 1 | **File Matching** | Cruza 3 bases comerciales (Potencial, CEC, SG) para encontrar empresas sin TC y con cupo | Reglas de elegibilidad bancarias reales (NIT ↔ cédula representante) |
| 2 | **Sales Calls** | Agente de voz llama al representante, verifica identidad y mide interés | Transcripción, análisis estructurado y **handoff automático** al formulario |
| 3 | **Power Apps** | Recibe la solicitud completa con validaciones y consulta RUES | Decisión `approved / rejected / needs_review` con issues por campo |
| 4 | **Delivery Confirmation** | Programa entrega de plásticos y pide confirmación al cliente | Link público con token; avanza el pipeline al confirmar |
| 5 | **Activation Follow-Up** | Agente de voz hace seguimiento ~3 meses post-activación | Segunda cuenta Fonema dedicada al follow-up |

**Etapas del pipeline** (`PipelineStage`):

`file_matching` → `sales_call` → `power_apps` → `delivery_confirmation` → `activation_follow_up` → `completed`

Estados terminales: `rejected`, `failed`.

---

## Innovación con IA

### Agente de venta (Fonema.ia)

- Llama al representante legal, confirma **nombre, empresa y NIT**, y ofrece la TC LATAM Business.
- Al cerrar la llamada, el backend recibe webhook con **transcripción, grabación, variables estructuradas** (`identidad_verificada`, `cliente_interesado`).
- Si califica → **`GET /calls/:id/handoff`** genera un prefill del formulario Power App con lo recolectado en la llamada.
- El asesor solo adjunta el PDF de Cámara de Comercio y radica.

### Campañas batch (llamadas masivas)

- Subir lista de leads + política de pacing → cola en Supabase → dispatcher progresivo.
- Control de **concurrencia, ritmo por hora y ventana horaria** (cumplimiento habeas data).
- Pausar, reanudar o cancelar campañas en caliente.

### Agente de seguimiento

- Tras confirmar entrega, un segundo agente Fonema contacta al cliente meses después para verificar activación y uso.

---

## Cómo evaluarlo rápido

```bash
curl https://bebackend.vercel.app/health
curl https://bebackend.vercel.app/api/pipeline/health
curl https://bebackend.vercel.app/api/sales-calls/calls
curl -X POST https://bebackend.vercel.app/api/file-matching/run
```

**Modo demo:** con compresión temporal activa, los plazos de entrega y seguimiento se reducen a minutos para demostración en vivo.

---

## Detalles técnicos

### Arquitectura

**Clean Architecture por feature.** Cada módulo en `src/features/<nombre>/`:

```
domain/          → Entidades, reglas de negocio, interfaces de repositorio
application/     → Casos de uso (orquestación)
infrastructure/  → Supabase, clientes HTTP (Fonema, Croma, Resend)
presentation/    → Controllers, routes Express, DTOs Zod
```

**Desacoplamiento entre features** vía contratos en `src/shared/contracts/`:

| Contrato | Propósito |
|----------|-----------|
| `PipelineStageAdvancer` | Avanzar casos sin acoplar sales-calls ↔ pipeline |
| `PowerAppPrefill` | Handoff llamada → formulario sin importar internals de power-apps |

**Entry points:**

| Entorno | Archivo |
|---------|---------|
| Vercel (prod) | `api/index.ts` → `createApp()` |
| Local | `src/dev-server.ts` → puerto 3000, sirve `/docs` estáticos |

### Stack

| Componente | Tecnología |
|------------|------------|
| Runtime | Node.js ≥ 20, TypeScript ESM |
| HTTP | Express 5 + Helmet + CORS |
| Validación | Zod (DTOs tipados) |
| Base de datos | Supabase (PostgreSQL) |
| IA de voz | Fonema.ia (`POST /v2/initiate-call`) |
| Email | Resend (prod) / Gmail SMTP (dev) |
| RUES | API Croma + microservicio Cámara de Comercio |
| Tests | Vitest + `@vitest/coverage-v8` |
| Deploy | Vercel Serverless (`maxDuration: 60s`) |

### Modelo de datos (Supabase)

| Tabla / grupo | Contenido |
|---------------|-----------|
| `base_potencial`, `cec`, `clientes_potenciales_grabar`, `pagares` | Bases comerciales de entrada |
| `clientes_finales`, `clientes_finales_sin_pagare` | Resultado del file-matching |
| `pipeline_cases` | Casos con `stage`, `lead_id`, metadata |
| `calls` | Llamadas Fonema: transcript, `output_variables`, grabación, `case_id` |
| `call_batches`, `call_batch_items` | Cola de campañas con pacing e idempotencia |
| `power_app_submissions` | Solicitudes radicadas con decisión e issues |
| `delivery_shipments`, `delivery_confirmations` | Envíos y tokens de confirmación |
| `activation_follow_up_cases` | Seguimiento post-activación |

Migraciones en `supabase/migrations/`. RLS restringido a service role en tablas sensibles.

### Integración Fonema — flujo técnico

```
POST /calls  →  Fonema initiate-call  →  session.id
                                              ↓
                         webhooks asíncronos (otra invocación serverless)
                                              ↓
              call-update │ end-of-call │ end-of-session
                                              ↓
              persistencia en `calls` + sync batch item + auto-avance pipeline
```

**Datos persistidos por llamada:**

| Columna | Origen |
|---------|--------|
| `transcript` | `messages` de `end-of-call` |
| `output_variables` | `variableValues` (merge acumulativo) |
| `structured_data`, `summary` | `analysis` del agente |
| `recording_url` | Proxy interno `GET /calls/:id/recording` (no expone API key) |

**Calificación:** `identidad_verificada && cliente_interesado` → llamada calificada → handoff disponible.

**Auto-avance:** si la llamada califica y tiene `case_id`, el webhook mueve el caso a `power_apps` automáticamente (best-effort; no radica — falta el PDF).

### Batch calling — mecánica

1. `POST /batches` crea campaña con lista de leads + `PacingPolicy`
2. Items en cola (`queued`) en `call_batch_items` con `unique(batch_id, lead_id)` para idempotencia
3. Cron `GET /cron/dispatch` calcula headroom: `min(maxConcurrent − activos, perHour − última_hora, en_cola)`
4. Claim atómico `queued → dialing` → dispara `InitiateCallUseCase` por item
5. Webhooks marcan item `completed|failed` y setean `qualified`
6. `POST /batches/:id/pause|resume|cancel` controla ciclo de vida

**Pacing por defecto** (configurable en `.env`): 20 concurrentes, 60/hora, ventana 8:00–20:00 `America/Bogota`.

### Handoff — contrato técnico

`GET /api/sales-calls/calls/:id/handoff` → `PowerAppPrefill`

Prioridad de mapeo: variables de **entrada** (file-matching) < `structuredData` (análisis) < **outputVariables** (lo que el agente confirmó en la llamada).

Pre-pobla todos los campos de `SubmitPowerAppDto` excepto `archivosAdjuntos[]` (PDF Cámara de Comercio).

### Power App — validación

`POST /api/power-apps/submit` recibe JSON plano con todas las pestañas del formulario.

**Respuesta:**

```json
{
  "decision": "approved | rejected | needs_review",
  "issues": [{ "code": "...", "field": "...", "message": "...", "severity": "...", "suggestion": "..." }]
}
```

Validaciones: cédulas/NIT colombianos, cupos, BIN, puntos de entrega, adjuntos PDF.

### Delivery confirmation

1. `POST /shipments` crea envío y programa email con token firmado
2. Cliente abre `{FRONTEND_CONFIRMATION_URL}?token=…` (frontend público)
3. `GET /confirmations/:token` → datos del envío
4. `POST /confirm` → confirma recepción → avanza pipeline a follow-up

Compresión temporal: `TIME_COMPRESSION_DAY_MS` emula días en segundos para demos.

---

## API — referencia de endpoints

### Pipeline — `/api/pipeline`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado y flujo |
| `GET` | `/cases/by-lead/:leadId` | Caso por lead |

### File Matching — `/api/file-matching`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado |
| `POST` | `/run` | Ejecuta cruce Base × CEC × SG |
| `POST` | `/enrich-rues` | Enriquece con datos Cámara de Comercio |
| `GET` | `/clientes-finales` | Lista clientes finales |
| `GET` | `/clientes-finales/:clienteId` | Detalle |
| `GET` | `/clientes-finales-sin-pagare` | Sin pagaré |

### Sales Calls — `/api/sales-calls`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado |
| `POST` | `/calls` | Disparar llamada |
| `POST` | `/calls/manual` | Registrar llamada manual |
| `GET` | `/calls`, `/calls/:id` | Listar / detalle |
| `GET` | `/calls/:id/recording` | Proxy grabación (Range) |
| `GET` | `/calls/:id/handoff` | Prefill Power App |
| `POST` | `/batches` | Crear campaña |
| `GET` | `/batches`, `/batches/:id`, `/batches/:id/items` | Consultar campaña |
| `POST` | `/batches/:id/:action` | `pause` \| `resume` \| `cancel` |
| `POST` | `/webhooks/fonema/*` | Webhooks Fonema |
| `GET\|POST` | `/cron/dispatch` | Dispatcher de campañas |

### Power Apps — `/api/power-apps`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/submit` | Radicar solicitud |
| `GET` | `/submissions/by-lead/:leadId` | Historial por lead |
| `GET` | `/rues/health` | Health RUES |
| `POST` | `/rues/consultar` | Consulta Cámara de Comercio |

### Delivery — `/api/delivery-confirmation`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/shipments` | Crear envío |
| `GET` | `/confirmations/:token` | Datos para confirmación |
| `POST` | `/confirm` | Confirmar recepción |
| `GET` | `/cases/:caseId` | Estado por caso |
| `GET` | `/cron/process-due` | Procesa envíos vencidos |

### Follow-Up — `/api/activation-follow-up`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado |
| `GET` | `/cases` | Listar casos |
| `POST` | `/cases` | Finalizar entrega → inicia seguimiento |
| `POST` | `/cases/:clienteId/usage` | Registrar uso de tarjeta |
| `GET\|POST` | `/cron/process-reminders` | Recordatorios Fonema |

Schemas completos → **[OpenAPI](./public/docs/openapi.yaml)**

---

## Crons (Vercel)

| Schedule | Endpoint | Función |
|----------|----------|---------|
| Diario 00:00 UTC | `/api/delivery-confirmation/cron/process-due` | Envíos programados |
| Diario 12:00 UTC | `/api/sales-calls/cron/dispatch` | Drenaje de campañas batch |
| Diario 13:00 UTC | `/api/activation-follow-up/cron/process-reminders` | Recordatorios follow-up |

Protegidos con `Authorization: Bearer $CRON_SECRET`.

---

## Calidad y pruebas

| Métrica | Valor |
|---------|-------|
| Tests | 156 (Vitest) |
| Archivos | 37 `*.test.ts` |
| Cobertura (domain + application) | >95% líneas |

```bash
npm run test
npm run test:coverage
```

Cubre: validaciones Power App, webhooks Fonema, handoff, batch dispatcher, schedulers de entrega, reglas de calificación.

---

## Variables de entorno

Ver `.env.example`. Resumen:

| Grupo | Variables clave |
|-------|-----------------|
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Fonema ventas | `FONEMA_API_KEY`, `FONEMA_SALES_AGENT_ID` |
| Fonema follow-up | `FONEMA_FOLLOWUP_API_KEY`, `FONEMA_FOLLOWUP_AGENT_ID` |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Delivery | `CONFIRMATION_TOKEN_SECRET`, `FRONTEND_CONFIRMATION_URL`, `TIME_COMPRESSION_DAY_MS` |
| Batch pacing | `CALL_BATCH_MAX_CONCURRENT`, `CALL_BATCH_PER_HOUR`, `CALL_BATCH_TIMEZONE` |
| RUES | `CROMA_API_KEY`, `RUES_SERVICE_URL` |
| Cron | `CRON_SECRET` |

---

## Setup local

```bash
npm install
cp .env.example .env
npm run dev            # → http://localhost:3000
npm run seed           # Carga bases desde Excel (opcional)
npm run demo:delivery  # Demo E2E de entrega (opcional)
```

---

## Seguridad

- Validación Zod en todos los endpoints
- API keys Fonema solo en backend; grabaciones vía proxy autenticado
- Pacing + ventana horaria en campañas (habeas data)
- Crons protegidos con secret
- Service role Supabase nunca expuesto al frontend

---

## Repos relacionados

| Repo | Rol |
|------|-----|
| **BancaEmpresasFrontend** | Portal del asesor |
| **Este repo** | Orquestación del pipeline, IA, validaciones, emails |

---

*Banca Empresas — Hackathon TC LATAM Business · Banco de Bogotá*
