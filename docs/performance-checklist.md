# Performance Checklist — Module 19

## HTTP

- [x] Response compression (`compression`)
- [x] Global rate limiting
- [x] Request ID correlation
- [x] Nginx static asset caching (prod compose)

## MongoDB

- [x] Mongoose indexes on domain models
- [x] `npm run db:migrate` / `db:indexes` utilities
- [x] Aggregation pipelines for analytics/reports
- [x] Prefer `.lean()` in list repositories (existing pattern)
- [ ] Review slow-query log in production
- [ ] Atlas/ops indexes for large collections

## Cache & jobs

- [x] Redis for sessions/cache/BullMQ
- [x] Dashboard Redis cache (Module 18)
- [x] BullMQ `removeOnComplete` / `removeOnFail` retention
- [x] Heavy report exports via queue

## API design

- [x] Pagination on list endpoints
- [x] Projections via repository patterns
- [ ] HTTP caching headers for public assets only
- [ ] CDN for static frontend (ops)

## Runtime

- [x] Health metrics: memory, CPU load, disk
- [x] PM2 `max_memory_restart`
- [ ] Horizontal scale API behind sticky/session-aware LB if Socket.io used
