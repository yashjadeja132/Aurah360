# Backend tests

Vitest is wired and running real tests against this codebase — not skeletons.

```bash
npm test          # run once (unit + integration + workflow)
npm run test:watch
```

## Layout

```
tests/
  unit/           # pure-function tests — no DB (permission helper, TOTP, PII redactor, schedule engine)
  integration/    # real MongoDB (see setup.js) — auth API via supertest, appointment idempotency,
                   # consent withdrawal history, patient merge
  permissions/    # RBAC matrix probes against the real ROLE_PERMISSIONS map
  workflows/      # multi-step, real-DB workflows (billing → refund → credit note)
```

## Integration/workflow tests need a local MongoDB

`tests/integration/setup.js` connects to `<MONGODB_URI-base>_test_<suite>` — a uniquely-named
database per test file on the same MongoDB instance as local dev, never the dev/prod database
itself. Each suite drops its own database in `afterAll`. If no local MongoDB is reachable, only
the DB-free `unit/` tests will pass; CI starts real `mongo:7`/`redis:7-alpine` service containers
(see `.github/workflows/ci.yml`).

## What's still a smoke script, not a Vitest test

`src/scripts/smoke-module*.js` and `smoke-regression.js` remain the broader end-to-end checks —
they exercise the full running API + seeded DB across every module and are still the right tool
for a pre-release regression pass. Vitest covers the units/flows most likely to regress silently
(concurrency, de-identification, RBAC, merge/consent correctness) with fast, isolated tests.
