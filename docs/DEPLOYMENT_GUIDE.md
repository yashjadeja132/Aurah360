# Deployment Guide

Canonical ops runbook. (Alias of Module 19 deployment content.)

See **[deployment.md](./deployment.md)** for full steps.

## Quick production path

```bash
# 1. Secrets
cp backend/.env.example backend/.env
# set NODE_ENV=production, strong JWT secrets, COOKIE_SECURE=true,
# CORS_ORIGINS, ENABLE_SWAGGER=false

# 2. Compose
docker compose -f docker/docker-compose.prod.yml --env-file backend/.env up -d --build

# 3. Indexes
docker compose -f docker/docker-compose.prod.yml exec api node src/scripts/db/migrate.js

# 4. Verify
curl -sS https://your-host/api/v1/health/readyz
```

## PM2 alternative

```bash
cd backend && npm ci --omit=dev
pm2 start ../ecosystem.config.cjs --env production
```

Serve `frontend/dist` via nginx (`docker/nginx.conf`).

## Post-deploy

```bash
API_BASE=https://your-host/api/v1 npm run smoke:module19
API_BASE=https://your-host/api/v1 npm run smoke:regression
```
