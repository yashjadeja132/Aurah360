# Architecture overview — Aurah 360 ClinicOS

## Product shape

- **Single client:** Aurah 360 Clinic only
- **Multi-branch:** yes (unlimited branches per PRD)
- **Multi-tenant SaaS:** no
- **Billing/subscription plans:** no
- **Org onboarding / white-label:** no

Every domain record will carry **branch context** where relevant. There is no `tenantId` or organization marketplace layer.

## Request flow (backend)

```text
HTTP Request
  → Route (/api/v1/...)
  → Validation middleware (Zod)
  → Auth / permission middleware (when required)
  → Controller (HTTP only)
  → Service (business rules)
  → Repository (MongoDB access)
  → Mongoose model
```

Controllers never contain business logic. Repositories never contain business rules.

## Layer responsibilities

| Layer | Responsibility |
|---|---|
| `routes/` | Wire paths, middleware, controllers |
| `validators/` | Zod schemas (server is source of truth) |
| `controllers/` | Parse HTTP, call service, return `ApiResponse` |
| `services/` | Domain logic, orchestration, authorization decisions |
| `repositories/` | Queries/mutations only |
| `models/` | Mongoose schemas |
| `middlewares/` | Cross-cutting (auth, errors, validation, request id) |
| `jobs/` + `queues/` | BullMQ background work |
| `events/` | In-process domain events (outbox later) |
| `storage/` | Local now; S3-compatible later behind factory |
| `socket/` | Realtime bootstrap |

## Frontend module layout

```text
modules/<domain>/
  api/          # Axios calls for this domain
  components/   # Domain UI
  hooks/        # TanStack Query hooks
  validation/   # Zod forms
  utils/        # Domain helpers
```

Shared UI lives in `components/ui` (shadcn) and `components/common`.
Pages are thin; modules own behaviour.

## Auth skeleton

- Access JWT (short-lived) + Refresh JWT (opaque hash stored in Mongo)
- Cookies (httpOnly) + Bearer header support
- Role templates + permission arrays (PRD roles)
- `authenticate` → `currentUser` → `requirePermission` / `requireRole`

## Configuration

All runtime values come from environment variables validated by Zod (`backend/src/config/env.js`) and exposed via `config`.

## Explicit non-goals for foundation

- Patient, appointment, EMR, billing, inventory modules
- WhatsApp / DLT / AI adapters
- Multi-organization tenancy
- Payment gateway
