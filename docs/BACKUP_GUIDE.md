# Backup Guide

## Current state

`npm run db:backup` runs `src/scripts/db/backup.js`, which shells out to the **real**
`mongodump` binary (install the MongoDB Database Tools on the host/CI runner — it is not an
npm package). It writes a timestamped folder under `./backups`, prints the dump size, and
prunes folders older than `BACKUP_RETENTION_DAYS` (default 30).

```bash
npm run db:backup                    # ./backups/<timestamp>/
npm run db:backup -- ./custom-dir     # custom output root
BACKUP_RETENTION_DAYS=14 npm run db:backup
```

For managed cloud MongoDB, prefer the provider's automated snapshot feature over this script
and use this script only for supplemental/local dumps.

## What to back up

| Asset | Method |
|---|---|
| MongoDB | `mongodump` or cloud snapshot |
| Redis | Optional AOF/RDB (jobs/cache — rebuildable) |
| Uploads directory | Filesystem / object sync (`STORAGE_LOCAL_PATH`) |
| `.env` secrets | Vault / sealed secret store — **never** in git |

## Cadence

- Daily full dump (retain 14–30 days)
- Pre-deploy dump before migrations
- Test restore quarterly (see `RESTORE_GUIDE.md`)

## Redis

Not required for disaster recovery of clinical data. BullMQ jobs can be replayed/re-queued after Mongo restore.
