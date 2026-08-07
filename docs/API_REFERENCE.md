# API Reference

Interactive: `GET /api/v1/docs`  
Machine: `GET /api/v1/openapi.json`  
Guide: `docs/api-guide.md` · Review: `docs/api-review.md`

## Conventions

- Base path: `/api/v1`
- Auth: `Authorization: Bearer <accessToken>` (staff or patient)
- Errors: `ApiError` JSON envelope
- Validation: Zod → `422 VALIDATION_ERROR` typically

## Health (public)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Full health + metrics |
| GET | `/health/livez` | Liveness |
| GET | `/health/readyz` | Mongo + Redis readiness |
| GET | `/health/healthz` | Alias |

## Auth (staff)

| Method | Path |
|---|---|
| POST | `/auth/login` |
| POST | `/auth/refresh` |
| POST | `/auth/logout` |
| GET | `/auth/me` |
| POST | `/auth/change-password` |

## Domain mounts

`/users` `/roles` `/branches` `/masters` `/doctors` `/patients` `/scheduling` `/appointments` `/reception` `/queue` `/consultations` `/prescriptions` `/treatment-plans` `/billing` `/treatment-sessions` `/inventory` `/pharmacy` `/crm` `/notifications` `/reports` `/analytics` `/patient`

## Patient portal auth

| Method | Path |
|---|---|
| POST | `/patient/login` |
| POST | `/patient/refresh` |
| POST | `/patient/logout` |
| GET | `/patient/me` |

Expand OpenAPI incrementally; smoke scripts exercise critical paths.
