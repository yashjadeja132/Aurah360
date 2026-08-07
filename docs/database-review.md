# Database Review — RC1

**Score: 7.0 / 10**

---

## Index strengths

- Unique business numbers (MRN, appointment, invoice, …)
- Refresh token `tokenHash` unique + **TTL** on `expiresAt`
- Partial unique soft-delete on Master / QueueEntry
- Text indexes on patients/doctors/leads where needed
- Soft-delete (`deletedAt`) on core clinical/billing entities

## Index gaps

| Area | Gap |
|---|---|
| Appointment compounds | Often omit `deletedAt` |
| AuditLog | No TTL / archival → unbounded growth |
| DoctorLeave, LeadTask, Dispense, GRN | `deletedAt` unindexed |
| DoctorSchedule | No soft-delete field |
| Notification | No `deletedAt` |

## Pagination

- Shared `PAGINATION` defaults (20 / max 100)
- `paginateModel` injects `deletedAt: null`
- Report/export hard caps (500–2000) — watch memory

## N+1 risks

List paths that `findById`/populate per row:

- AppointmentService (list, history, calendar)
- ConsultationService, TreatmentPlanService
- PrescriptionService, QueueService, BillingService
- TreatmentSessionService, PatientService

**Recommendation:** single populated query or `$lookup` aggregation.

## Aggregations

Analytics/reporting use parallel `$group` pipelines with `deletedAt: null` via `applyCommonMatch`. Ensure covering compounds for `(branchId, appointmentDate, deletedAt)` style filters under load.

## Utilities

```bash
npm run db:migrate    # syncIndexes
npm run db:indexes    # list core indexes
npm run db:backup     # placeholder → mongodump
npm run db:restore    # placeholder → mongorestore
```

## Soft-delete consistency

Core entities consistent. Exceptions by design: `StockTransaction` (ledger), refresh tokens (`revokedAt`), audit/sequence/permission catalogs.
