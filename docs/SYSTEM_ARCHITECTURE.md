# System Architecture — Aurah 360 ClinicOS

## Product shape

Single-clinic operating system (not multi-tenant SaaS) for Aurah 360.

## High-level

```
┌─────────────┐     HTTPS      ┌──────────────┐
│ React SPA   │ ─────────────► │ Nginx / API  │
│ Staff+Portal│                │ Express v1   │
└─────────────┘                └──────┬───────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
               MongoDB 7           Redis 7         Filesystem
               (domain)         (cache/BullMQ)    (local uploads)
```

## Request pipeline

```
Route → Zod validate → Auth/RBAC middleware → Controller → Service → Repository → MongoDB
```

Side effects: `eventBus` → NotificationService → BullMQ → providers (mock/real).  
Realtime: Socket.io rooms (`branch:`, `doctor:`).

## Frontend

- Vite + React 18 + React Router 7  
- TanStack Query for server state  
- Zod + RHF for forms (partial coverage)  
- Route-level code splitting (`lazyPages.js`)

## Backend layers

| Layer | Responsibility |
|---|---|
| Routes | Mount + middleware chain |
| Validators | Zod schemas |
| Controllers | HTTP mapping only |
| Services | Business rules |
| Repositories | Persistence |
| Models | Mongoose schemas/indexes |

**Exceptions (documented):** Report/Analytics/Portal services often aggregate via Models directly for performance/reporting.

## Cross-cutting

- Winston rotating logs + security/audit/worker channels  
- AuditService → `AuditLog` collection  
- Health: liveness / readiness / full metrics  
- Storage factory: local now; S3/Azure/GCS placeholders  

## Related docs

- `docs/architecture/overview.md`  
- `docs/architecture/folder-structure.md`  
- `docs/MODULES.md`  
