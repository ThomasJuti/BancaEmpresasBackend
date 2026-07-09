## Principios de desarrollo

Todo desarrollo en este proyecto debe adherirse estrictamente a los siguientes principios:

### Arquitectura y diseño
- **Feature-based architecture**: organizar el código por dominios de negocio (features), no por tipo técnico. Cada feature agrupa todo lo necesario para una capacidad del producto (controladores, casos de uso, entidades, repositorios y DTOs).
- **Estructura del proyecto**:
  ```
  src/
  ├── shared/                # Utilidades, excepciones, middlewares y tipos transversales
  ├── infrastructure/        # Configuración de BD, clientes HTTP, colas, logging
  └── features/
      ├── accounts/
      │   ├── domain/        # Entidades, value objects, interfaces de repositorio
      │   ├── application/   # Casos de uso, DTOs, mappers
      │   ├── infrastructure/# Implementación de repositorios, adaptadores externos
      │   └── presentation/  # Controladores, validadores de entrada, rutas
      └── transfers/
          └── ...
  ```
- **Reglas de features**:
  - Cada feature expone una API pública mínima (módulo o barrel); el resto del código es interno a la feature.
  - Las features no importan código interno de otras features; la comunicación entre features se hace vía contratos en `shared/`, eventos de dominio o servicios de aplicación orquestados desde `core/`.
  - `shared/` e `infrastructure/` no dependen de `features/`.
  - Dentro de cada feature, respetar la dirección de dependencias: `presentation` → `application` → `domain`; `infrastructure` implementa interfaces definidas en `domain`.
  - Los controladores no contienen lógica de negocio; delegan en casos de uso.
- **Clean Architecture** (por feature): separar dominio, aplicación, infraestructura y presentación dentro de cada feature.
- **Clean Code**: código legible, nombres descriptivos, clases y funciones pequeñas con una sola responsabilidad.
- **SOLID**:
  - **S** — Single Responsibility: cada clase/servicio tiene una única razón para cambiar.
  - **O** — Open/Closed: abierto para extensión (herencia, composición), cerrado para modificación.
  - **L** — Liskov Substitution: las implementaciones deben ser sustituibles por sus abstracciones.
  - **I** — Interface Segregation: interfaces pequeñas y específicas.
  - **D** — Dependency Inversion: las capas superiores dependen de abstracciones (interfaces), no de implementaciones concretas.
- **DRY**: evitar duplicación en validaciones, mappers y lógica de negocio; extraer a `shared/` solo cuando haya reutilización real entre features.
- **YAGNI**: no añadir funcionalidad especulativa ni abstracciones prematuras.

### Ciberseguridad

Al tratarse de un producto financiero (banca de empresas), toda contribución debe seguir estas prácticas:

- **Sin secretos en código**: nunca hardcodear credenciales, API keys, tokens o connection strings. Usar variables de entorno o el gestor de secretos del proyecto (Secret Manager, Vault, etc.). Verificar que no se filtren en logs, commits ni mensajes de error.
- **Validación de entradas**: validar y sanear toda entrada del usuario o de servicios externos (tipo, formato, longitud, rango) tanto en frontend como en backend. Nunca confiar solo en la validación del cliente.
- **Prevención OWASP Top 10**: especial atención a inyección (SQL/NoSQL/command), XSS, deserialización insegura, SSRF y control de acceso roto (broken access control). Usar consultas parametrizadas/ORM, escapar salida HTML, y nunca construir queries o comandos por concatenación de strings.
- **Autenticación y autorización**: verificar autorización en cada endpoint (no solo autenticación), aplicando el principio de mínimo privilegio. No confiar en controles de acceso implementados solo en el frontend.
- **Gestión de dependencias**: mantener dependencias actualizadas y revisar vulnerabilidades conocidas (`npm audit`, Dependabot/Snyk) antes de introducir librerías nuevas.
- **Comunicación segura**: forzar HTTPS/TLS en todas las integraciones; no deshabilitar validación de certificados.
- **Logging seguro**: no loguear información sensible (contraseñas, tokens, PII, datos financieros). Los logs deben ser auditables pero no exponer datos que faciliten un ataque.
- **Manejo de errores**: no exponer stack traces, rutas internas ni detalles de infraestructura en respuestas al cliente; devolver mensajes de error genéricos y registrar el detalle solo en logs internos.

### Tratamiento de datos

Dado que el sistema maneja datos de clientes y operaciones financieras de empresas, aplican los siguientes lineamientos:

- **Minimización de datos**: solicitar, procesar y almacenar únicamente los datos estrictamente necesarios para la funcionalidad. Evitar copiar datos sensibles a nuevos módulos "por si acaso".
- **Clasificación de datos sensibles**: tratar como sensibles (mínimo) datos de identificación de clientes/empresas, información financiera, saldos, transacciones y credenciales. Estos datos requieren cifrado en tránsito (TLS) y en reposo cuando aplique.
- **Enmascaramiento/anonimización**: en ambientes no productivos (dev, pruebas, demos) usar datos ficticios o anonimizados; no usar dumps de datos reales de clientes.
- **Control de acceso a datos**: exponer en APIs y UI solo los campos que el rol del usuario necesita ver; evitar sobre-exposición de datos en respuestas (no devolver objetos completos "por comodidad").
- **Trazabilidad**: los cambios sobre datos sensibles (creación, modificación, eliminación) deben quedar auditados con usuario y timestamp cuando la operación lo amerite.
- **Cumplimiento normativo**: seguir lineamientos de protección de datos aplicables al sector financiero (habeas data / normativa local de protección de datos personales); no implementar mecanismos que dificulten el derecho del titular a la consulta, corrección o eliminación de sus datos.

## Contexto de negocio — Campaña TC LATAM Business

### Producto

- **Tarjeta de Crédito LATAM Business** (franquicia Visa), orientada a gastos corporativos, viajes, impuestos y compras nacionales/internacionales.
- El cupo pertenece a la **empresa** (persona jurídica), pero la tarjeta se emite a nombre de una **persona natural** designada (representante o colaborador).
- Segmentos objetivo: Pyme Pequeña, Pyme Mediana, Empresarial 1 (y afines en las bases operativas).

### Fuentes de datos para viabilidad (`file-matching`)

| Archivo | Rol | Llave principal |
|---------|-----|-----------------|
| Base Potencial VP Banca Empresas | Universo de empresas | `Cliente_Id` (NIT) |
| CEC | Cupos aprobados/disponibles | `NUME IDEN` (cédula PN / representante) |
| Clientes potenciales para grabar SG | Base refinada con valor sugerido | `IDENTIFICACION` (NIT) |

**Filtros típicos de elegibilidad para llamada de venta:**
- Base Potencial: `Producto TC = SIN TC` y `Cliente_Gestionable = Gestionable`
- SG: estado activo y valor sugerido > 0
- CEC: cupo disponible > 0 y vigencia del proyecto crediticio vigente

> El cruce NIT (empresa) ↔ cédula (CEC) no es directo; depende del representante o tarjetahabiente vinculado a la empresa.

### Flujo operativo end-to-end

```
file-matching (viabilidad: Base × CEC × SG)
  → sales-calls (Fonema.ia — llamada de venta)
  → power-apps (solicitud + validaciones + Cámara de Comercio)
  → operaciones (realce GOPTC, fabricación, armado de carpeta)
  → gerente de relaciones (recibe carpeta de operaciones)
  → gerente de la empresa solicitante (recibe tarjetas del gerente de relaciones)
  → activation-email (Resend)
  → activation-follow-up (Fonema.ia — seguimiento ~3 meses por activación)
```

**Cadena de entrega física:** operaciones no entrega directamente al cliente. Arma la carpeta con las tarjetas y se la entrega al **gerente de relaciones** del banco; este, a su vez, hace la entrega al **gerente de la empresa solicitante**, quien distribuye los plásticos dentro de la organización.

### Sales Calls (Fonema.ia — llamada de venta)

Etapa `sales-calls` del pipeline: entre `file-matching` (viabilidad) y `power-apps` (solicitud). Dispara una llamada saliente con un agente de voz (Fonema.ia) que verifica la identidad del representante (nombre, empresa, NIT) y ofrece la TC LATAM Business.

- **Ubicación**: `src/features/sales-calls/` (`domain` / `application` / `infrastructure` / `presentation`).
- **Integración Fonema**: `POST /v2/initiate-call` para disparar; el resultado (grabación, transcripción, análisis con `identidad_verificada`, `cliente_interesado`) llega asíncrono por **webhooks** (`call-update`, `end-of-call`, `end-of-session`) que se configuran en el dashboard del agente. Correlación por `session.id`.
- **Grabación**: se sirve vía proxy autenticado (`GET /calls/{id}/recording`, con soporte `Range`) para no exponer la API key de Fonema al frontend.
- **Persistencia**: `SupabaseCallRepository` (durable, tabla `calls`), requerido por serverless. `InMemoryCallRepository` se conserva para tests/seed. Ambos implementan la misma interfaz `CallRepository`.
- **Variables de entorno**: `FONEMA_API_URL`, `FONEMA_API_KEY`, `FONEMA_SALES_AGENT_ID` (+ Supabase para persistencia durable). `SEED_DEMO=true` carga una llamada de ejemplo en memoria.
- **Endpoints**: base `/api/sales-calls` (ver OAS `public/docs/openapi.yaml`, tag *Sales Calls*).

### Batch calling (campañas en `sales-calls`)

Capa de campaña construida **sobre** `initiate-call` de Fonema (que no trae batch nativo), siguiendo el estado del arte de Vapi/Retell/Bland: subir lista + política de pacing → el backend encola en Supabase → un dispatcher *progressive* la drena → el cliente hace polling de agregados.

- **Persistencia (Supabase, migración `003_call_campaigns.sql`)**: `calls` (migrada de `InMemoryCallRepository` a durable — requisito serverless: los webhooks llegan en otra invocación), `call_batches` (lista + pacing) y `call_batch_items` (cola; `unique (batch_id, lead_id)` para **idempotencia** anti-redisco). RLS: solo service role.
- **Dos perillas independientes + ventana** (`PacingPolicy`): `maxConcurrent` (slots simultáneos), `perHour` (throughput) y ventana de contacto (`earliestAt`/`latestAt` + `businessHours`/`timezone`). El techo real de concurrencia es el de la cuenta Fonema (~500); el pacing de negocio nunca lo excede. **La ventana y el ritmo son control de cumplimiento** (habeas data / horarios de contacto), no solo UX.
- **Dispatcher progressive** (`DispatchCallBatchesUseCase`, `GET|POST /cron/dispatch` con `verifyCronSecret`, cron por minuto en `vercel.json`): por cada batch `running` dentro de ventana calcula `headroom = min(maxConcurrent − activos, perHour − arrancadas_última_hora, en_cola)`, hace *claim atómico* (`queued→dialing`, guard anti doble-tick) de esa cantidad y dispara cada llamada reusando `InitiateCallUseCase`. No aborta el lote ante un fallo (marca el item `failed`). Cierra el batch a `completed` al vaciarse. Idéntico patrón al dispatcher de `delivery-confirmation`.
- **Correlación**: al despachar se fija `sessionId`/`callId` en el item; los webhooks (`end-of-call`/`end-of-session`) marcan el item `completed|failed` y setean `qualified` (identidad verificada + interesado, ver `domain/qualification.ts`).
- **Control de ciclo de vida**: `POST /batches/{id}/{pause|resume|cancel}`. Una campaña pausada no es drenada.
- **Endpoints**: `POST /batches`, `GET /batches`, `GET /batches/{id}` (progreso para polling), `GET /batches/{id}/items` (ver OAS, tag *Sales Calls*).

### Handoff a la Power App (`GET /calls/{id}/handoff`)

Cuando una llamada cierra **calificada**, `BuildPowerAppPrefillUseCase` mapea su resultado (variables + `structuredData` del análisis + datos del lead) a un **prefill** con la forma de `SubmitPowerAppDto`. El contrato vive en `shared/contracts/power-app-prefill.ts` (`PowerAppPrefill`) para no acoplar features: `sales-calls` no importa internals de `power-apps`. El front consume el prefill, pre-diligencia el formulario y hace `POST /api/power-apps/submit`.

### Power App (simulador en `power-apps`)

Tras cerrar la venta telefónica, se diligencia la solicitud con los datos de empresa, tarjetahabiente, cupo, entrega, Cámara de Comercio y producto (`TC_LATAM_BUSINESS`).

**Endpoint expuesto:** `POST /api/power-apps/submit`

**Comportamiento:** comprobación integral de campos — obligatorios, formatos, coherencia entre secciones y reglas de negocio. Cada problema se reporta en `issues[]` con `code`, `field`, `message`, `severity` y `suggestion` cuando aplica.

**Decisiones de salida:**

| Decisión | Significado |
|----------|-------------|
| `APROBADO` | Sin errores bloqueantes; genera radicado `GOPTC-YYYY-XXXXXXXX` para operaciones |
| `DEVUELTO` | Errores corregibles en uno o más campos; el asesor debe corregir y reenviar |
| `RECHAZADO` | Errores bloqueantes (formato, cupo, producto, etc.) |

**Comprobaciones implementadas (no exhaustivo):**
- Campos obligatorios y formatos (NIT, documento PN, email, teléfono, fechas)
- Coherencia entre identificaciones de empresa y tarjetahabiente
- Cupo solicitado vs disponible CEC
- Agendamiento de entrega (días hábiles, no fechas pasadas)
- Cámara de Comercio (presencia y coincidencia de NIT)
- Producto y segmento de campaña

**Bloque `entrega` (logística al radicar):**

| Campo | Significado |
|-------|-------------|
| `tipo: comercial` | Entrega coordinada por gerente de relaciones |
| `tipo: courier` | Envío certificado a la dirección indicada |
| `ciudad` / `direccion` | Punto de entrega o envío |
| `fechaAgendamiento` | Día hábil tentativo (lunes–viernes) |

Este bloque no modela la cadena operativa posterior (carpeta → gerente de relaciones → gerente de empresa); solo registra lo acordado en la solicitud.

### Agendamiento y ANS (referencia operativa)

- Bogotá: ~3 días hábiles; ciudades principales: 5–7 días hábiles; solo lunes a viernes.
- Realce/fabricación GOPTC: ~5 días hábiles adicionales.
- Seguimiento post-entrega: verificar activación real de la tarjeta durante ~3 meses.

## Arquitectura de datos (Supabase)

Persistencia en Postgres/Supabase (proyecto `banca-empresas-backend`, ref `eewlfdnhmzkgqshzfkeu`). Migraciones versionadas en `supabase/migrations/` y aplicadas con `supabase db push`. **Todas las tablas tienen RLS habilitado: solo el backend con `service_role` accede; la `anon key` queda bloqueada.** El acceso se hace por el cliente singleton `getSupabaseClient()` (`src/infrastructure/database/supabase.ts`).

### Inventario de tablas por migración

| Migración | Tablas | Rol |
|-----------|--------|-----|
| `000_file_matching` | `base_potencial`, `cec`, `clientes_potenciales_grabar`, `clientes_finales`, `clientes_finales_sin_pagare` | Insumos y resultado del cruce de viabilidad |
| `001_delivery_confirmation` | `pipeline_cases`, `company_managers`, `delivery_confirmation_cases`, `delivery_confirmation_emails` | Espina del pipeline + confirmación de entrega |
| `002_rls_delivery_confirmation` | (policies) | RLS de las tablas de pipeline/delivery |
| `003_call_campaigns` | `calls`, `call_batches`, `call_batch_items` | Llamadas Fonema durables + campañas (batch calling) |

### La espina: `pipeline_cases`

`pipeline_cases (id, lead_id, stage)` es el **caso** que viaja por el pipeline. La columna `stage` sigue el orden de `shared/contracts/pipeline.ts` (`PIPELINE_ORDER`): `file_matching → sales_call → power_apps → delivery_confirmation → activation_follow_up → completed` (+ `rejected`/`failed`). Las features **no se importan entre sí**: avanzan el caso vía el contrato `PipelineStageAdvancer.advance(caseId, toStage)` (`core/pipeline`), que valida que no se retroceda de etapa y actualiza `pipeline_cases.stage`. Ese es el único punto de acoplamiento entre etapas; los datos de cada etapa viven en las tablas de su feature y se referencian por `case_id`/`lead_id`.

### Cómo se conecta el pipeline (handoffs de datos)

```
file-matching            sales-calls (campañas)                 power-apps        delivery-confirmation      activation-follow-up
─────────────            ──────────────────────                 ─────────         ─────────────────────      ───────────────────
clientes_finales  ──►    call_batches                           (stateless:       delivery_confirmation_cases   (Fonema, ~3 meses)
(universo de leads)      └─ call_batch_items (cola, 1×lead)       valida el          └─ case_id → pipeline_cases
                            └─ call_id ─► calls (Fonema)          prefill y          delivery_confirmation_emails
                                          │  webhooks             emite radicado)    company_managers (destinatarios)
                                          ▼
                              qualified=true ─► GET /calls/:id/handoff
                                                   │ PowerAppPrefill (shared/contracts)
                                                   ▼  el front POSTea a /api/power-apps/submit
```

1. **file-matching → sales_call**: `clientes_finales` (cruce Base × CEC × SG, `Producto TC = SIN TC` + cupo>0) es el universo de leads. Cada lead entra a una campaña como fila en `call_batch_items` (idempotente por `unique(batch_id, lead_id)`).
2. **Dentro de sales-calls (batch calling)**: `call_batches` guarda la lista + el pacing; `call_batch_items` es la cola. El dispatcher progressive (`/cron/dispatch`) hace claim `queued→dialing`, dispara la llamada Fonema y persiste el resultado en `calls`, correlacionando por `session_id`/`call_id`. Los webhooks de Fonema cierran el item (`completed|failed`) y setean `qualified`.
3. **sales_call → power_apps**: un item/llamada con `qualified=true` habilita `GET /calls/:id/handoff`, que devuelve un `PowerAppPrefill` (contrato en `shared/contracts/power-app-prefill.ts`). El front lo usa para pre-diligenciar y hace `POST /api/power-apps/submit`. **`power-apps` es stateless (no tiene tabla):** valida y emite el radicado `GOPTC-YYYY-XXXXXXXX`; la persistencia del avance la lleva `pipeline_cases`.
4. **power_apps → delivery_confirmation**: al radicar y enviar físicamente, se crea un `delivery_confirmation_cases` que referencia `pipeline_cases (case_id)`; el cron `/process-due` envía el correo (Resend) a los `company_managers` y registra intentos en `delivery_confirmation_emails`. La confirmación del gerente avanza el caso.
5. **delivery_confirmation → activation_follow_up**: seguimiento de activación (~3 meses, Fonema). Feature aún en andamiaje.

### Correlación y claves entre tablas

- `call_batch_items.call_id → calls.id` y `calls.batch_item_id → call_batch_items.id` (correlación bidireccional; en la práctica se resuelve por `session_id` fijado al despachar).
- `delivery_confirmation_cases.case_id → pipeline_cases.id`; `delivery_confirmation_emails.delivery_case_id → delivery_confirmation_cases.id`.
- Ítems y casos referencian el `lead_id`/`case_id` del pipeline sin duplicar PII; los datos sensibles se minimizan por tabla (ver principios de *Tratamiento de datos*).

## Documentación

### Documentación API (OpenAPI)

- **Fuente única de verdad del contrato HTTP**: `public/docs/openapi.yaml` (OpenAPI 3.0.3). Todo endpoint expuesto debe estar documentado ahí; si un endpoint no está en el OAS, se considera no publicado.
- **Swagger UI**: `GET /docs` sirve la UI y `GET /docs/openapi.yaml` la especificación (local y producción). Los Excel de `docs/*.xlsx` no se versionan ni despliegan.
- **Sincronización obligatoria**: cualquier cambio en rutas, DTOs (schemas Zod), códigos de estado o formato de errores debe reflejarse en el OAS en el mismo cambio (mismo commit/PR), no después.

### Convenciones para documentar endpoints

- **Schemas reutilizables**: definir request/response en `components/schemas` y referenciarlos con `$ref`; no duplicar schemas inline entre endpoints.
- **Ejemplos realistas pero ficticios**: cada endpoint debe incluir al menos un ejemplo de request y de response por decisión relevante (ej. en `power-apps/submit`: `APROBADO`, `DEVUELTO` con campos corregibles, `RECHAZADO`). Nunca usar datos reales de clientes (NITs, cédulas, nombres) en ejemplos; usar datos sintéticos.
- **Errores documentados**: documentar los códigos de estado posibles (400 validación, 404, 500) con el schema de error estándar del proyecto. Los mensajes de error de los ejemplos no deben exponer detalles internos (stack traces, rutas, infraestructura).
- **Códigos de validación**: los `ValidationIssueCode` del dominio (ej. `FIELD_SWAP_NIT_CEDULA`, `CUPO_EXCEDE_DISPONIBLE`) se documentan como enum en el OAS para que los consumidores puedan reaccionar programáticamente a cada código.
- **Tags por feature**: agrupar endpoints con tags que coincidan con las features (`power-apps`, `sales-calls`, etc.) para que la UI refleje la arquitectura.

### Documentación de código y proyecto

- **README.md**: mantener actualizado el stack, el flujo de la campaña, cómo levantar el servicio local (`npm run dev`) y cómo acceder a la documentación (`/docs`).
- **CLAUDE.md (este archivo)**: registrar contexto de negocio, decisiones de arquitectura y reglas transversales; es la referencia para cualquier agente o desarrollador que entre al proyecto.
- **Comentarios en código**: solo para explicar intención no obvia o reglas de negocio (ej. por qué un NIT de 9 dígitos que inicia en 8/9 se trata como empresa); no comentar lo evidente.
- **Nuevas features**: al crear una feature nueva, documentar en el OAS sus endpoints y añadir a este archivo el contexto de negocio mínimo (qué etapa del pipeline cubre y con qué se integra).
