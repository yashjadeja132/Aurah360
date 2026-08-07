# Restore Guide

## Current state

`npm run db:restore` runs `src/scripts/db/restore.js`, which shells out to the **real**
`mongorestore` binary. It refuses to run without an explicit `--confirm` flag and an existing
backup directory, so a bare/accidental invocation can never restore over production.

## Procedure

1. **Stop writers** — pause API / scale to zero to avoid mid-restore writes.  
2. **Confirm backup** — verify dump folder integrity.  
3. **Restore:**

```bash
npm run db:restore -- ./backups/2026-08-06T10-00-00-000Z --confirm
npm run db:restore -- ./backups/2026-08-06T10-00-00-000Z --confirm --drop   # replaces collections
```

`--drop` replaces collections — use only when intentional.

4. **Restore uploads** from filesystem/object backup into `STORAGE_LOCAL_PATH`.  
5. **Start API**, run `npm run db:migrate` (sync indexes).  
6. **Verify** with `smoke:regression` against a staging URL first.

## Warnings

- Never restore production dumps onto shared/dev DBs with real PHI without controls.  
- Refresh tokens may invalidate after restore time-skew — users re-login.  
- Redis can be flushed; queues rebuild.  
