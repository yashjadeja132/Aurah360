# Security Checklist — Module 19

## Transport & headers

- [x] Helmet security headers
- [x] Content Security Policy
- [x] CORS allowlist (`CORS_ORIGINS`)
- [x] Compression
- [x] Trust proxy configured
- [ ] TLS termination at nginx/load balancer (ops)

## Input protection

- [x] JSON / urlencoded body size limits (2mb)
- [x] HPP (parameter pollution)
- [x] Mongo injection sanitization
- [x] XSS string sanitization middleware
- [x] Zod validation on routes

## AuthN / AuthZ

- [x] Short-lived access JWT + refresh rotation
- [x] Logout / refresh revoke
- [x] Token cleanup job + Mongo TTL
- [x] Stricter rate limit on auth endpoints
- [x] RBAC permission middleware
- [x] Separate patient portal JWT secrets
- [ ] Forced password rotation policy (future)
- [ ] MFA for owner/admin (future)

## Secrets

- [x] Zod env validation at boot
- [ ] Rotate JWT secrets in production vault
- [ ] No secrets in git (use `.env` / CI secrets)

## Logging & audit

- [x] Rotating application / error logs
- [x] Security + worker + audit log channels
- [x] Audit actions in Mongo for sensitive ops
- [x] PHI-safe logging guidance

## Jobs & files

- [x] BullMQ retries + exponential backoff
- [x] Dead-letter queue on final failure
- [x] Local storage adapter; cloud placeholders
- [ ] Auth-gated private file serving (recommended)
- [ ] Malware scan on upload (future)

## Production flags

- [ ] `NODE_ENV=production`
- [ ] `COOKIE_SECURE=true`
- [ ] `ENABLE_SWAGGER=false`
- [ ] Seed passwords changed
