# Aurah 360 ClinicOS

Custom clinic operating system for **Aurah 360** (skin, hair & laser — Surat).

This is **not** a multi-tenant SaaS product. There is no organization onboarding, subscription billing, or white-label layer.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React, Vite, JavaScript, React Router, Tailwind, TanStack Query, Axios, Recharts |
| Backend | Node.js 20, Express, MongoDB, Mongoose, Zod, Winston |
| Cache / jobs | Redis, BullMQ |
| Realtime | Socket.io |
| Docs | OpenAPI 3 + Swagger UI |

## Architecture

```
Route → Zod validator → Controller → Service → Repository → MongoDB
```

Modules 1–18 deliver clinic workflows. **Module 19** hardens production (security, health, DevOps, docs).

## Quick start

### 1. Infrastructure

```bash
npm run infra:up
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

- API: `http://localhost:5000`
- Health: `http://localhost:5000/api/v1/health`
- Swagger: `http://localhost:5000/api/v1/docs`

Default staff (change immediately):

| Role | Email | Password |
|---|---|---|
| Owner | `owner@aurah360.local` | `ChangeMe@12345` |
| Admin | `admin@aurah360.local` | `ChangeMe@12345` |

Patient portal sample: `aarav.patel@example.local` / `Patient@12345`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`

## Folder structure

```
aurah360-clinicos/
├── backend/          Express API
├── frontend/         React SPA (staff/doctor/admin portal)
├── mobile/           React Native + JavaScript + Metro (patient app — see mobile/README.md)
├── docker/           Compose, Dockerfiles, nginx
├── docs/             Architecture, deployment, checklists
├── .github/workflows CI
└── ecosystem.config.cjs   PM2
```

## Production

See **[docs/deployment.md](docs/deployment.md)**.

```bash
docker compose -f docker/docker-compose.prod.yml --env-file backend/.env up -d --build
# or
pm2 start ecosystem.config.cjs --env production
```

### RC1 audit & ops docs

| Doc | Path |
|---|---|
| Final review | [docs/final-project-review.md](docs/final-project-review.md) |
| Code audit | [docs/code-audit.md](docs/code-audit.md) |
| Security audit | [docs/security-audit.md](docs/security-audit.md) |
| Database review | [docs/database-review.md](docs/database-review.md) |
| API / Frontend reviews | [docs/api-review.md](docs/api-review.md), [docs/frontend-review.md](docs/frontend-review.md) |
| Architecture / Modules | [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md), [docs/MODULES.md](docs/MODULES.md) |
| Deploy / Backup / Restore | [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md), [docs/BACKUP_GUIDE.md](docs/BACKUP_GUIDE.md), [docs/RESTORE_GUIDE.md](docs/RESTORE_GUIDE.md) |
| Security / Permissions | [docs/SECURITY_GUIDE.md](docs/SECURITY_GUIDE.md), [docs/PERMISSION_MATRIX.md](docs/PERMISSION_MATRIX.md) |
| Events / Queues | [docs/EVENT_CATALOG.md](docs/EVENT_CATALOG.md), [docs/QUEUE_CATALOG.md](docs/QUEUE_CATALOG.md) |
| Checklists | [security](docs/security-checklist.md), [performance](docs/performance-checklist.md), [M19 readiness](docs/production-readiness-report.md) |

## API guide

| Area | Prefix |
|---|---|
| Health | `/api/v1/health`, `/livez`, `/readyz` |
| Staff auth | `/api/v1/auth` |
| Clinic modules | `/api/v1/{branches,doctors,patients,appointments,…}` |
| Patient portal | `/api/v1/patient` |
| Reports (M16) | `/api/v1/reports` |
| Analytics (M18) | `/api/v1/analytics` |
| OpenAPI | `/api/v1/docs`, `/api/v1/openapi.json` |

## Scripts

**Root**

- `npm run infra:up` / `infra:down`
- `npm run seed`

**Backend**

- `npm run dev` / `start`
- `npm run db:migrate` / `db:backup` / `db:restore` / `db:indexes`
- `npm run smoke:module19` / `smoke:regression`

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Critical production flags:

- `NODE_ENV=production`
- `JWT_*_SECRET` (≥32 chars)
- `COOKIE_SECURE=true`
- `CORS_ORIGINS=https://your-domain`
- `ENABLE_SWAGGER=false`

## Module status

| Module | Status |
|---|---|
| 1–17 | Approved |
| 18 Analytics | Approved |
| 19 Production Hardening | Complete (final phase) |
