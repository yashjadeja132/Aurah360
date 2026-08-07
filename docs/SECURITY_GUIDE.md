# Security Guide

Operational security handbook for ClinicOS. Detailed audit: `docs/security-audit.md`.

## Principles

1. Least privilege via RBAC permissions  
2. Short-lived access tokens + rotating refresh tokens  
3. Never log PHI, passwords, or raw tokens  
4. Fail closed on missing permissions  
5. Validate all inputs with Zod  

## Authentication

- Staff JWT secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (≥32 chars)  
- Patient JWT: separate secrets recommended (`PATIENT_JWT_*`)  
- Access TTL default `15m`; refresh `7d` (staff) / `30d` (patient)  
- Logout revokes refresh hash in Mongo  
- Token cleanup job purges expired/old revoked tokens every 6h  

## Cookies

```
COOKIE_SECURE=true          # required behind HTTPS
COOKIE_SAME_SITE=lax        # or strict; none requires Secure
```

Tokens may also be returned in JSON for SPA bearer storage — prefer one transport in future hardening.

## HTTP hardening

Helmet, CSP, CORS allowlist, compression, HPP, mongo-sanitize, XSS string sanitize, rate limits (global + auth).

## Authorization

- `requirePermission(...keys)` — ANY match  
- Owner role short-circuits as `*`  
- Module wildcards (`billing.*`) supported  

## Files

- Multer: 10MB, MIME allowlist  
- **Do not expose PHI uploads publicly** — replace public `/uploads` with auth-gated downloads before go-live  

## Production flags

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` |
| `ENABLE_SWAGGER` | `false` (default when unset in prod) |
| `CORS_ORIGINS` | Exact clinic origins |

## Incident response (minimal)

1. Rotate JWT secrets → force re-login  
2. Revoke refresh tokens for affected users  
3. Inspect `AuditLog` + security log channel  
4. Restore from backup if data integrity compromised  
