# Changelog

All notable changes to **Aurah 360 ClinicOS** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc.1] — 2026-08-06

Release Candidate 1 for client UAT. Approved scope: Modules **1–19**, ADR-001 stack, single-clinic multi-branch. See `docs/RELEASE_NOTES_v1.0.0-rc.1.md` and `docs/pre-uat-validation.md`.

### Added

- **Module 1** — Auth, JWT access/refresh, RBAC, staff users, roles, audit foundation
- **Module 2** — Branches and master data configuration
- **Module 3** — Doctors, schedules, leave
- **Module 4** — Patients, documents, search
- **Module 5** — Scheduling (holidays, blocked slots, viewer)
- **Module 6** — Appointments (book, calendar, history)
- **Module 7** — Reception desk and live queue (Socket.io)
- **Module 8** — EMR / consultations (SOAP, vitals, templates)
- **Module 9** — Prescriptions, medicines, templates, print
- **Module 10** — Treatment plans, protocols, packages, consent, approve
- **Module 11** — Billing, invoices, partial/split payments, print
- **Module 12** — Treatment sessions with payment gate
- **Module 13** — Inventory, pharmacy dispense, purchase orders, ledger
- **Module 14** — CRM leads, pipeline, tasks, conversion, BullMQ reminders
- **Module 15** — Notifications framework (templates, queue, in-app, mock providers)
- **Module 16** — Role-based reports dashboards, CSV/Excel export, scheduled reports
- **Module 17** — Patient web portal (`/portal`, `/api/v1/patient`) with ownership isolation
- **Module 18** — Analytics dashboards, category reports, Redis cache, BullMQ heavy export
- **Module 19** — Production hardening: Helmet/CSP, HPP, sanitize, rate limits, health probes, Winston rotate logs, BullMQ DLQ, OpenAPI/Swagger, Docker/nginx/PM2, CI skeleton
- Ops documentation: deployment, backup/restore, security, permissions, events, queues, pre-UAT validation
- Smoke scripts: `smoke-module1`, `smoke-module10`–`19`, `smoke-regression`

### Changed

- Delivery stack vs original PRD recommendation: Express + MongoDB + Vite/React (ADR-001) instead of Nest/Postgres/Next
- Patient experience delivered as **web portal** (not Expo native app) for v1
- Module 16 `/reports` and Module 18 `/analytics` coexist intentionally (parallel surfaces)
- Frontend routes lazy-loaded with Suspense and Vite `manualChunks` (RC1 stabilization)

### Fixed

- Patient portal failed-login audit (`identity` undefined) — RC1
- Cookie clear flags aligned with `COOKIE_SECURE` / `COOKIE_SAME_SITE` — RC1
- Production Swagger default **off** when `ENABLE_SWAGGER` unset — RC1
- Shared Zod helpers in `validators/common.js` — RC1

### Security

- Helmet + CSP, CORS allowlist, compression, trust proxy
- Body size limits, HPP, `express-mongo-sanitize`, XSS string sanitize middleware
- Global + stricter auth rate limiting
- Short-lived access JWT + refresh rotation; patient portal JWT separation (optional dedicated secrets)
- RBAC `requirePermission` on staff APIs; portal ownership checks
- Audit logging for sensitive domain actions
- **Open residual:** public static `/uploads` (must auth-gate before PHI production); CSRF strategy if cookie sessions used; MFA deferred

### Known Issues

- Public `/uploads` static mount (PHI risk if files are sensitive)
- Notification channels are **mock** adapters (WhatsApp/SMS/email stubs)
- Analytics **AI** category is placeholder only
- PDF export uses placeholder adapter (CSV/Excel are real)
- Cash close not implemented; billing refund and patient merge are placeholders
- Backup/restore npm scripts are placeholders — use `mongodump` / ops runbooks
- Seed passwords (`ChangeMe@12345`, `Patient@12345`) must be rotated before any shared or production use
- Socket.io is single-instance friendly (no Redis adapter yet)
- Module 13 smoke may fail partial dispense when Rx remaining quantity is already `0` (seed/data state)

## [0.1.0] — 2026-08

### Added

- Initial monorepo scaffolding (`backend/`, `frontend/`, `docker/`, `docs/`)
- Development seed and local infra compose

---

[1.0.0-rc.1]: https://github.com/aurah360/clinicos/releases/tag/v1.0.0-rc.1
[0.1.0]: https://github.com/aurah360/clinicos/releases/tag/v0.1.0
