# Deployment Guide — Aurah 360 ClinicOS

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- MongoDB 7 / Redis 7 (or use compose)
- TLS certificate for production HTTPS

## Environment

1. Copy `backend/.env.example` → `backend/.env`
2. Set strong secrets (≥32 chars) for all JWT keys
3. Production checklist:
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true`
   - `CORS_ORIGINS=https://your-clinic-domain`
   - `ENABLE_SWAGGER=false`
   - Change all seed passwords immediately

Frontend: `frontend/.env` → `VITE_API_BASE_URL=/api/v1` (behind nginx) or absolute API URL.

## Local infrastructure

```bash
npm run infra:up
cd backend && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

## Production with Docker Compose

```bash
docker compose -f docker/docker-compose.prod.yml --env-file backend/.env up -d --build
```

Services: `mongodb`, `redis`, `api`, `web` (nginx reverse proxy).

Health probes:

- Liveness: `GET /api/v1/health/livez`
- Readiness: `GET /api/v1/health/readyz`
- Full: `GET /api/v1/health`

## Production with PM2

```bash
cd backend && npm ci --omit=dev
pm2 start ../ecosystem.config.cjs --env production
pm2 save
```

Serve the Vite build with nginx (see `docker/nginx.conf`).

## Database maintenance

```bash
cd backend
npm run db:migrate          # sync indexes
npm run db:backup           # placeholder → use mongodump
npm run db:restore          # placeholder → use mongorestore
npm run db:indexes          # list indexes
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):

1. Backend env import check  
2. Frontend production build  
3. Docker image builds  
4. Deploy placeholder (wire to your host)

## Rollback

1. Keep previous Docker image tags  
2. Restore Mongo backup before schema-breaking changes  
3. `pm2 reload` / compose rolling restart  

## Post-deploy verification

```bash
cd backend
API_BASE=https://your-domain/api/v1 npm run smoke:module19
API_BASE=https://your-domain/api/v1 npm run smoke:regression
```
