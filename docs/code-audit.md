# Code Audit — RC1

**Scope:** Full monorepo (`backend/`, `frontend/`)  
**Date:** 2026-08-06  
**Rule:** No new business modules; quality only

---

## Summary

| Area | Finding |
|---|---|
| Controllers | Mostly thin — compliant |
| Services → Repository | Core clinical OK; reports/analytics/portal bypass repos |
| Duplication | Sequence helpers ×10; Zod `objectId`/`emptyToNull` ×20 |
| Large files | `ReportService.js` ~1151 lines; route table ~850; plan builder ~620 |
| Dead code | Intentional placeholders (AI, PDF, cloud storage, backup) |
| Architecture score | **6.5 / 10** |

---

## Duplicated code

1. **Sequence number helpers** — nearly identical pad/prefix wrappers (`appointmentNumber`, `invoiceNumber`, …). Recommend `helpers/sequenceNumber.js`.
2. **Validator primitives** — `objectId`, `emptyToNull`, `timeRegex` copied widely. **Added** `backend/src/validators/common.js` (migrate gradually).
3. **KPI / filter UI** — analytics vs reports duplicate filter and KPI cards.
4. **Dual analytics stacks** — Module 16 `AnalyticsService` + Module 18 `AnalyticsFacadeService` (intentional product split).

## Dead / unused

| Item | Status |
|---|---|
| `uuid` package | **Removed** (unused; Node `crypto.randomUUID` available) |
| `nodemon` | **Removed** (`node --watch` used) |
| Cloud storage adapters | Placeholder (expected) |
| PDF export | Placeholder JSON |
| AI analytics / ConsultationAi | Placeholder |
| `FILES` BullMQ queue name | Registered, unused worker |

## Large components / services

| Lines | File |
|---:|---|
| ~1151 | `backend/src/services/ReportService.js` |
| ~683 | `InventoryService.js` |
| ~655 | `BillingService.js` |
| ~643 | `CrmService.js` |
| ~620 | `TreatmentPlanBuilderPage.jsx` |
| ~850 | `frontend/src/routes/index.jsx` |

## Naming inconsistencies

- Param schemas: `idParamSchema` vs `appointmentIdParamSchema`
- Controller fields: `this.service` vs `this.inventory` vs `this.portal`
- ObjectId regex: `/i` vs `[a-fA-F0-9]` variants
- Password policy: staff strong vs patient portal min-8

## Magic strings / numbers

- Default tax `18` in billing
- Status literals in portal/analytics instead of enums
- Hard export limits `2000` / `500` in reports

## Circular dependency risk

No hard cycles. Soft fan-out: `PatientPortalService` constructs many domain services; analytics → CRM/Inventory one-way.

## RC1 actions taken

- Shared `validators/common.js`
- Frontend route lazy-loading (`lazyPages.js` + Suspense)
- QueryState shared component
- Unused dependency removal

## Recommended next (post-RC1)

1. Split `ReportService` into query repos  
2. Migrate validators to `common.js`  
3. Collapse N+1 list populate loops  
4. Deduplicate sequence helpers  
