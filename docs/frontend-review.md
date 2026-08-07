# Frontend Review — RC1

**Score: 6.0 / 10** (up from 5.5 after lazy-loading)

---

## Strengths

- Clear module folders (`modules/*`, `pages/*`)
- Route-level `PermissionGuard` for most staff areas
- TanStack Query + shared `QUERY_KEYS`
- Zod + RHF on early modules (auth, staff, doctor, patient, branch)
- Patient portal isolated auth context

## Gaps

| Area | Detail |
|---|---|
| Forms / Zod | Portal, reception dialogs, CRM, many clinical writes still raw state |
| Error UX | Many pages lack `isError` / retry — use `QueryState` |
| Accessibility | Minimal ARIA / labels on icon buttons & charts |
| Bundle | Was fully eager — **fixed** via `lazyPages.js` + Vite `manualChunks` |
| Route file size | `routes/index.jsx` still large (table of routes) |
| Dual nav | Analytics + Reports both chart icons |

## RC1 improvements applied

- `routes/lazyPages.js` — React.lazy for all pages  
- Suspense boundaries in App / Auth / Settings / Portal layouts  
- `QueryState` shared component  
- PermissionGuard loading message  
- Vite manual chunks: vendor, query, forms, charts  
- RQ Devtools moved to `devDependencies`

## Recommendations

1. Adopt `QueryState` on list pages missing error handling  
2. Zod on portal login/profile and money/clinical writes  
3. Guard dashboard with `DASHBOARD_VIEW` (or document auth-only)  
4. a11y pass: `aria-label` on icon buttons, chart text alternatives  
5. Split route table by domain files  
