# API Guide

Base URL: `/api/v1`  
Interactive docs: `/api/v1/docs`  
Machine-readable: `/api/v1/openapi.json`

## Authentication

Staff: `POST /auth/login` → Bearer access token + refresh token.  
Refresh: `POST /auth/refresh` (rotation).  
Logout: `POST /auth/logout`.

Patient portal uses a separate JWT space under `/patient/auth/*`.

## Versioning

All routes are under `/api/v1`. Breaking changes require a new prefix (`/api/v2`).

## Errors

Consistent envelope:

```json
{
  "success": false,
  "message": "Human readable",
  "code": "ERROR_CODE",
  "errors": [{ "path": "field", "message": "…" }]
}
```

## Health (no auth)

| Path | Purpose |
|---|---|
| `/health` | Full status + metrics |
| `/health/livez` | Process liveness |
| `/health/readyz` | Mongo + Redis readiness |
| `/health/healthz` | Alias of full health |

## Major modules

See Swagger tags and `README.md` route table. Domain routes require `Authorization: Bearer <accessToken>` and matching RBAC permissions.
