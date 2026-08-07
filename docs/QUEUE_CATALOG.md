# Queue Catalog (BullMQ)

Connection: Redis via `backend/src/queues/connection.js`.  
Defaults: 3 attempts, exponential backoff 2s, retain completed/failed with age limits.  
Final failures → **dead-letter** queue (`dead-letter`) via `queues/dlq.js`.

| Queue | Name | Jobs | Worker |
|---|---|---|---|
| Notifications | `notifications` | `notification-dispatch`, `notification-retry`, `daily-birthday-scan` | `notificationJobs.js` |
| Reports | `reports` | `report-generate`, daily/weekly/monthly scheduled sweeps | `reportJobs.js` |
| Analytics | `analytics` | `analytics-heavy-export`, daily/weekly/monthly digests | `analyticsJobs.js` |
| CRM | `crm` | `follow-up-reminder`, `daily-follow-up-scan` | `crmJobs.js` |
| Files | `files` | *(reserved — unused)* | — |
| Dead letter | `dead-letter` | `failed-job` envelopes | inspect manually |

## Maintenance (non-BullMQ)

| Job | Interval | Module |
|---|---|---|
| Token cleanup | 6 hours | `jobs/tokenCleanup.job.js` |

## Ops tips

- Monitor `failed` counts via `/health` BullMQ section  
- Inspect DLQ before replaying  
- Do not flush Redis in production without understanding delayed jobs  
