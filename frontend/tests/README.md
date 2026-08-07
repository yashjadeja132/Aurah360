# Frontend tests (RC1 skeletons)

No test runner is configured yet (`lint` is a stub). Recommended stack:

- Vitest + React Testing Library + jsdom
- Playwright for critical staff login / portal login E2E (later)

## Planned layout

```
tests/
  unit/           # permission utils, formatters
  components/     # PermissionGuard, QueryState, EmptyState
  pages/          # form validation smoke
```
