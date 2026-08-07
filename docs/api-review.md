# API Review — RC1

**Base:** `/api/v1`  
**Envelope:** `ApiResponse` / `ApiError`  
**Docs:** `/api/v1/docs` (OpenAPI 3) · `/api/v1/openapi.json`

---

## Strengths

- Consistent `{ success, message, data, code?, errors? }` envelope
- Zod validation middleware on most write routes
- `authenticate` + `requirePermission` on staff modules
- Separate patient portal JWT under `/patient`
- Health probes: `/health`, `/livez`, `/readyz`, `/healthz`
- Versioned prefix (`/api/v1`)

## Gaps

| Topic | Detail |
|---|---|
| Swagger coverage | Partial — key auth/health/analytics paths only |
| Status codes | Mostly correct; some 422 vs 400 inconsistency on validation |
| Dual report APIs | `/reports/*` (M16) and `/analytics/*` (M18) — both intentional |
| List query params | Not all list routes share `paginationQuerySchema` |
| Error codes | Good enum usage, but not every path sets a stable `code` |

## HTTP method patterns

| Pattern | Usage |
|---|---|
| GET list/detail | Dominant for reads |
| POST create / actions | Book, check-in, payments, queue actions |
| PATCH update | Profile, masters, leads |
| DELETE soft | Where supported |

## Response format

Success:

```json
{ "success": true, "message": "Success", "data": {} }
```

Error:

```json
{ "success": false, "message": "…", "code": "VALIDATION_ERROR", "errors": [] }
```

## Recommendations

1. Expand OpenAPI path coverage module-by-module  
2. Standardize list query via `validators/common.js` pagination schema  
3. Keep M16/M18 dual APIs documented as legacy vs executive analytics  
4. Disable Swagger in production (default when unset)  
