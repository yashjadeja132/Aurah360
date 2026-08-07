# Folder Structure

```
aurah360-clinicos/
├── backend/
│   ├── src/
│   │   ├── config/          # env, database, redis
│   │   ├── constants/       # roles, permissions
│   │   ├── controllers/
│   │   ├── docs/            # OpenAPI + Swagger mount
│   │   ├── enums/
│   │   ├── helpers/
│   │   ├── jobs/            # maintenance timers (token cleanup)
│   │   ├── libs/            # ApiError, logger, log channels
│   │   ├── middlewares/     # auth, validate, security, sanitize
│   │   ├── models/
│   │   ├── queues/          # BullMQ workers + DLQ
│   │   ├── repositories/
│   │   ├── routes/v1/
│   │   ├── scripts/         # seed, smoke, db utilities
│   │   ├── services/
│   │   ├── socket/
│   │   ├── storage/         # local + cloud placeholders
│   │   ├── validators/
│   │   ├── app.js
│   │   └── server.js
│   └── package.json
├── frontend/
│   └── src/
│       ├── modules/
│       ├── pages/
│       ├── routes/
│       └── …
├── docker/
│   ├── docker-compose.yml       # local Mongo/Redis
│   ├── docker-compose.prod.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── nginx.conf
├── docs/
│   ├── deployment.md
│   ├── security-checklist.md
│   ├── performance-checklist.md
│   ├── production-readiness-report.md
│   └── api-guide.md
├── .github/workflows/ci.yml
├── ecosystem.config.cjs
└── README.md
```
