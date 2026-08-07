# Security Audit — RC1

**Score: 6.5 / 10**

---

## Control matrix

| Control | Status | Notes |
|---|---|---|
| JWT access/refresh | Pass | Separate secrets, typed claims |
| Refresh rotation | Partial | Rotate + revoke; **no reuse detection** |
| Cookie secure/sameSite | Partial | Configurable; warn if insecure in prod; clearCookie now matches flags |
| Helmet + CSP | Pass | Wired; style `unsafe-inline` for UI |
| Rate limits | Pass | Global + auth-specific |
| RBAC + Owner bypass | Pass | Owner `*`; wildcards resolved |
| File upload | Fail | MIME allowlist only; **`/uploads` public static** |
| Mongo injection | Pass | `express-mongo-sanitize` + HPP |
| XSS | Partial | Regex sanitize + Zod; not a full HTML sanitizer |
| CSRF | Fail | No CSRF tokens; cookie+credentials SPA |
| Secrets / env | Partial | Zod fail-fast; patient JWT may derive from staff |
| Sensitive logs | Partial | PHI guidance; no auto-redaction |
| Audit logging | Pass | Mongo audit + action enum |

---

## Critical findings

1. **Public `/uploads`** — unauthenticated static serve for local storage.  
2. **No CSRF strategy** if cookies carry session.  
3. **Upload validation** is MIME-only (no magic bytes).  
4. **Refresh reuse** not detected (stolen refresh can rotate until expiry if race).  
5. **`currentUser` middleware** unused — deactivated users valid until access JWT expires (~15m).

## RC1 mitigations applied

- Production: `ENABLE_SWAGGER` defaults **off** when unset  
- Production warning if `COOKIE_SECURE=false`  
- Cookie clear uses same `secure` / `sameSite`  
- Patient login failed-audit bug (`identity` undefined) **fixed**

## Checklist before internet exposure

- [ ] `COOKIE_SECURE=true` + HTTPS  
- [ ] `ENABLE_SWAGGER=false`  
- [ ] Separate patient JWT secrets  
- [ ] Auth-gate or signed URL for uploads  
- [ ] Rotate seed passwords  
- [ ] Decide: bearer-only SPA (lower CSRF risk) vs cookie session + CSRF token  

See also: `docs/security-checklist.md`, `docs/SECURITY_GUIDE.md`.
