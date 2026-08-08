# Aurah 360 ClinicOS — Project Status

_Last updated: 2026-08-08_

## Where things stand

The clinical spine is built and hardened. This round closed a set of defects in patient safety,
money handling and data access, and swept out configuration that looked like it worked but enforced
nothing. Test coverage went from **15 files / 99 tests** to **29 files / 427 tests**.

Every fix below was mutation-checked: the bug was reintroduced, the test confirmed to fail, then
reverted. A test that passes against the broken code proves nothing, and two of them in this round
initially did — both were caught and rewritten.

---

## What was fixed

### Patient safety

| Defect | Consequence before the fix |
|---|---|
| Consent gate could not tell an **absent** consent record from an unsigned one | A plan with no consent captured at all skipped the gate entirely; only the less dangerous case was caught |
| Protocol contraindication screening and age limits were never evaluated | A configured "not for under-18s" blocked nothing, and staff had been told it would |
| Package `validityDays` never checked | A 90-day package stayed redeemable forever |
| Device maintenance dates, room cleaning buffers, skill supervision never read | Overdue lasers stayed bookable; back-to-back procedures got zero turnover |
| Treatment-session photo upload bypassed the consent and body-area policy | The consultation path enforced it, the treatment path did not |

Design notes worth keeping: a **missing date of birth blocks** (overridable) — skipping would make an
age restriction unenforceable for exactly the unverified records. Package validity anchors on **plan
acceptance**, because anchoring on first session would make an unused package immortal. Every gate
stays overridable with an audited reason, so a data-entry gap cannot become a clinical outage.

### Money

- **Per-line GST.** A 5% medicine and an 18% service on one invoice were both taxed at a blended
  18% — ₹130 over-charged on a two-line bill, and GST returns could not reconcile. All arithmetic is
  now integer paise, header discount allocated by largest remainder, and `invoice.tax` is the sum of
  line tax by construction. Clients can no longer supply their own tax rate.
- **Loyalty redemption double-spend** closed with a transaction, a conditional balance decrement and
  an idempotency key.
- **Points accrue on `InvoicePaid`**, not `InvoiceFinalized` — a finalized-but-unpaid invoice no
  longer grants points.

### Access and privacy

- **The reporting stack failed open.** Filters applied only when supplied, so *omitting* `branchId`
  returned organisation-wide revenue, dues, patient volumes and PHI sample rows. Scope is now forced
  at the controller boundary, not inside the shared filter helper — that helper has 13 call sites,
  and a fix each caller must opt into is one the fourteenth will forget.
- **Branch scoping applied** across inventory, resources, scheduling, CRM, staff, adverse events,
  billing ops, loyalty, AI runs and file access. Out-of-scope records answer **404, not 403** — a 403
  confirms the record exists, which is the fact the scope protects.
- **Staff file access was permission-only**: any `patients.view` holder could fetch any document or
  clinical photo in the organisation. Download is now a separate grant from view.
- **Loyalty balances are deliberately NOT branch-scoped.** Points follow the patient; pinning the
  ledger to a branch would show a partial balance and let a cashier redeem points the patient does
  not have. The check moved to the patient instead.

### Reliability

- **Four BullMQ workers were competing in pairs on two queues.** BullMQ gives a job to exactly one
  consumer, so the loser returned `{ignored: true}` and the job was marked *completed* having done
  nothing. Roughly half of all expiry, birthday and follow-up runs vanished with no error anywhere —
  points silently never expired. Now one worker per queue; an unclaimed job warns instead of
  reporting success.
- **Signing a consultation now completes its appointment.** It previously stayed `CHECKED_IN`
  forever, so the doctor's "start from appointment" list never emptied — and reopening the EMR
  **forked a duplicate clinical record** for one visit, splitting vitals, diagnosis and photos
  across two records.
- **Raw ObjectIds removed from the UI**, resolved to names / MRN at the source.

### Configuration that enforced nothing

Around 20 settings were modelled, validated, persisted and shown in admin UI while **no code path
read them**. This is worse than a missing feature: a missing feature is visible, a dead knob is not,
and staff configure it and trust it. Each is now either enforced with a test or deleted outright.

Full outcome table in [Aurah360_PRD_Gap_Audit.md](./Aurah360_PRD_Gap_Audit.md).

---

## Open items — decisions for the team

These are deliberately **not** done, because they are judgement calls rather than engineering ones.

1. **Retention** (`config.retention.documentDays` / `photoDays`) — the last dead setting. Enforcing
   it means a job that permanently deletes patient documents and clinical photos; deleting the
   setting erases a compliance requirement. Needs a decision on retention periods and whether legal
   hold comes first.
2. **`guardianVerified` rollout** — the flag defaults to `false` and nothing ever set it, so on
   deploy **every existing guardian loses access to every dependent's records** until staff verify
   each link. That is correct privacy behaviour, but it is a hard, user-visible cutover. Either
   backfill the links you accept as pre-verified, or brief reception first. No backfill script was
   written: which links are trustworthy is a clinical/legal judgement.
3. **Rotate credentials** — the Anthropic API key and the Atlas password were both transmitted in
   plaintext during development.
4. **Restore `MFA_REQUIRED_ROLES`** in `backend/.env` (default `OWNER,ADMIN,BRANCH_MANAGER`). It is
   currently emptied for local development, so no role is challenged.
5. **AI returns mock output** until the Anthropic account has credit. The key and wiring are correct
   and verified — the API answers `credit balance is too low`.

---

## Known gaps not yet addressed

Ranked, with the full detail in [Aurah360_PRD_Gap_Audit.md](./Aurah360_PRD_Gap_Audit.md):

- `recordPayment` has no idempotency key and no transaction — a retried or double-clicked payment
  can be taken twice.
- A finalized invoice can never be voided, cancelled or credited, and there is no write-off path, so
  receivables can never be cleaned.
- Partial refunds overwrite `refundedAmount` and force status `REFUNDED`, stranding the remainder.
- Double-booking is not constrained at the database (the slot index is not unique).
- Clinical photos can never be released to a patient — no code path sets `patientVisibility`.
- Document `clinicalDate` / `source` are mandated server-side but never asked for in the UI, so
  every uploaded report is filed under today's date.
- Report date ranges use host timezone rather than IST, and BullMQ cron patterns pass no `tz`.
- No audit-search endpoint exists, so audit evidence cannot be produced for an auditor.
- "Malware scanning" is a MIME/extension allowlist, not a scanner.
- No linting anywhere (`lint` is an `echo` stub) and `npm audit` is non-blocking in CI.

---

## Environment notes

- **Stack as built:** Node 20 + Express + MongoDB/Mongoose, React + Vite. (The PRD specified
  NestJS/Postgres/Prisma and Next.js/TypeScript; the implementation diverged.)
- **Atlas collection cap.** The shared cluster has a hard 500-collection ceiling and repeatedly
  wedged during this work — every suite then fails in `beforeAll` for that reason alone, which reads
  as a code failure and is not. `connectTestDb` now drops its own database on entry so suites
  self-heal, but leaked databases still need occasional manual clearing.
- **Test database names** are capped at 38 bytes including the `a360t_` prefix. Two concurrent runs
  of the *same* suite name are mutually destructive, since each drops the shared name on connect.
- **Redis is not running locally**, so BullMQ workers never fire in development.

## Verification

- Backend: `npx vitest run` — 29 files / 427 tests
- Frontend: `npm run build`, `npm run i18n:check` (0 missing keys)
- Smoke scripts: `smoke:loyalty-billing`, `smoke:loyalty-admin`, `smoke:discount-approval`,
  `smoke:file-access`
- After any index change: `npm run db:migrate`, then **read the index back** — the migration
  previously reported success while skipping every loyalty collection.
