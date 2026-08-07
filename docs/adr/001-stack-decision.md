# ADR-001: Stack for Aurah 360 ClinicOS

## Status

Accepted (project kickoff)

## Context

PRD §15 recommends Next.js, NestJS, PostgreSQL, and TypeScript. The delivery team selected a different stack optimized for this single-clinic build and existing team skills.

## Decision

- Frontend: React + Vite + JavaScript + React Router v7 + Tailwind + shadcn/ui
- Backend: Express + MongoDB/Mongoose + JavaScript (class-based, layered)
- Cache/jobs: Redis + BullMQ
- Realtime: Socket.io (bootstrap only)

## Consequences

- Faster iteration for a custom clinic product without Nest/Prisma ceremony
- MongoDB document model fits progressive patient/timeline records; transactions used where needed
- No TypeScript shared contracts yet — OpenAPI/SDK can be added later if required
- PRD functional requirements remain authoritative; only the implementation stack differs
