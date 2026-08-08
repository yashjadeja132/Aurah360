# Aurah 360 ClinicOS — PRD Gap Audit

Audit of the implemented web application against `aurah_prd.md` and `aurah_loyalty_points_prd.md`.
Five independent read-only passes: patients/appointments/queue, consultation/EMR/AI/treatment,
billing/inventory/pharmacy, loyalty, and security/analytics/NFR.

**Method.** Every requirement was traced route → controller → service → model. A route existing was
not accepted as evidence the requirement is met. Where `docs/flow` disagreed with the code, the code
was treated as truth. Mobile-app requirements are out of scope (web first, per instruction).

**Scale.** This is a large gap list. That is not a sign the build is bad — the core clinical spine
(consultation, sign/lock/amend, consent, hard-stops, audit write coverage, AI governance) is
genuinely well built. The gaps cluster in a few repeating shapes, described next.

---

## The four patterns behind most findings

Fixing the pattern is worth more than fixing any single instance.

### 1. Configuration that enforces nothing — ✅ SWEPT

The single most common defect, in every module. A setting is modelled, validated, persisted,
returned by `toSafeObject`, and rendered in an admin form — and **no code path ever reads it**.

This is worse than a missing feature. A missing feature is visible; a dead knob is *invisible*, and
staff will configure it and trust it. A clinic that sets "not for under-18s" and gets no block has
been told a safety control exists when it does not.

**Status: swept.** Every setting below now either has an enforcement site with a mutation-checked
test, or has been deleted. Suite went 19 files/166 tests → **25 files/306 tests**, all passing.

| Setting | Location | Outcome |
|---|---|---|
| `contraindicationQuestions`, `ageRestrictionMin/Max` | TreatmentProtocol | **Enforced** — pre-flight gates; missing DOB blocks (overridable) |
| `validityDays` | TreatmentPackage | **Enforced** — anchored on plan acceptance, so an unused package can't be immortal |
| `nextMaintenanceDueAt` | Device | **Enforced** — judged at time of use, not booking time |
| `cleaningBufferMinutes` | Room | **Enforced** — distinct `ROOM_CLEANING_BUFFER` code so turnover ≠ double-booking |
| `capacity` | Room | **Enforced** — capacity 1 reproduces old behaviour exactly (purely additive) |
| `requiresSupervision`, `supervisorId` | StaffSkill | **Enforced** — at use *and* at configuration time |
| `durationMinutes` | Service master | **Enforced** — `validateSlot` relaxed to contiguous runs first, or 30-min services would have become unbookable |
| `maximumAppointments` | DoctorSchedule | **Enforced** — 0 = unlimited |
| `branchOverridableFields` | Organization | **Enforced** — branch *identity* fields stay always-editable |
| `invoicePrefix` | Organization | **Enforced** — per-prefix sequence; `INV` keeps its original key so history is untouched |
| `financialYearStartMonth` | Organization | **Enforced** — `period=FY` inherited by every analytics service |
| `invoiceFooterNote` | Organization | **Enforced** — on invoice print and payment receipt |
| `timezone` | Organization | **Enforced** — org > env > `Asia/Kolkata`; `clinicTimezone()` kept synchronous so existing `dayBucket()` aggregations were untouched |
| `supportedLanguages`, `defaultLanguage` | Organization | **Deleted** — no backend i18n pipeline; enforcing would have meant inventing a feature |
| `gstPercent`, `hsnCode`, `taxPercent` | InventoryItem / FeeSchedule | **Enforced** — per-line GST in integer paise; see below |
| `minimumStock` | InventoryItem | **Enforced** — new CRITICAL severity distinct from reorder level |
| `maximumStock` | InventoryItem | **Enforced** — ceiling at `#applyMovement`, the single choke point |
| `reservedStock` | InventoryItem | **Not actually dead** — `availableStock` reads it; the missing piece is a reservation *writer* (unbuilt feature, not dead config) |
| `guardianVerified` | Patient | **Enforced** — portal gate; ⚠️ see rollout note |
| `firstTouchSourceCategory` | Patient | **Enforced** — written once, immutable after |
| `audienceSegment` | LoyaltyCampaign | **Enforced** — fails closed (over-crediting points is unrecoverable) |
| `promptVersion` | AiRun | **Enforced** — content hash, not a hand-maintained label nobody bumps |
| `estimatedCostUsd` | AiRun | **Enforced** — recorded on the degraded path too; tokens are spent either way |
| `AI_MONTHLY_BUDGET_USD` | config.ai | **Enforced** — budget ≤ 0 means unlimited, so a blank env var can't silently disable clinical AI |
| `version`, `supersedesDocumentId` | PatientDocument | **Enforced** — supersede-on-reupload; original left untouched |
| `pairedPhotoId` | ClinicalPhoto | **Enforced** — and made symmetric; it was a one-directional half-link |
| `isAnnotatedDerivative`, `originalPhotoId` | ClinicalPhoto | **Deleted** — annotation was never built |
| `documentDays`, `photoDays` | config.retention | **DEFERRED — needs a decision.** Enforcing means permanently deleting clinical records; deleting the config erases a compliance requirement. Neither should happen without sign-off on retention periods and legal hold. |

**The per-line GST fix, concretely.** A 2 × ₹500 medicine at 5% plus a ₹1000 laser session at 18%:

| | Old (blended 18%) | New (per-line) |
|---|---|---|
| Tax | ₹360.00 | ₹50.00 + ₹180.00 = **₹230.00** |
| Total | ₹2360.00 | **₹2230.00** |

₹130 over-charged on a single two-line invoice, with both lines falsely reported at ₹180 each. All
arithmetic is now integer paise with largest-remainder discount allocation, and `invoice.tax` is
`Σ line.tax` by construction. Client-supplied `tax`/`taxPercent`/`total` are no longer accepted —
a caller could previously name its own GST rate.

**Policy going forward:** every setting must either have an enforcement site with a test, or be
deleted from the model and the UI. No third option.

⚠️ **`guardianVerified` rollout.** The flag defaults to `false` and nothing has ever set it, so on
deploy **every existing guardian loses access to every dependent's records** until staff verify each
link. That is correct privacy behaviour — those links were never actually verified — but it is a
hard, user-visible cutover. Either backfill the links you accept as pre-verified (knowingly
grandfathering unverified access), or accept the lockout and brief reception first. No backfill
script was written: which links are trustworthy is a clinical/legal judgement. The dev database has
0 affected records and the seed scripts already set the flag, so local testing is unaffected.

### 2. Row-level scoping is half-applied

`scope.helper.js` is correct and well-designed but imported by only 9 of 36 controllers. Roughly 30
list endpoints pass raw `req.query` straight to the repository: inventory, CRM, recall, notifications,
adverse events, cash closes, fee schedules, scheduling, resources, doctors, AI runs, loyalty.

The reporting stack is worse — it **fails open**. `reportFilters.helper.js` applies a branch match
only *if* `branchId` was supplied and never receives `req.auth`, so *omitting* the parameter returns
organisation-wide data, and supplying another branch's id is honoured.

### 3. Read-modify-write on money and stock, with no transaction

Atlas is a replica set, so transactions are available. Exactly one exists (loyalty redemption, added
during this work). The same check-then-write shape remains in:

- `recordPayment` — no idempotency key, no transaction; two cashiers or one double-click both pass
  the overpay check and the invoice's `paidAmount` reflects only the last writer.
- `#applyMovement` (inventory) — `newStock = item.currentStock + delta` against a stale read; the
  negative-stock guard and the recorded `balanceAfter` are both evaluated against that stale value.
- `postGrn` — "already posted" check with the whole receive loop before the status write.
- Appointment booking — conflict check then unguarded insert, and the
  `{doctorId, appointmentDate, startTime}` index is **not unique**, so double-booking is possible.
- `TreatmentSessionService.complete()` — status write, then best-effort package decrement and stock
  consumption whose errors are swallowed into a log line.

### 4. Controls that exist but are wired to almost nothing

- `requireStepUp()` is implemented and guards **one** route (break-glass). §16.6 also names bulk
  export, role/permission change, refund and clinical-photo download.
- CSRF double-submit is implemented but exempts Bearer requests — and the SPA uses Bearer tokens
  from `localStorage`, so the control never runs while the tokens it protected are XSS-reachable.
- `AuditService` write coverage is broad and genuine, but **no audit search endpoint exists**, so the
  evidence cannot be produced for an auditor or an incident.

---

## P0 — patient safety and data integrity

| # | Gap | Consequence |
|---|---|---|
| 1 | Protocol eligibility (`contraindicationQuestions`, age limits) has no evaluation site | A configured contraindication or age restriction blocks nothing; staff believe it does |
| 2 | Treatment close is not atomic; never reaches timeline or billing | Partial failure leaves a completed treatment with un-consumed package session and undeducted stock, silently |
| 3 | No guided per-step checklist; skip carries no reason | Baseline photo / prep / product check can be skipped invisibly with no justification recorded |
| 4 | Clinical photos can never be released to a patient; view and download share one permission | The doctor-controlled release the PRD requires does not exist |
| 5 | Document `clinicalDate` / `source` mandated server-side, never asked for in the UI | Every external report is filed under today's date — the clinical timeline is chronologically wrong |
| 6 | AI: `/ai/run` takes raw client `context`; copilot `refine` loads any run by id unscoped | A cross-patient read path exists in the AI surface |
| 7 | AI-008 (prove patient isolation) has no test | The PRD's one P0 AI requirement is unverified |
| 8 | No nurse intake; templates unversioned/unapproved; no copy-forward | The §8.1 pre-consult step is absent end to end |

## P1 — money and privacy

| # | Gap | Consequence |
|---|---|---|
| 9 | `recordPayment`: no idempotency, no transaction | Money collected twice or lost; invoice balance silently wrong |
| 10 | A finalized invoice can never be voided/cancelled/credited; no write-off path | Permanently overstated receivables; dues list can never be cleaned |
| 11 | Partial refund overwrites `refundedAmount` and forces status REFUNDED | After a ₹100 refund on ₹1000, the remaining ₹900 can never be refunded |
| 12 | Per-line GST ignored; one branch-level rate applied to the whole invoice | A 5% medicine and an 18% service are taxed identically — GST returns will not reconcile |
| 13 | ~30 list endpoints unscoped; reporting stack fails open | Any branch-scoped user reads every branch's stock, leads, adverse events, cash closes, PHI samples |
| 14 | Tokens in `localStorage`; CSRF inert for the SPA | One XSS yields a full 7-day refresh token |
| 15 | Step-up wired to one route only | Highest-consequence actions need no re-proof of identity |
| 16 | Staff file access is permission-only — no branch, no patient relationship | Any `patients.view` holder can fetch any document or photo in the org |
| 17 | Retention/erasure/de-identification do not exist; privacy requests are paperwork | DPDP erasure and portability obligations cannot be met |
| 18 | Cash close reconciles nothing — `expectedCash` is fully self-reported | The day-close control detects zero theft or error |
| 19 | Package `validityDays` never enforced | A 90-day package is redeemable forever — unbounded revenue leakage |
| 20 | FEFO falls back to bare `currentStock` when batches can't cover | Batch traceability breaks exactly in the recall scenario it exists for |
| 21 | "Malware scanning" is a MIME/extension allowlist; no `Content-Disposition` on served files | Stored-XSS-via-upload path that would harvest the tokens in #14 |

## P2 — correctness and completeness

| # | Gap |
|---|---|
| 22 | Double-booking possible under concurrency (no unique slot index, no transaction) |
| 23 | Roster changes (leave/blocks) ignore existing confirmed bookings — no warning, no reassign |
| 24 | No booking horizon / lead time / same-day cutoff / daily capacity / overbook control |
| 25 | Calendar is one doctor, day/week only — no filters, colors, resource view, drag-drop |
| 26 | Report date ranges use host timezone, not IST; BullMQ crons pass no `tz` |
| 27 | No-show captures no reason; waitlist never auto-fills a released slot |
| 28 | Queue lacks Temporarily Away / No Response / Left / No-show states |
| 29 | Session consumables deduct 1 per name regardless of configured quantity; reversal doesn't restore stock |
| 30 | Split payments collapse to a single `SPLIT` bucket in revenue-by-mode reporting |
| 31 | Tabular reports cap at 2000 rows with no truncation indicator; CSV has no formula-injection guard and coerces MRNs to numbers |
| 32 | No audit search endpoint; no retention/security/AI-governance reports |
| 33 | Scheduled reports mark themselves COMPLETED and never deliver; no download endpoint or expiry |
| 34 | Document `rename()` is unaudited and unversioned |
| 35 | No linting anywhere (`lint` is an `echo` stub); `npm audit` is non-blocking in CI |
| 36 | No treatment events on the patient timeline at all |

## Loyalty module (LOY)

Verified: the recent rework holds. Redemption is transactional with a conditional balance decrement
and idempotency key; accrual moved to `InvoicePaid`; all five previously-dead settings now enforce.
Append-only ledger integrity and audit trail are complete — there is no edit or delete path to a
ledger entry anywhere.

Remaining:

| # | Gap | Consequence |
|---|---|---|
| L1 | **Referral points (E5 / LOY-011 / Flow C) do not exist** — no emitter, no linkage, no anti-abuse | An approved earning event and its entire fraud-control row are unimplemented |
| L2 | Tier state is never computed — `PatientTierState` has readers but no writer | Tiers, multipliers and progress bars are inert; LOY-012 is a UI shell |
| L3 | Redemption requires a replica set; `.env.example` ships a standalone URI | On a standalone deployment every redemption throws at billing |
| L4 | Redeemed points not restored on invoice void/refund | A patient whose refunded invoice consumed 1,000 points loses them |
| L5 | Pending clawback produces no alert and no persisted flag | A refund that couldn't fully claw back points is written off silently |
| L6 | No loyalty notifications for earned/redeemed/expired | Patients get no confirmation |
| L7 | Accrual runs on in-process `eventBus` with no outbox | A restart between `InvoicePaid` and the credit loses those points permanently |
| L8 | No identity confirmation (OTP/in-person) before redemption | Flow B's anti-fraud step is missing |
| L9 | Settings with no UI: role adjustment limits, excluded categories, reminder days, branch overrides | Enforced controls an owner cannot configure without calling the API |
| L10 | `updateSettings` drops `null`/`''` | Threshold, flat cap and "never expire" can be set but never cleared |

---

## What is genuinely solid

Worth stating plainly, because the list above is long:

- **Consultation sign / lock / amend** — append-only addenda, mandatory reason and author, no silent
  overwrite. Clean.
- **Consent model** — 10 purposes, append-only grant log, withdrawal as a new row. The model layer is
  excellent (though only 3 of 10 purposes are enforced at point of use).
- **Clinical photo consent** — enforced from the grant log at both capture paths and again at
  serve time, correctly ignoring the client-supplied flag. Token-based body-region matching, not
  naive substring.
- **Treatment hard-stop engine** — one `#evaluateHardStopGates` shared by preflight and `start()`,
  so the checklist a technician sees cannot drift from what actually blocks.
- **Break-glass** — reason, step-up, short expiry, distinct audit action, owner alert. The
  best-implemented control in the codebase.
- **AI governance** — de-identification with a field-removal diff, per-use-case kill switch, run
  provenance, human-review gate, no image bytes ever leaving the system.
- **Loyalty ledger integrity** — append-only with no mutation path, full audit trail.
- **Patient merge and import** — two-phase dry-run/commit, per-row errors, provenance stamped,
  duplicates reported not auto-merged, soft-delete not destroy.
- **RBAC matrix test and 39 smoke scripts** — a genuinely strong negative-test layer.

---

## Suggested order of work

1. **Sweep the dead settings** (pattern 1). Each is either enforced with a test or deleted. This is
   the highest safety-per-hour work in the list and removes a whole class of false assurance.
2. **Finish the scoping sweep** (pattern 2) — apply `scope.helper.js` to the remaining controllers
   and make `reportFilters` take `req.auth` and fail *closed*.
3. **Transactions on money and stock** (pattern 3) — payment, stock movement, GRN, treatment close.
4. **P0 clinical items** — protocol eligibility, photo release, document clinical date, AI scoping
   and the AI-008 isolation test.
5. **Session/CSRF posture** (#14) — move to HTTP-only cookies so the implemented CSRF control
   actually runs.
