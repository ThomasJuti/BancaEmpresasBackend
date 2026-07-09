# Banca Empresas Backend

Backend del pipeline de venta de **Tarjeta de Crédito LATAM Business** (Banca Empresas — Banco de Bogotá).

## Stack

- TypeScript + Express
- Supabase (Postgres)
- Fonema.ia · Resend

## Inicio rápido

```bash
cp .env.example .env
npm install
npm run dev
```

Servicio en `http://localhost:3000`.

## API expuesta
## Despliegue

### Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Aplica el esquema (elige una opción):
   - **CLI**: `supabase link --project-ref <ref>` y luego `supabase db push`
   - **SQL Editor**: ejecuta [`supabase/schema.sql`](supabase/schema.sql) de una vez
3. Copia `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` al entorno de Vercel.

### Vercel

1. Importa el repo en [vercel.com](https://vercel.com) (Framework: **Other**, Build Command: vacío).
2. Configura las variables de [`.env.example`](.env.example) en **Settings → Environment Variables**.
3. En producción usa `TIME_COMPRESSION_DAY_MS=86400000` (1 día real).
4. Deploy. El cron de `vercel.json` procesa correos de delivery-confirmation cada 5 min (requiere plan Pro para frecuencia menor a 1/día).

Health en producción: `GET https://<tu-app>.vercel.app/health`

## API expuesta actualmente

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/power-apps/submit` | Simulador Power App — comprobación de campos |

Documentación interactiva: **http://localhost:3000/docs**  
Especificación: [`docs/openapi.yaml`](docs/openapi.yaml)

Importa el OAS en Bruno, Postman o Insomnia para generar la colección de pruebas.

### Power App — respuestas

| Decisión | HTTP | Significado |
|----------|------|-------------|
| `APROBADO` | 201 | Solicitud válida; genera radicado GOPTC |
| `DEVUELTO` | 422 | Campos corregibles (`issues[]` con sugerencias) |
| `RECHAZADO` | 400 / 422 | Formato inválido o regla de negocio bloqueante |

## Flujo operativo (contexto)

```
file-matching → sales-calls → power-apps → operaciones
  → gerente de relaciones → gerente de la empresa solicitante
  → delivery-confirmation → activation-follow-up
`POST /api/power-apps/submit` — comprobación integral de campos de la solicitud de TC LATAM Business y retorna `APROBADO`, `DEVUELTO` o `RECHAZADO` con detalle por campo (`issues[]`: código, mensaje, sugerencia).

## Otras etapas del pipeline (en desarrollo)

Las siguientes etapas existen en el código pero aún no están expuestas en la API pública:

- **file-matching** — cruce de fuentes (Base Potencial × CEC × SG)
- **sales-calls** — llamadas de venta (Fonema.ia)
- **delivery-confirmation** — confirmación de entrega física (Resend)
- **activation-follow-up** — seguimiento post-entrega (Fonema.ia)

### file-matching (referencia interna)

### 1. Crear las tablas

Ejecutar [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor de Supabase, o `supabase db push` si usas la CLI.

### 2. Precargar las fuentes desde Excel

En producción las fuentes llegan de un sistema externo; para pruebas se precargan desde los
Excel de `docs/` (no versionados — contienen datos reales de clientes):

```bash
npm run seed              # parsea y sube las 3 fuentes a Supabase
npm run seed -- --dry-run # solo parsea y muestra conteos, sin tocar la base
```

**Entrega física:** operaciones arma la carpeta y la entrega al gerente de relaciones; este entrega las tarjetas al gerente de la empresa solicitante.

El bloque `entrega` del submit captura la logística acordada al radicar (`tipo`, `ciudad`, `direccion`, `fechaAgendamiento`). No modela el tracking posterior de la carpeta.

## Otras etapas (código interno, sin API pública aún)

`file-matching`, `sales-calls`, `delivery-confirmation`, `activation-follow-up`.  
Scripts y esquema de BD: `scripts/`, `supabase/schema.sql`.
