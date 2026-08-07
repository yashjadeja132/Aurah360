# Release Notes — Aurah 360 ClinicOS `v1.0.0-rc.1`

**Product:** Aurah 360 ClinicOS  
**Version:** `1.0.0-rc.1` (see root `VERSION`)  
**Release type:** Release Candidate 1 — **Client UAT candidate**  
**Date:** 2026-08-06  
**Scope baseline:** Approved Modules 1–19 · ADR-001 · single-clinic multi-branch  
**Pre-UAT:** Conditional PASS — see `docs/pre-uat-validation.md`  
**Production gate:** **Not cleared** until Production Checklist / P0 blockers are closed

> This release documents the RC1 candidate. **No new product features** were added for this documentation pack.

---

## Project Summary

Aurah 360 ClinicOS is a **custom clinic operating system** for Aurah 360 (skin, hair & laser — Surat). It is **not** multi-tenant SaaS: no organization onboarding, subscription billing, or white-label layer.

RC1 delivers the approved end-to-end clinic workflow:

**Lead → Patient → Appointment → Reception → Queue → Consultation → Prescription → Treatment Plan → Billing → Payment → Treatment Session → Pharmacy → Inventory → Reports → Patient Portal**

plus analytics dashboards and production-hardening foundations (security middleware, health probes, queues/DLQ, Docker/PM2 docs).

| Gate | Status |
|---|---|
| Client UAT | **Ready** (with disclosed caveats) |
| Production internet exposure | **Not ready** until P0 checklist items complete |

---

## Implemented Modules

| # | Module | Status | Primary surfaces |
|---|---|---|---|
| 1 | Foundation / Auth / RBAC | Approved | `/auth`, users, roles |
| 2 | Branches & Masters | Approved | `/branches`, `/masters` |
| 3 | Doctors | Approved | `/doctors`, schedules, leave |
| 4 | Patients | Approved | `/patients`, documents |
| 5 | Scheduling | Approved | `/scheduling` |
| 6 | Appointments | Approved | `/appointments` |
| 7 | Reception & Queue | Approved | `/reception`, `/queue` |
| 8 | EMR / Consultations | Approved | `/consultations` |
| 9 | Prescriptions | Approved | `/prescriptions` |
| 10 | Treatment Plans | Approved | `/treatment-plans` |
| 11 | Billing | Approved | `/billing` |
| 12 | Treatment Sessions | Approved | `/treatment-sessions` |
| 13 | Inventory & Pharmacy | Approved | `/inventory`, `/pharmacy` |
| 14 | CRM | Approved | `/crm` |
| 15 | Notifications | Approved | `/notifications` |
| 16 | Reports (role dashboards) | Approved | `/reports` |
| 17 | Patient Portal | Approved | `/patient`, `/portal` |
| 18 | Analytics | Approved | `/analytics` |
| 19 | Production Hardening | Complete | security, health, DevOps, docs |

Register: `docs/MODULES.md`.

---

## Architecture

Layered API and SPA:

```
Route → Zod validator → Controller → Service → Repository → MongoDB
```

Cross-cutting:

- **Events:** in-process domain event bus (`emitDomain`) → notifications / side effects  
- **Jobs:** Redis + BullMQ (`notifications`, `reports`, `analytics`, `crm`, `files`) + dead-letter queue  
- **Realtime:** Socket.io rooms (`branch:*`, `doctor:*`) for queue / operational updates  
- **Auth:** Staff JWT + Patient portal JWT (separate claim space / optional dedicated secrets)  
- **RBAC:** Permission keys + Owner wildcard; frontend `ProtectedRoute` / `PermissionGuard`

High-level layout:

```
aurah360-clinicos/
├── backend/          Express API
├── frontend/         React SPA (Vite)
├── docker/           Compose, Dockerfiles, nginx
├── docs/             Architecture, ops, audits, release notes
├── .github/workflows CI
├── ecosystem.config.cjs
├── CHANGELOG.md
└── VERSION
```

See `docs/SYSTEM_ARCHITECTURE.md`, `docs/EVENT_CATALOG.md`, `docs/QUEUE_CATALOG.md`.

---

## Technology Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 20 |
| Frontend | React, Vite, JavaScript, React Router, Tailwind, TanStack Query, Axios, Recharts |
| Backend | Express, MongoDB, Mongoose, Zod, Winston (daily rotate) |
| Cache / jobs | Redis, BullMQ (+ DLQ) |
| Realtime | Socket.io |
| API docs | OpenAPI 3 + Swagger UI (`/api/v1/docs`) |
| Process / edge | PM2, Docker Compose, nginx |
| Validation | Zod (request body/query/params) |

---

## Production Requirements

Minimum for a **controlled single-clinic** production deploy (after UAT sign-off):

| Requirement | Notes |
|---|---|
| Node.js 20+ | API and build tooling |
| MongoDB | Primary datastore; indexes via `db:migrate` |
| Redis | BullMQ + cache (analytics) |
| TLS | Terminate at nginx / load balancer |
| Secrets | JWT secrets ≥ 32 chars; vault or sealed store |
| Storage | `STORAGE_DRIVER=local` until private/cloud storage ready |
| Observability | Winston log channels; monitor DLQ and `/health/readyz` |
| Backups | Operational `mongodump` (npm backup script is placeholder) |
| Network | Tight `CORS_ORIGINS`; `COOKIE_SECURE=true` behind HTTPS |
| Docs API | `ENABLE_SWAGGER=false` on internet-facing hosts |

**Do not** expose RC1 to the public internet until the Production Checklist and P0 known issues are resolved or formally waived.

---

## Known Issues

| ID | Severity | Issue |
|---|---|---|
| KI-1 | P0 | Public static `/uploads` — unauthenticated file URLs if path known |
| KI-2 | P0 | Seed/default passwords and example JWT secrets must be rotated |
| KI-3 | P0 | `db:backup` / restore npm scripts are placeholders — wire `mongodump` |
| KI-4 | P0 | Notification providers are mock — need client waiver **or** one live channel |
| KI-5 | P1 | Cash close not implemented |
| KI-6 | P1 | Billing refund is a placeholder |
| KI-7 | P1 | Patient merge is a placeholder |
| KI-8 | P2 | PDF export is a placeholder adapter (CSV/Excel work) |
| KI-9 | P2 | Analytics AI category is placeholder |
| KI-10 | P2 | Socket.io lacks Redis adapter (multi-instance scale) |
| KI-11 | P2 | Module 13 smoke can fail partial dispense when remaining qty is `0` (data state) |
| KI-12 | P3 | No dedicated staff audit **list** REST UI (audits still written server-side) |

Source: `docs/pre-uat-validation.md`, `docs/security-audit.md`, `docs/production-readiness-report.md`.

---

## Known Limitations

- **Single clinic only** — no multi-org / SaaS tenancy  
- **Web patient portal** — no native iOS/Android app in this release  
- **Mock communications** — WhatsApp / SMS / email adapters do not call live vendors  
- **Local file storage** — S3/Azure/GCS adapters are placeholders  
- **Payment gateway** — out of approved MVP scope (cash/manual recording in billing)  
- **AI clinical / analytics copilot** — deferred; interfaces/placeholders only  
- **Forgot-password** — non-email placeholder flow from earlier modules  
- **Lint / unit-test depth** — smoke scripts primary QA; ESLint/full suite still light  
- **CSRF** — bearer-token SPA preferred; no CSRF token layer if cookies alone carry session  

---

## Deferred Features

Intentionally **out of RC1 / approved v1** (roadmap or Phase 2–3):

| Item | Treatment |
|---|---|
| NestJS + PostgreSQL + Prisma rewrite | Deferred (ADR-001 Accepted) |
| Next.js App Router + TypeScript rewrite | Deferred (ADR-001) |
| React Native / Expo patient app | Deferred (web portal replaces for v1) |
| Live WhatsApp / DLT SMS / push vendors | Phase 2 (unless waived mocks) |
| Live AI clinical copilot | Deferred |
| Payment gateway integration | Out of MVP |
| ABDM / FHIR / teleconsult / kiosks | Phase 3 |
| MFA for Owner/Admin | Future hardening |
| Rooms/devices collision engine | Roadmap |
| Appointment Pending Approval states | Roadmap |
| Travel buffer | Roadmap |
| GU/HI localization | Roadmap |
| Private signed-URL / auth-gated uploads | Required before PHI prod — treat as P0 fix, not “feature” |

See `docs/final-scope-reconciliation.md`.

---

## ADR Decisions

| ADR | Status | Decision |
|---|---|---|
| **ADR-001** Stack for Aurah 360 ClinicOS | **Accepted** | React+Vite+JS frontend; Express+MongoDB/Mongoose backend; Redis+BullMQ; Socket.io. PRD Nest/Postgres/Next/Expo **not** used for this delivery. |

Document: `docs/adr/001-stack-decision.md`.

---

## Deployment Steps

### A. Local / UAT stack

```bash
# 1. Infra
npm run infra:up

# 2. Backend
cd backend
cp .env.example .env   # set secrets for the environment
npm install
npm run seed           # UAT/demo only — never reuse seed passwords in prod
npm run db:migrate
npm run dev            # http://localhost:5000

# 3. Frontend
cd ../frontend
cp .env.example .env   # VITE_API_BASE_URL → API
npm install
npm run dev            # http://localhost:5173
```

### B. Production-style (Docker)

```bash
# Configure backend/.env for production first
docker compose -f docker/docker-compose.prod.yml --env-file backend/.env up -d --build
docker compose -f docker/docker-compose.prod.yml exec api node src/scripts/db/migrate.js
curl -sS https://your-host/api/v1/health/readyz
```

### C. PM2 + nginx

```bash
cd backend && npm ci --omit=dev
pm2 start ../ecosystem.config.cjs --env production
# Serve frontend/dist via nginx (docker/nginx.conf)
```

### D. Post-deploy smoke

```bash
API_BASE=https://your-host/api/v1 npm run smoke:module19
API_BASE=https://your-host/api/v1 npm run smoke:regression
```

Canonical guides: `docs/DEPLOYMENT_GUIDE.md`, `docs/deployment.md`.

---

## Environment Variables

### Backend (`backend/.env.example`)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `APP_NAME` / `APP_URL` / `PORT` / `API_PREFIX` / `TZ` | App identity & listen |
| `CORS_ORIGINS` | Comma-separated allowlist |
| `MONGODB_URI` | Mongo connection |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` | Redis |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Staff JWT (≥32 chars) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token TTLs |
| `PATIENT_JWT_*` | Optional dedicated portal secrets |
| `COOKIE_SECURE` / `COOKIE_SAME_SITE` | Cookie flags (`true` + HTTPS in prod) |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_PATH` | Files (`local` for RC1) |
| `LOG_LEVEL` / `LOG_DIR` | Winston |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Global rate limit |
| `ENABLE_SWAGGER` | Set `false` on internet-facing prod |
| `CLINIC_NAME` / `CLINIC_DEFAULT_TIMEZONE` / `CLINIC_DEFAULT_LOCALE` | Clinic defaults |

### Frontend (`frontend/.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_APP_NAME` | Display name |
| `VITE_API_BASE_URL` | API base (e.g. `https://host/api/v1`) |
| `VITE_APP_ENV` | Environment label |
| `VITE_DEFAULT_LOCALE` / `VITE_DEFAULT_TIMEZONE` | Defaults |

**Production critical:** `NODE_ENV=production`, strong `JWT_*`, `COOKIE_SECURE=true`, tight `CORS_ORIGINS`, `ENABLE_SWAGGER=false`.

---

## Database Migration

ClinicOS uses **Mongoose schemas + index sync**, not sequential SQL migrations.

```bash
cd backend
npm run db:migrate    # sync indexes for registered models
npm run db:indexes    # verify indexes (if scripted)
```

In Docker:

```bash
docker compose -f docker/docker-compose.prod.yml exec api node src/scripts/db/migrate.js
```

**Before any migrate on shared data:** take a `mongodump` (see Backup Checklist).

---

## Seed Data Notes

```bash
npm run seed
```

| Account | Email | Default password |
|---|---|---|
| Owner | `owner@aurah360.local` | `ChangeMe@12345` |
| Admin | `admin@aurah360.local` | `ChangeMe@12345` |
| Sample portal patient | `aarav.patel@example.local` | `Patient@12345` |

**Rules for RC1 / UAT:**

- Seed is for **demo and UAT** environments only.  
- **Rotate all passwords** before any shared staging that resembles production.  
- Do **not** run destructive re-seed against a client-populated database without backup + approval.  
- Seed loads sample branches, doctors, patients, CRM, inventory, notifications, portal accounts (Modules 1–17+).  

---

## Breaking Changes

`1.0.0-rc.1` is the **first public RC** from internal `0.1.0` development. Treat as initial contract freeze for UAT:

| Area | Note |
|---|---|
| API prefix | Stable at `/api/v1` |
| Auth | Staff vs patient JWT are **not** interchangeable |
| List APIs | Many clinical lists are **scoped** (e.g. queue by `branchId`, prescriptions by `doctorId`) — not always `GET /resource?page=` |
| Reports vs Analytics | `/reports` (M16) and `/analytics` (M18) are parallel; do not assume one replaces the other |
| Swagger | May be disabled when `ENABLE_SWAGGER=false` or unset in production |

No prior external GA version — consumers should pin to `1.0.0-rc.1` for UAT and expect possible API polish before `1.0.0`.

---

## Security Checklist

Copy for release/ops sign-off (expand with `docs/security-checklist.md`, `docs/SECURITY_GUIDE.md`):

- [ ] TLS enabled end-to-end (HTTPS)  
- [ ] `COOKIE_SECURE=true`, appropriate `COOKIE_SAME_SITE`  
- [ ] `CORS_ORIGINS` limited to real web origins  
- [ ] `ENABLE_SWAGGER=false` on public hosts  
- [ ] JWT secrets (≥32) unique per environment; not committed  
- [ ] Optional `PATIENT_JWT_*` secrets set separately  
- [ ] Seed / default passwords rotated; demo accounts disabled or deleted  
- [ ] Auth rate limits verified  
- [ ] RBAC smoke: unauthorized → 401; cross patient/staff JWT → 401/403  
- [ ] **Auth-gate or remove public `/uploads`** before PHI photos  
- [ ] Audit channel / Mongo audit samples reviewed  
- [ ] DLQ and error logs monitored  
- [ ] No secrets in git or CI logs  

RC1 security residual score (audit): ~6.5/10 — see `docs/security-audit.md`.

---

## Backup Checklist

- [ ] Document `MONGODB_URI` and retention policy  
- [ ] Schedule daily `mongodump` (retain 14–30 days)  
- [ ] Backup `STORAGE_LOCAL_PATH` (uploads) with filesystem/object sync  
- [ ] Store `.env` / secrets in vault only  
- [ ] Pre-deploy dump before migrate or major release  
- [ ] Quarterly restore drill (`docs/RESTORE_GUIDE.md`)  
- [ ] Confirm Redis is rebuildable (not sole clinical SoR)  

```bash
OUT="./backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
mongodump --uri="$MONGODB_URI" --out="$OUT"
```

See `docs/BACKUP_GUIDE.md`.

---

## Rollback Plan

1. **Stop** new traffic (nginx / compose / PM2).  
2. **Preserve** current logs and a final `mongodump` of the failed revision if data may have changed.  
3. **Restore** previous application artifact (previous Docker image tag / PM2 release / `frontend/dist`).  
4. **Restore Mongo** from the pre-deploy dump if schema/data migration is incompatible (RC1 migrate is index-oriented — still dump first).  
5. **Re-point** `VITE_API_BASE_URL` / reverse proxy to the rolled-back API.  
6. **Verify** `/api/v1/health/readyz`, staff login, one clinical read path, portal login.  
7. **Communicate** to clinic ops: estimated RTO and any data loss window.  

Do **not** `push --force` or drop production databases without explicit owner approval.

---

## Client UAT Checklist

Use with `docs/pre-uat-validation.md`. Sign each workflow:

- [ ] Staff login / logout / refresh  
- [ ] CRM: create lead → assign → convert to patient  
- [ ] Patient create / search / edit  
- [ ] Book appointment → calendar visibility  
- [ ] Reception check-in → queue call-next  
- [ ] Start consultation → SOAP/vitals → complete  
- [ ] Create & finalize prescription → print  
- [ ] Treatment plan: protocol/package → approve → consent  
- [ ] Create invoice → partial/split payment → print  
- [ ] Treatment session start/complete (payment gate)  
- [ ] Pharmacy queue / dispense  
- [ ] Inventory dashboard / low stock awareness  
- [ ] Reports role dashboard + CSV/Excel export  
- [ ] Analytics executive / category view  
- [ ] Patient portal: login, appointments, records, billing, feedback  
- [ ] Role smoke: receptionist cannot access doctor-only actions (sample)  
- [ ] Notification inbox receives in-app items  
- [ ] Confirm **known limitations** accepted (mocks, PDF placeholder, no cash close)

**UAT exit:** written client sign-off + defect list prioritized for `1.0.0`.

---

## Production Checklist

- [ ] Client UAT signed off  
- [ ] All **P0** known issues closed or formally waived  
- [ ] Production `.env` secrets set; seed passwords gone  
- [ ] Mongo + Redis provisioned; TLS live  
- [ ] `db:migrate` run; indexes verified  
- [ ] `mongodump` schedule + restore test documented  
- [ ] Private/auth-gated file storage for uploads  
- [ ] `ENABLE_SWAGGER=false`; CORS locked  
- [ ] Docker compose **or** PM2 + nginx deployed  
- [ ] `livez` / `readyz` / `health` green  
- [ ] `smoke:module19` + `smoke:regression` against prod URL  
- [ ] Log shipping / DLQ watch for 24–48h  
- [ ] Support contacts published to clinic ops  

---

## Support Contacts

| Role | Contact | Notes |
|---|---|---|
| Product owner (clinic) | *TBD — Aurah 360* | Business / UAT acceptance |
| Delivery / engineering lead | *TBD — project team* | Defects, RC builds |
| On-call / ops | *TBD* | Uptime, backups, restores |
| Security incidents | *TBD* | Suspected PHI exposure, credential leak |

Update this table before client handoff. Escalate P0 (PHI, auth bypass, data loss) immediately.

---

## Future Roadmap

| Horizon | Themes |
|---|---|
| **Before `1.0.0` GA** | Private uploads; real backup/restore; secret rotation; cash close / refund / merge decisions; notification waiver or live channel |
| **Phase 2** | Live WhatsApp/SMS/email; richer PDF; MFA; Socket Redis adapter; deeper integration tests |
| **Phase 3 / PRD stretch** | ABDM/FHIR, teleconsult, native apps, rooms/devices engine, localization (GU/HI), payment gateway (if required) |
| **Explicit non-goals (remain)** | Multi-tenant SaaS, autonomous diagnosis, image-diagnosis AI without clinical governance |

---

## Related documents

| Doc | Path |
|---|---|
| Changelog | `CHANGELOG.md` |
| Version stamp | `VERSION` |
| Pre-UAT validation | `docs/pre-uat-validation.md` |
| Scope reconciliation | `docs/final-scope-reconciliation.md` |
| Production readiness | `docs/production-readiness-report.md` |
| Security audit | `docs/security-audit.md` |
| Deployment | `docs/DEPLOYMENT_GUIDE.md` |
| ADR-001 | `docs/adr/001-stack-decision.md` |

---

**Release designation:** `Aurah 360 ClinicOS v1.0.0-rc.1` — Release Candidate for Client UAT.
