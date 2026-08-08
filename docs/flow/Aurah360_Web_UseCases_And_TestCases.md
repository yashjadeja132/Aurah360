# Aurah 360 ClinicOS — Real-World Use Cases, Web Flow and Test Cases

**Document status:** written against the code running on this machine on 07–08 August 2026 (backend on port 5000, Vite dev server on 5173). Every route, rule and error message below was read out of the source or produced by an actual API call against the seeded database. Section 7 lists exactly which examples came from live calls and which are illustrative.

---

## 1. How to read this

This document answers one question: *what does a person actually do, screen by screen, to get work done in Aurah 360 — and how few steps does it take?* It is organised the way a shift is organised. Section 2 shows what each of the six roles sees the moment they log in. Section 3 walks twelve real jobs end to end, counting the clicks. Section 4 is the part to read if the complaint was "I have to go to another page to see the details" — it maps which action on which page causes what to appear elsewhere, so you can see that the pages are already wired to each other. Section 5 is the test pack your QA person or developer runs to prove each flow, including the cases that are *supposed* to fail. Section 6 states plainly what is not working yet on this machine. Nothing here is aspirational: if a screen does not exist, it is in Section 6, not described as if it worked.

---

## 2. The six roles, and what each opens to

Login lands on `/`, which renders `RoleLanding` (`frontend/src/routes/RoleLanding.jsx`). That component reads the role on the token and renders the role's own landing page in place — no menu hunting, no redirect chain. The mapping is a frozen table in that one file:

| Role | Lands on | Page component |
|---|---|---|
| OWNER | `/owner` | `OwnerLandingPage` |
| DOCTOR | `/my-day` | `DoctorMyDayPage` |
| RECEPTIONIST | `/reception/desk` | `ReceptionDeskPage` |
| BRANCH_MANAGER | `/branch` | `BranchCommandPage` |
| CASHIER | `/billing/cash-desk` | `CashierDashboardPage` |
| TECHNICIAN | `/treatments/worklist` | `TechnicianWorklistPage` |

Any other role (ADMIN, NURSE, PHARMACIST, CRM_EXECUTIVE) falls through to the generic `DashboardPage`. All six routes above exist in `frontend/src/constants/routes.js` and are registered in `frontend/src/routes/index.jsx`.

The clinic in the seeded database is two branches — **Aurah 360 Surat Main** (code SURAT-01, shown as "Surat Main") and **Aurah 360 Vesu** (SURAT-02, "Vesu Clinic"). Both run 10:00–19:00, six days a week, lunch 13:00–14:00, 15-minute slots with a 5-minute buffer, 18% tax. Two doctors: **Dr. Ananya Shah** (DOC-001) and **Dr. Rahul Mehta** (DOC-002, Hair & Cosmetology, ₹700 consultation / ₹350 follow-up, 15-minute slots).

### 2.1 Owner — Aurah Owner (`owner@aurah360.local`) → `/owner`

*Persona: the owner opens the laptop at 9:40 am before leaving for Vesu and wants two answers — how did yesterday close, and is anything waiting on my signature.*

`/owner` is deliberately two blocks and nothing else. The top block is the **branch scorecard**: one row per branch plus an all-branches total, showing revenue, new patients and completed treatments for today against yesterday. The bottom block is **Approvals** — three counted queues, "Discount approvals", "Loyalty manual adjustments" and "Cash-close approvals", each with a button that jumps to the screen where the decision is made. When all three are empty it says "All clear". The owner does not approve from here; the count tells them whether to go look. One click on the header button opens `/reports`.

### 2.2 Doctor — Dr. Ananya Shah (`dr.shah@aurah360.local`) → `/my-day`

*Persona: Dr. Shah arrives at 9:55, wants her list for today and wants to know how many notes she left unsigned yesterday.*

The header greets her by name and carries one button, "Open EMR". Four counters follow: **Today's patients**, **Unsigned notes** (turns amber the moment it is non-zero), **Follow-ups today**, **Upcoming (30 days)**. Below that, two grouped lists — "Today" and "Coming up" — each row showing the start time, the patient's name and MRN, the service, and a status badge.

The important behaviour is what happens when she taps a row: the row expands in place and mounts the patient's context — history and treatment progress — **inside the same page**. She does not navigate to Patient 360 to see who this is. This is the single most direct answer to "don't make me go to another page for details".

Her list is scoped server-side. Logged in as `dr.shah`, `GET /appointments` returns 28 appointments, every one of them hers. There is no filter to un-set.

### 2.3 Receptionist → `/reception/desk`

*Persona: the front desk at 10:05 with three people standing at the counter, one of whom has no appointment.*

Header: "Front desk", with **Register patient**, **Book**, **Queue board** and **Walk-in** (the walk-in button stays disabled until a branch is picked, so you cannot create a token in the wrong clinic). Then a branch selector and one search box that accepts *name, MRN, mobile or appointment number* — one box, four kinds of input.

Five counters: **Appointments today** (with checked-in / done / no-show underneath), **Waiting now** (longest and average wait), **In consultation**, **Dues at the desk**, **Consent gaps**. Then a "Needs attention" panel, then the day sheet, then the live queue board (updated over a websocket, not by refreshing).

The day sheet is where the work happens. Each row shows time, patient, appointment number, doctor, status, a "Walk-in" marker and a "Late" badge, and carries an inline **Check in** button — which opens the check-in dialog on the same page — or **Undo check-in** if the desk got it wrong. Checking a patient in never leaves `/reception/desk`.

### 2.4 Branch manager → `/branch`

*Persona: the Surat Main manager at 2 pm, wanting to know if the queue is jammed, if any stock is about to run out, and what is sitting in their approval inbox.*

Branch selector at the top (defaults to the user's own branch), and four counters: **Revenue today** (with a percentage delta against the same day last week), **Waiting now** (turns red on a bottleneck, shows worst and average wait), **Stock alerts** (low / expiring / expired), and **Awaiting you** (discount approvals + cash closes + stock transfers, summed).

Below: an approvals inbox, a per-doctor queue load panel next to a stock alerts panel, today's collection broken out by payment mode, and — this is the point — the **full discount approval panel inline at the bottom of the same page**, with the real approve and reject buttons. "Awaiting you: 3" and the three decisions are on one screen. The counter at the top even smooth-scrolls down to the panel.

### 2.5 Cashier → `/billing/cash-desk`

*Persona: the cash desk at 6:30 pm, collecting the last dues before counting the drawer.*

Branch selector (including "All branches") and four tiles: **Collected today**, **Awaiting billing** (draft bills), **Outstanding dues** (red), and **Awaiting discount approval** — or, for a cashier without approve rights, **Refunded today** instead. Then today's collection by mode, then the list of draft bills, then a **"Collect now"** section which is the due-payments worklist pre-filtered to *patients checked in today* — the ones physically in the building — with the filter clearable in place. Each row has an inline Collect action. Below that, if the user holds `billing.discount_approve`, the discount approval panel appears inline.

### 2.6 Technician — Neha Shah (`tech1@`) / Rohit Mehta (`tech2@`) → `/treatments/worklist`

*Persona: the laser technician at 11 am, wanting to know which of her sessions she is actually allowed to start.*

Three tiles: **Startable**, **Checked in / waiting**, **Scheduled**. The list merges scheduled and checked-in sessions, puts checked-in first, and — the key column — each row carries a **readiness cell** that says Ready or Blocked *and names the failing gate*: consent, patch test, room, device, operator skill, package balance. The technician does not open the session to discover it is blocked.

"Show checks" expands the same pre-flight panel the full session page uses, including the **Begin procedure** button and the audited override. So the normal path — see the blocked reason, fix or override it, start the session — happens without leaving the worklist.

---

## 3. Twelve end-to-end use cases

Step counts below are **user actions** (a click, a selection, a typed field group), not page loads.

### UC-01 — New patient walk-in → consultation → prescription → billing

**Trigger:** a woman with no appointment walks in at 10:20 asking to see a skin doctor.

1. `/reception/desk` — desk types her mobile in the single search box. Nothing found. Clicks **Register patient**.
2. `/patients/new` — minimum identity: name, gender, mobile, primary branch. Save. The system allocates the next MRN (the seeded set runs PAT-000001 … PAT-000021, so the next is PAT-000022) and a patient code, timestamps `registrationDate`, and sets consent flags to false.
3. Back on `/reception/desk`, with the branch selected, **Walk-in** — creates the appointment and the queue token in one dialog.
4. **Check in** on the new day-sheet row.
5. Dr. Shah, on `/my-day`, sees the patient appear in "Today". She opens the consultation → `/consultations/:id`.
6. She works in the right-hand tab strip (see UC-03) and drafts the prescription in the **Rx draft** tab.
7. **Sign** in the workspace header. Consultation status → `SIGNED`, the SOAP note is un-drafted, a timeline event is written.
8. **Finalize** the prescription (separate action, on the prescription — signing the note does *not* do it). Status → `FINALIZED`, `finalizedAt` stamped. **It now appears in `/pharmacy?tab=queue`.**
9. `/billing` — the cashier raises the invoice, applies the fee, **Finalize**, then records the payment with mode and amount.

**Done automatically:** MRN allocation; queue token and stage transitions; the consultation timeline entry; the pharmacy queue row (from prescription finalize); invoice numbering (the seeded series is at INV-000051); 18% tax from branch settings; the audit rows behind every one of those.

**Outcome:** roughly **9 user actions across 5 screens** for a patient who did not exist ten minutes earlier.

### UC-02 — Returning patient rebook

**Trigger:** Aarav Patel (PAT-000001, 9876000000) phones and says "same as last time, Thursday if possible".

1. `/appointments/book` — type "Aarav", pick him.
2. The page immediately calls `GET /appointments/patient/:patientId/history` and pre-fills **branch, doctor and service from his most recent real visit**. A "Returning" badge appears; the three pre-filled rows are read-only with a **Change** button each. Date defaults to today. Pick the slot.
3. **Confirm booking**.

**That is 3 actions** — and **2** if the desk arrives via `/appointments/book?patientId=…` from his Patient 360 page, because the patient is already chosen.

The pre-fill is not "most recent record". `pickTemplate` in `QuickBookingPanel.jsx` ranks history by status — COMPLETED first, then CHECKED_IN / IN_PROGRESS, then CONFIRMED / SCHEDULED — and pushes cancellations and no-shows to the bottom. So "same as last time" means the last time he actually got treated, not the last time he cancelled.

A first-time patient has no usable history, so the same page renders the full guided wizard instead, with a "First visit" hint. One route, two behaviours, decided by data rather than by the user picking the right menu item.

### UC-03 — Doctor consultation with the AI loop

**Trigger:** Dr. Mehta opens CON-000012 for Rohan Mehta (PAT-000003).

`/consultations/:id` is split down the middle. The **left half is the AI copilot, permanently** — not a tab you have to remember to open. The right half is a single horizontally-scrolling row of **ten** tabs with arrow buttons: Summary, Timeline, SOAP, Vitals, Examination, Diagnosis, Rx draft, Photos, Lab orders, Follow-up. The active tab is in the URL as `?section=`, default `soap`, so a specific tab is linkable. Inactive tabs stay mounted but hidden — switching tabs does not lose typing.

1. Tick or untick **Include clinical photos**, then **Analyse this consultation** → `POST /ai/copilot`. The payload is de-identified: no name, phone, email, address or exact MRN. With photos included, the request sends only the **photo count and body regions**, never the image bytes.
2. Output renders in sections, each carrying the badge **"AI suggestion — verify before use"**: summary, possible conditions with high/medium/low, follow-up questions, red flags, investigations, diet and lifestyle, medication suggestions, aftercare in English and Gujarati, and a confidence note.
3. Doctor asks the patient the suggested questions and records the answers with **Yes / No / Not sure** chips, then clicks **Refine with these answers** → `POST /ai/copilot/:runId/refine`. The backend appends the answers to the run's recorded answers, adds the instruction *"The patient has now answered the questions below. Narrow the differential using these answers."*, and re-runs with the original run as parent. The panel then shows a **"What changed after the answers"** diff with a Show/Hide previous version toggle. Answers survive a reload — they are kept in `sessionStorage`.
4. Accept, per item, into the record: **Accept → Diagnosis**, **Add to Assessment**, **Accept → Lab order**, **Accept → Prescription draft**, **Add to Plan**, **Accept → Patient instructions**, **Note it** (red flags → SOAP Objective), **Insert Q&A into Subjective**. Each insert drops a **blue dot on the destination tab** meaning "AI text landed here — review it". Nothing autosaves; nothing is committed without the doctor.
5. **Sign** in the header. **Lock** becomes available afterwards.

Every accept and the footer's **Mark this run not useful** write a disposition against the AI run, so you can audit later how often the copilot was actually used.

**Outcome:** the differential narrows inside the same screen, and accepted text lands in the right field without retyping. On this machine the copilot returns **mock output** — see Section 6.

### UC-04 — Treatment session with safety gates

**Trigger:** Isha Parekh (PAT-000008) arrives for session TS-000050 on plan TP-000003, "Laser Hair Removal Plan" (package "Laser Hair Full Legs — 8 Pack", ₹35,000 less ₹4,000, 365-day validity, 27 sessions).

1. `/treatments/worklist` — the technician sees TS-000050 with readiness **Blocked**.
2. **Show checks** expands the pre-flight in place. Live output for this session lists the gates and their state:

| Gate | State | Detail |
|---|---|---|
| Session is startable | pass | |
| Treatment plan accepted | pass | plan is ACCEPTED |
| Invoice linked to this session | pass | |
| Invoice paid or partially paid | pass | |
| **Treatment consent signed** | **FAIL** | **"Treatment consent is not signed"** — overridable |
| Patch test valid | n/a | not required by this protocol |
| Assigned room in service | n/a | |
| Assigned device in service | n/a | |

Each gate also carries a **"resolved by"** line naming who fixes it — e.g. consent: "Doctor or front desk — capture the patient consent for this plan"; unpaid invoice: "Cashier — collect payment against the invoice". The technician is told who to walk to.

3. Either capture the consent, or — if the user holds `treatment.hard_stop_override` — supply a reason and override. Attempting to start without either returns **409 `HARD_STOP_BLOCKED`** with the message `Treatment cannot start: Treatment consent is not signed`.
4. **Begin procedure**. Device parameters come from the protocol version, not a free-form form (this session: Diode laser, Aurah Unit 1, Head-A, energy 14, long pulse; consumables Gel, Cooling tips, Eye shields).
5. Record outcome and **Complete**.

**Done automatically on completion:** the package balance decrements by one via a guarded atomic update that cannot go below zero; consumables are matched to inventory items in that branch and deducted as stock movements; a session log row, an audit row, a websocket event and a plan-completion check are written. TP-000003 currently reads 27 total, 10 completed, **25 used, 2 remaining**, 37% complete — visible on the plan progress and in Patient 360 → Treatments.

**Outcome:** 3–4 actions, and the blocking reason was visible before the technician touched the patient.

### UC-05 — Refund with loyalty clawback

**Trigger:** a patient disputes a charge; the branch manager authorises a partial refund.

1. `/billing` → open the invoice → the payment → **Refund**.
2. Pick a **reason from the list** and enter the amount. Reason is mandatory; if the reason is OTHER, notes become mandatory too.
3. Confirm.

**Done automatically:** the refund is recorded as a reversal (never a silent edit of the original payment); loyalty points earned against that invoice are **clawed back FIFO**, and if the patient has already spent them the shortfall is recorded as `PENDING_INSUFFICIENT_BALANCE` rather than letting the balance go negative; a `LOYALTY_POINTS_CLAWED_BACK` audit row is written. The clawback is best-effort — if it fails it is logged and the refund still completes, so a loyalty problem never blocks a refund.

**Guards:** refund without a reason is rejected (422). Refunding twice is rejected — "Payment has already been refunded". Refunding more than was paid is rejected — "Refund amount cannot exceed the original payment". Refund needs `billing.refund`.

**Outcome:** 3 actions, one page.

### UC-06 — Discount above threshold needing approval

**Trigger:** the desk wants to give 40% off a ₹10,000 service. The clinic threshold is **20%** (`BILLING_DISCOUNT_APPROVAL_THRESHOLD_PERCENT`, default 20; every invoice payload carries `discountThresholdPercent: 20` so the UI can show the line).

1. `/billing` — enter the discount on the draft invoice. Above 20%, a **discount reason becomes mandatory**: without one you get `A discount reason is required when the discount exceeds 20% of the subtotal`.
2. Save. The server — not the caller — sets `discountApprovalRequired: true` and `discountApprovalStatus: "PENDING_APPROVAL"`. The desk cannot set this field itself.
3. **Finalize is blocked**, with 403: *"This invoice discount exceeds the 20% approval threshold and is awaiting approval — it cannot be finalized yet."*
4. The branch manager sees the count on `/branch` → **Awaiting you**, and approves or rejects **in the inline panel on that same page**. A decision note is mandatory: `A reason is required to approve a discount`.
5. Once APPROVED, the desk finalizes. If rejected, finalize still fails, now with the rejection note attached and the instruction to reduce the discount to 20% or below.

Seeded example of exactly this state: **INV-000051** for Neha Kapadia (PAT-000010) — subtotal ₹10,000, 40% discount = ₹4,000, `discountApprovalStatus: "PENDING_APPROVAL"`, reason "Wiring verification - will be voided". It was subsequently voided, and its timeline records both the CREATED and VOIDED entries with actor and note.

**Note:** a loyalty redemption is a separate line item and is deliberately excluded from the manual-discount total, so redeeming points never pushes an invoice over the staff discount threshold.

**Outcome:** 2 actions for the desk, 1 for the manager, and the manager never leaves `/branch`.

### UC-07 — Cash close with variance

**Trigger:** end of day at the cash desk.

1. `/billing/cash-desk` — read **Collected today** and the per-mode breakdown, and clear any remaining dues from the **Collect now** list.
2. `/billing/cash-close` (also reachable as the Cash close tab of the billing hub) — enter opening cash and **counted** cash. The system already knows collections and refunds, computes expected, and shows the variance.
3. Submit. Above the clinic's tolerance it becomes an approval item and appears in **Awaiting you** on `/branch` and in the owner's approvals block on `/owner`; the approver decides at `POST /billing-ops/cash-close/:id/approve`.

There are currently **zero cash closes** in the seeded database, so this flow is described from the code, not from data.

**Outcome:** 2–3 actions; the variance is arithmetic the cashier does not do by hand.

### UC-08 — Stock low → transfer or purchase order

**Trigger:** the branch manager's **Stock alerts** tile is non-zero.

1. `/branch` — the stock alerts panel names the items. Live example: **Benzoyl Peroxide (ITM-000006 / SKU-MED-00006)** at Surat Main — current stock **3**, minimum 10, reorder level 25, location A-6, single batch B00006 expiring 08 Feb 2027, `stockStatus: "LOW"`. (The seeded catalogue is 424 items.)
2. `/inventory?tab=overview` → **Transfers** tab if the other branch has stock: request → approve → dispatch → receive, with both branches reconciling. Or the **Purchase orders** tab to raise a PO against a supplier, then a goods receipt with batch and expiry.
3. Received quantity writes a stock movement; the alert clears when stock crosses the minimum.

The `/inventory` hub keeps `Overview / Stock ledger / Expiry / Transfers / Purchase orders / Suppliers` on one route with `?tab=`, and the ledger tab additionally accepts `?itemId=` — so the alert can link straight to that one item's movement history. Six former pages, one URL.

There are currently **zero transfers** in the seeded database.

**Outcome:** 3–5 actions depending on transfer vs PO; the item's whole history is one tab away, not one page away.

### UC-09 — Recall call → booking

**Trigger:** a doctor-set follow-up passed its date without a visit.

1. `/crm?tab=recalls` — the recall worklist.
2. Call the patient, record the outcome from the controlled list (Booked / Call Later / Not Interested / Unreachable / Wrong Number / Opted Out) at `POST /crm-extensions/recall/:id/outcome`.
3. If Booked, go to `/appointments/book` — which is the 2–3 action returning-patient flow from UC-02, because a recall patient by definition has history.

The `/crm` hub carries `Overview / Leads / Pipeline / Follow-ups / Recalls / Offers / Feedback` as tabs on one route with `?tab=`. The call desk's whole day is one URL.

The recall worklist is currently **empty** in the seeded database, because recalls are produced by a scheduled job that is not running (Section 6).

**Outcome:** 3–5 actions.

### UC-10 — Lab order → review queue

**Trigger:** Dr. Mehta ordered a Vitamin D panel during CON-000012 for Rohan Mehta (PAT-000003).

1. `/consultations/:id?section=labs` — the order carries test, reason, due date and provider. It can also come from the copilot's **Accept → Lab order** button.
2. The lab returns a result; the order moves to `RESULT_RECEIVED`.
3. `/consultations/report-review` — the review queue. Live content right now: **2 orders**, both "Vitamin D panel" from provider **Metropolis**, both `RESULT_RECEIVED`, both unreviewed (`reviewedAt: null`), both for Rohan Mehta against CON-000012. Each row shows patient with MRN, the consultation number and status, doctor and branch — enough to triage without opening anything.
4. Doctor reviews and comments; `reviewedAt` and `reviewComment` are stamped and the row leaves the queue.

Note the route ordering in `routes/index.jsx`: `/consultations/report-review` is registered **above** `/consultations/:id` on purpose, so "report-review" is not swallowed as a consultation id.

**Outcome:** 2 actions per result.

### UC-11 — Loyalty redemption at billing

**Trigger:** a patient with a points balance wants it taken off today's bill.

1. `/billing` — open the DRAFT invoice. The panel shows points balance, redeemable now, and the rupee value at the current rate.
2. Enter points (or "max") → `POST /billing/:id/apply-loyalty-redemption`, permission `loyalty.redeem`.
3. A discount line item is added with the conversion rate pinned to the version used. **Remove** is a separate endpoint if the patient changes their mind.
4. Finalize and take payment. A `DEBIT_REDEEM` ledger entry is written against the invoice id.

Live settings on this machine: **10 points = ₹1**, minimum **500** points, redeemed in steps of **100**, maximum **50% of the invoice**, points expire after **12 months** FIFO, reminders at 30 and 7 days. The caps are enforced with specific messages — `A minimum of 500 points is required to redeem.`, `Points must be redeemed in steps of 100.`, and `Redemption discount of ₹X exceeds the maximum allowed (₹Y) for this invoice.` Applying a second redemption to an invoice that already has one is rejected: *"A loyalty redemption is already applied to this invoice. Remove it before applying a new one."*

**On this machine this flow cannot complete**: the loyalty program kill switch is OFF (`programEnabled: false`), there are **zero earning rules configured**, and every patient balance is zero — Aarav Patel reads `currentBalance: 0, lifetimeEarned: 0`. See Section 6.

**Outcome:** 2 actions, on the invoice, with no separate loyalty page.

### UC-12 — Manual loyalty adjustment needing approval

**Trigger:** a patient was inconvenienced and the desk wants to credit goodwill points.

1. `/patients/:id` → **Loyalty** tab → **Manual adjustment**.
2. Direction (CREDIT / DEBIT), points, and a **mandatory reason category** plus a note. Missing category is rejected: `reasonCategory is required for manual adjustments.` Missing direction: `direction must be CREDIT or DEBIT.`
3. Submit → `POST /loyalty/patients/:patientId/adjustments`, permission `loyalty.adjust`. Both outcomes return 201, distinguished by the message:
   - holder of `loyalty.adjust_approve` (or OWNER): applied immediately, message **"Adjustment applied"**.
   - anyone else: status `PENDING_APPROVAL`, message **"Adjustment submitted for approval"**.
4. The approver sees the count in the owner's approvals block on `/owner` and works the queue at `/loyalty?tab=approvals`, approving or rejecting with `loyalty.adjust_approve`. Approving something already decided is rejected: "Only pending adjustment requests can be approved".
5. The ledger entry is marked MANUAL with actor and approver and shows prominently in audit. Corrections are counter-entries — nothing is ever silently edited.

**Important correction to the brief:** there is **no numeric points threshold**. The routing is purely by permission — hold the approve permission and it applies, don't and it queues. The permission descriptions say "within limit" / "above limit", but no limit is implemented. The only numeric threshold in loyalty settings is `ruleChangeApprovalThresholdPercent` (currently `null`), which governs *rule value* changes, not patient adjustments.

**Outcome:** 2 actions for the requester, 1 for the approver.

---

## 4. How features connect across pages

This is the section for the "too many pages" complaint. The pages are not islands; each of the chains below was verified against the code. Read the middle column as "and the system does this without anyone typing it".

| Action, and where | What the system does | Where it shows up |
|---|---|---|
| Doctor clicks **Sign** on `/consultations/:id` | Consultation → `SIGNED`, SOAP note un-drafted, audit row, timeline event, `CONSULTATION_COMPLETED` emitted | Patient 360 → Timeline; the doctor's **Unsigned notes** counter on `/my-day` drops by one; **Lock** appears in the workspace header |
| **Finalize** on the prescription | Status → `FINALIZED`, `finalizedAt` / `finalizedBy` stamped | The prescription appears in **`/pharmacy?tab=queue`** (live: RX-000002 and RX-000003, each 2 items, both `READY`). Rows that are fully dispensed drop off the queue automatically |
| **Dispense** in the pharmacy queue | Batch and quantity recorded FEFO; stock movement written | `/inventory?tab=ledger` for that item; the queue row flips to PARTIAL then disappears at DISPENSED; the low-stock tile on `/branch` reacts |
| Cashier **Finalizes** an invoice | Loyalty spend-based accrual fires (`SPEND_BASED`, idempotency key `spend-based:<invoiceId>`); package-purchase accrual too if the invoice carries a package | Patient 360 → **Loyalty** tab; the patient app home widget. **Note: accrual is on FINALIZED, not on payment** |
| Cashier **records payment** | `paidAmount` / `balanceAmount` recalculated; invoice timeline entry; `InvoicePaid` emitted (consumed by notifications only) | **Collected today** and the per-mode breakdown on `/billing/cash-desk`; the invoice leaves `/billing?…dues`; the **Dues at the desk** counter on `/reception/desk`; the day's revenue on `/branch` and the branch scorecard on `/owner` |
| **Refund** a payment | Reversal recorded; loyalty clawback FIFO against that invoice | Patient 360 → Loyalty (a `DEBIT_CLAWBACK` row); **Refunded today** on `/billing/cash-desk` for users without approve rights |
| Discount above **20%** saved on a draft invoice | Server sets `PENDING_APPROVAL`; finalize is blocked with 403 | `/billing?…approvals` and the count in **Awaiting you** on `/branch`, plus **Discount approvals** on `/owner`. The decision panel is inline on `/branch` |
| Technician **Completes** a session | Package balance `-1` (atomic, floored at zero); consumables matched to branch inventory and deducted; session log; audit; websocket; plan marked complete when all sessions are done | Plan progress and Patient 360 → **Treatments** (TP-000003 now reads 25 of 27 used, 2 remaining, 37%); `/inventory?tab=ledger`; **Completed treatments** on the owner scorecard; the patient app treatments screen |
| Session **completion reversed** | Package balance `+1`, capped at the package maximum; reason mandatory | Same places, corrected — and the reversal itself is audited |
| **Check in** on the `/reception/desk` day sheet | Queue stage advances; token live | **Waiting now** on `/reception/desk` and `/branch`; the queue board (websocket, no refresh); the doctor's list on `/my-day`; the "checked in today" filter on the cashier's **Collect now** list |
| Copilot **Accept → Lab order** on `/consultations/:id` | Lab order created against the consultation | The **Lab orders** tab gets a blue dot; on result, the order surfaces in `/consultations/report-review` (live: 2 Vitamin D panels for PAT-000003) |
| Copilot **Accept → Prescription draft** / **→ Diagnosis** | Text inserted into the draft; disposition ACCEPTED recorded against the AI run | The destination tab gets a blue dot — "AI text inserted here, review it". Then the UC-01 chain: sign, finalize, pharmacy queue |
| **Refine with these answers** on the copilot | Answers appended to the run, differential re-run with the original as parent | The same panel, plus a **"What changed after the answers"** diff. No page change |
| **Manual loyalty adjustment** from Patient 360 → Loyalty | Applied, or queued as `PENDING_APPROVAL` | `/loyalty?tab=approvals` and the **Loyalty manual adjustments** count on `/owner` |
| Selecting a patient on `/appointments/book` | `GET /appointments/patient/:id/history` → branch, doctor, service pre-filled from the last *completed* visit | The same page, as three read-only rows each with **Change** — this is why the rebook is 2–3 clicks |
| Stock drops below minimum | `stockStatus` → `LOW` | **Stock alerts** on `/branch`; the low-stock report; `/inventory?tab=overview`, and `?tab=ledger&itemId=…` links straight to that item's history |

Three structural points behind that table:

1. **Tabbed hubs replaced sibling pages.** `/treatments`, `/billing`, `/crm`, `/loyalty`, `/reports`, `/inventory`, `/pharmacy` and `/notifications` are each one route carrying what used to be several. `/reports` now covers Dashboards / Reports / Analytics / Scheduled, and the old `/reports` hub-of-cards page is a bare redirect to `/reports?tab=dashboards`.
2. **Patient 360 is one page with 11 client-side tabs** (`/patients/:id`): Overview, Medical, Documents, Timeline, Appointments, Billing, Prescriptions, Treatments, Photos, Handoff notes, Loyalty — seven of them permission-conditional. Opening a patient's bills does not navigate anywhere.
3. **Approvals are decided where they are counted.** The `/branch` and `/billing/cash-desk` pages both embed the real discount approval panel rather than linking to it.

Two honest caveats on that structure, because they affect the client's own habits:

- **`/billing` tab state is not in the URL.** The billing hub uses plain component state — there is no `?tab=` on `/billing`, so a specific billing tab cannot be bookmarked or shared. Patient 360's 11 tabs have the same limitation.
- **`/treatments` is hybrid**: it reads `?tab=` on first load and writes it on change, but the URL is not the source of truth afterwards, so browser back/forward does not move between its tabs.

---

## 5. Test cases

Preconditions assume the seeded database as it stands. Auth for every API check:

```
POST http://localhost:5000/api/v1/auth/login
{"email":"owner@aurah360.local","password":"ChangeMe@12345"}
→ .data.accessToken   →   Authorization: Bearer <token>
```
`limit` is capped at 100 on list endpoints.

### 5.1 UC-01 — New patient → consultation → prescription → billing

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T01.1 | Logged in with `patients.create` | `/patients/new`, save name + gender + mobile + branch | Patient saved with the next MRN in the PAT-0000xx series and a matching PC-0000xx code | `GET /patients?limit=1` — newest first; check `mrn`, `patientCode`, `registrationDate` |
| T01.2 | Branch selected on `/reception/desk` | Click **Walk-in**, complete the dialog | Appointment + queue token created, `source: "WALK_IN"` | Row appears on the day sheet; `GET /appointments?limit=1` |
| T01.3 | No branch selected | Look at the **Walk-in** button | Button is disabled | UI |
| T01.4 | Day-sheet row exists | Click **Check in** | Status advances; **Waiting now** increments; row action becomes **Undo check-in** | Queue board updates over the websocket without a page refresh |
| T01.5 | Consultation open with a drafted note | Click **Sign** | Consultation `status: "SIGNED"`; **Unsigned notes** on `/my-day` decrements | `POST /consultations/:id/sign`; then `GET /consultations/:id` |
| T01.6 | Prescription is DRAFT and non-empty | **Finalize** it | `status: "FINALIZED"`, `finalizedAt` set | `POST /prescriptions/:id/finalize`; then `GET /pharmacy/queue` — the new RX appears with `dispenseStatus: "READY"` |
| T01.7 | Prescription is DRAFT, **consultation signed but Rx not finalized** | `GET /pharmacy/queue` | The Rx is **absent**. Signing the note does not queue the prescription | Live queue currently holds only RX-000002 and RX-000003 |
| T01.8 | Empty prescription | **Finalize** | 400 `Cannot finalize an empty prescription` | API |
| T01.9 | Consultation locked | Edit the prescription | 403 `Consultation is locked — prescriptions cannot be changed` | API |
| T01.10 | Draft invoice with a service line | **Finalize**, then record payment | Invoice number in the INV-0000xx series; 18% tax applied from branch settings; `paidAmount` / `balanceAmount` recalculated | `GET /billing/:id` — check `taxPercent: 18`, `total`, `paymentProgress` |

### 5.2 UC-02 — Returning patient rebook

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T02.1 | PAT-000001 Aarav Patel has visit history | `/appointments/book`, pick him | "Returning" badge; branch, doctor and service pre-filled as three read-only rows each with **Change** | UI; `GET /appointments/patient/6a75d4d2dd8ec097a356ca81/history` returns the source rows |
| T02.2 | As above | Count the actions to a booking | **3** — patient, slot, Confirm | UI |
| T02.3 | Arrive via `/appointments/book?patientId=6a75d4d2dd8ec097a356ca81` | Count again | **2** — slot, Confirm | UI |
| T02.4 | A patient whose only history is cancellations/no-shows | Pick that patient | Cancelled/no-show entries are ranked last, so a real prior visit wins the pre-fill; with no usable history, the guided wizard renders with a "First visit" hint | UI; logic in `QuickBookingPanel.jsx` `pickTemplate` / `TEMPLATE_RANK` |
| T02.5 | Pre-filled form | Click **Change** on branch | Doctor is cleared and the doctor picker opens; any held slot is released | UI |
| T02.6 | PAT-000021 Quickbook Newbie (no completed visit) | Pick that patient | Full wizard, "First visit" hint | UI |

### 5.3 UC-03 — Consultation and the AI loop

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T03.1 | Open `/consultations/:id` | Look at the layout | AI copilot occupies the left half permanently; right half is one scrolling row of **10** tabs with arrow buttons | UI |
| T03.2 | As above | Append `?section=labs` to the URL | The Lab orders tab is active. Default with no parameter is `soap` | UI |
| T03.3 | As above | Type in SOAP, switch tab, switch back | Text is still there — hidden panels stay mounted | UI |
| T03.4 | Doctor with `ai.use` | **Analyse this consultation** | Structured output in labelled sections, every one badged "AI suggestion — verify before use" | `POST /ai/copilot {"consultationId":"…","patientId":"…","includePhotos":false}` → `.data.output` with the 11 contract keys |
| T03.5 | A run exists | Answer with Yes/No/Not sure, **Refine with these answers** | New version; **"What changed after the answers"** diff with a Show/Hide previous toggle | `POST /ai/copilot/:runId/refine {"answers":[…]}` → response carries `parentRunId` |
| T03.6 | Run output present | Click **Accept → Prescription draft** | Text inserted into the Rx draft; the Rx tab gets a blue dot; nothing autosaves | UI; the accept records disposition ACCEPTED against the run |
| T03.7 | Refine with a bad run id | `POST /ai/copilot/<random>/refine` | 404 `AI run not found` | API |
| T03.8 | Refine a non-copilot run id | Same call | 400 `This AI run is not a clinical copilot run` | API |
| T03.9 | "Include clinical photos" ticked | Run and inspect the request the backend builds | Only photo **count and body regions** are sent, never image bytes; no name, phone, email, address or exact MRN in the payload | Code: `ClinicalCopilotService.buildContext`, `PiiRedactor` |
| T03.10 | AI provider unreachable or timing out | Run | `degraded: true` with a reason; the consultation stays fully usable and the manual EMR flow continues | API — gateway converts throws into degraded responses rather than errors |

### 5.4 UC-04 — Treatment session and safety gates

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T04.1 | Technician on `/treatments/worklist` | Read the list | Checked-in rows sort first; each row's readiness cell says Ready or **Blocked and names the failing gate** | UI |
| T04.2 | TS-000050 (SCHEDULED, Isha Parekh, plan TP-000003) | **Show checks** | CONSENT gate fails: **"Treatment consent is not signed"**, `overridable: true`. Each gate carries a "resolved by" line | `GET /treatment-sessions/6a75d4f2dd8ec097a356d178/preflight` |
| T04.3 | Same, no override supplied | **Begin procedure** | **409 `HARD_STOP_BLOCKED`** — `Treatment cannot start: Treatment consent is not signed` | `POST /treatment-sessions/:id/start` with no `override` |
| T04.4 | User **without** `treatment.hard_stop_override` | Start with `override.reason` supplied | Still 409 — both the permission and the reason are required | API |
| T04.5 | User **with** the permission, `override.reason` supplied | Start | Session starts; `TREATMENT_HARD_STOP_OVERRIDDEN` audit row written with the gates and the reason; the override persisted on the session | `GET /treatment-sessions/:id` → `hardStopOverrides` |
| T04.6 | Plan not yet ACCEPTED | Start | **403** `Treatment plan must be Accepted before sessions can start` — **not overridable** | API |
| T04.7 | Invoice unpaid | Start | **403** `Invoice payment status must be Paid or Partial (got PENDING)` — not overridable | API |
| T04.8 | Session not in a startable status | Start | 400 `Session cannot be started from current status` | API |
| T04.9 | In-progress session | **Complete** | Package balance decrements by one; consumables deducted as stock movements; session log + audit written | `GET /treatment-sessions/progress/6a75d4e5dd8ec097a356ce8e` — `usedSessions` increments (currently 25 of 27, 2 remaining); `GET /inventory/ledger` for the consumable |
| T04.10 | Session already at zero package balance | Complete | Decrement is skipped and logged; balance never goes negative | Guarded conditional update, cannot go below zero |
| T04.11 | Completed session | Reverse the completion with no reason | 400 `A reason is required to reverse a session completion` | `POST /treatment-sessions/:id/reverse-completion` |
| T04.12 | Completed session | Reverse with a reason | Package balance `+1`, capped at the package maximum (27) | Progress endpoint |
| T04.13 | Package limit reached | Create *another* session on that plan | **403** `Session limit reached (n/limit)` — the package cap is enforced at session **creation** | `POST /treatment-sessions` |

### 5.5 UC-05 — Refund and clawback

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T05.1 | A recorded payment | Refund with **no reason** | **422 VALIDATION_ERROR** — `{"path":"reason","message":"A refund reason is required"}` | `POST /billing/payments/:paymentId/refund {"amount":100}` — **verified live** |
| T05.2 | Reason = OTHER, no notes | Refund | 422 `Notes are required when the refund reason is OTHER` | API |
| T05.3 | Already-refunded payment | Refund again | 400 `Payment has already been refunded` | API |
| T05.4 | Refund amount > paid | Refund | 400 `Refund amount cannot exceed the original payment` | API |
| T05.5 | Invoice that earned loyalty points | Refund it | Clawback `DEBIT_CLAWBACK` entry against that invoice; `LOYALTY_POINTS_CLAWED_BACK` audit | `GET /loyalty/patients/:patientId/ledger` |
| T05.6 | Patient already spent those points | Refund | Balance does **not** go negative; the shortfall is recorded as `PENDING_INSUFFICIENT_BALANCE` and a clawback-pending event fires | Ledger |
| T05.7 | User without `billing.refund` | Refund | 403 | API |

### 5.6 UC-06 — Discount above threshold

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T06.1 | Draft invoice, subtotal ₹10,000 | Apply 25% discount with **no reason** | 400 `A discount reason is required when the discount exceeds 20% of the subtotal` | API |
| T06.2 | Same with a reason | Save | Server sets `discountApprovalRequired: true`, `discountApprovalStatus: "PENDING_APPROVAL"` — the caller cannot set these fields | `GET /billing/:id`; compare seeded **INV-000051** which shows exactly this shape at 40% |
| T06.3 | Invoice PENDING_APPROVAL | **Finalize** | **403** *"This invoice discount exceeds the 20% approval threshold and is awaiting approval — it cannot be finalized yet"* | `POST /billing/:id/finalize` |
| T06.4 | Manager with `billing.discount_approve` | Approve with **no note** | 400 `A reason is required to approve a discount` | `POST /billing/:id/approve-discount` |
| T06.5 | Same, with a note | Approve | Status APPROVED; finalize now succeeds | API |
| T06.6 | Invoice REJECTED | Finalize | 403 with the rejection note appended and the instruction to reduce the discount to 20% or below | API |
| T06.7 | Discount at exactly 20% | Save and finalize | `discountApprovalStatus: "NOT_REQUIRED"`; finalize succeeds. Boundary is *above* the threshold | API |
| T06.8 | Invoice with a loyalty redemption plus a 15% staff discount | Finalize | Succeeds — the loyalty redemption is excluded from the manual-discount total and cannot push the invoice over the threshold | API |
| T06.9 | Manager on `/branch` | Read **Awaiting you**, scroll to the panel | The approve/reject controls are on that page; no navigation needed | UI |

### 5.7 UC-07 — Cash close

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T07.1 | Payments recorded today | Open `/billing/cash-desk` | **Collected today** matches the per-mode breakdown total | Compare with the day's payments |
| T07.2 | `/billing/cash-close` | Enter opening and counted cash | Expected is computed from collections minus refunds; variance shown | UI; `POST /billing-ops/cash-close` |
| T07.3 | Variance above tolerance | Submit | Becomes an approval item; appears in **Awaiting you** on `/branch` and **Cash-close approvals** on `/owner` | `GET /billing-ops/cash-close` (currently `{"closes": []}`) |
| T07.4 | Pending close | Approver acts | Close approved and recorded with the approver | `POST /billing-ops/cash-close/:id/approve` |

### 5.8 UC-08 — Stock low → transfer / PO

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T08.1 | Benzoyl Peroxide ITM-000006 at stock 3, minimum 10 | Open `/branch` | The item appears under **Stock alerts** with `stockStatus: "LOW"` | `GET /inventory/reports/low-stock` — **verified live** |
| T08.2 | `/inventory` | Switch tabs | `?tab=` changes across Overview / Stock ledger / Expiry / Transfers / Purchase orders / Suppliers; the tab is deep-linkable | UI |
| T08.3 | Ledger tab | Open `/inventory?tab=ledger&itemId=6a75d502dd8ec097a356d4c3` | That item's movement history loads directly | UI; `GET /inventory/ledger` |
| T08.4 | Other branch has stock | Transfer: request → approve → dispatch → receive | Both branches reconcile; a stock movement is written on receipt | `GET /inventory/transfers` (currently `{"transfers": []}`) |
| T08.5 | No stock anywhere | Raise a PO, then a goods receipt with batch and expiry | Stock increases; alert clears once above minimum | `POST /inventory/purchase-orders`, `POST /inventory/goods-receipts/:id/post` |

### 5.9 UC-09 — Recall → booking

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T09.1 | `/crm` | Switch tabs | `?tab=` moves across Overview / Leads / Pipeline / Follow-ups / Recalls / Offers / Feedback | UI |
| T09.2 | A recall entry exists | Record outcome "Booked" | Outcome stored against the entry from the controlled list | `POST /crm-extensions/recall/:id/outcome`; `GET /crm-extensions/recall` (currently `{"entries": []}`) |
| T09.3 | Outcome = Booked | Continue into `/appointments/book` | The recall patient has history, so the 2–3 action path from T02.2 applies | UI |
| T09.4 | Free-text outcome not in the list | Submit | Rejected — the outcome list is controlled | API |

### 5.10 UC-10 — Lab order → review queue

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T10.1 | Consultation open | `?section=labs`, add an order with test, reason, due date, provider | Order created against the consultation | `POST /consultations/:id/lab-orders` |
| T10.2 | Copilot output has investigations | **Accept → Lab order** | Order created without retyping; the Lab orders tab gets a blue dot | UI |
| T10.3 | Two results received | Open `/consultations/report-review` | **2** rows, both "Vitamin D panel" / Metropolis / `RESULT_RECEIVED`, both for Rohan Mehta (PAT-000003) against CON-000012, both `reviewedAt: null` | `GET /consultations/lab-orders/review-queue` — **verified live** |
| T10.4 | A row in the queue | Review with a comment | `reviewedAt` and `reviewComment` stamped; the row leaves the queue | API |
| T10.5 | Navigate to `/consultations/report-review` | — | The report review page loads; "report-review" is **not** read as a consultation id | Route order in `routes/index.jsx` puts it above `/consultations/:id` |

### 5.11 UC-11 — Loyalty redemption

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T11.1 | Program settings | Read them | 10 points = ₹1, minimum 500, step 100, max 50% per invoice, 12-month FIFO expiry, reminders at 30 and 7 days, `programEnabled: false` | `GET /loyalty/settings` — **verified live** |
| T11.2 | Balance ≥ 500, DRAFT invoice | Redeem 1,000 points | ₹100 discount line added, conversion-rate version pinned | `POST /billing/:id/apply-loyalty-redemption` |
| T11.3 | Balance ≥ 500 | Redeem **400** points | 400 `A minimum of 500 points is required to redeem.` | API |
| T11.4 | Balance ≥ 500 | Redeem **550** points | 400 `Points must be redeemed in steps of 100.` | API |
| T11.5 | Points worth more than half the invoice | Redeem "max plus" | 400 `Redemption discount of ₹X exceeds the maximum allowed (₹Y) for this invoice.` | API |
| T11.6 | Redemption already applied | Apply a second one | 400 *"A loyalty redemption is already applied to this invoice. Remove it before applying a new one."* | API |
| T11.7 | Redemption applied | Remove it | Line removed; points restored | `POST /billing/:id/remove-loyalty-redemption` |
| T11.8 | Invoice finalized | Check the ledger | One `DEBIT_REDEEM` entry linked to the invoice id | `GET /loyalty/patients/:patientId/ledger` |
| T11.9 | `programEnabled: false` (current state) | Attempt any accrual or redemption | Nothing accrues or redeems; balances are preserved; billing is unaffected | `GET /loyalty/patients/6a75d4d2dd8ec097a356ca81/balance` → all zeros — **verified live** |
| T11.10 | Zero earning rules configured (current state) | Finalize an invoice | No credit entry is written — there is no rule to match | `GET /loyalty/rules` → `[]` — **verified live** |

### 5.12 UC-12 — Manual loyalty adjustment

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| T12.1 | `loyalty.adjust` only | Submit a credit with reason category and note | **201**, message **"Adjustment submitted for approval"**, status `PENDING_APPROVAL` | `POST /loyalty/patients/:patientId/adjustments` |
| T12.2 | OWNER or `loyalty.adjust_approve` | Same submission | **201**, message **"Adjustment applied"**, ledger entry written immediately | API |
| T12.3 | No `reasonCategory` | Submit | 400 `reasonCategory is required for manual adjustments.` | API |
| T12.4 | No direction | Submit | 400 `direction must be CREDIT or DEBIT.` | API |
| T12.5 | Patient with no primary branch and no `branchId` | Submit | 400 `branchId is required — patient has no primary branch on file.` | API |
| T12.6 | Pending request | Approve with `loyalty.adjust_approve` | Applied; ledger marked MANUAL with actor and approver | `POST /loyalty/adjustments/:id/approve` |
| T12.7 | Already-decided request | Approve again | 400 `Only pending adjustment requests can be approved` | API |
| T12.8 | Bad request id | Approve | 404 `Adjustment request not found` | API |
| T12.9 | Pending items exist | Open `/owner` | **Loyalty manual adjustments** count is non-zero and its button opens the queue at `/loyalty?tab=approvals` | UI; `GET /loyalty/adjustments/queue` |

### 5.13 Negative and access-control cases (all verified live)

| ID | Precondition | Steps | Expected | Verify |
|---|---|---|---|---|
| N-1 | APT-000056 is SCHEDULED | Cancel with an empty body | **422 VALIDATION_ERROR** — `{"path":"reasonCode","message":"Cancellation reason is required"}` | `POST /appointments/6a76024f8aa38f645d08a7e3/cancel` with `{}` — **verified live** |
| N-2 | Same | Cancel with `reasonCode: "OTHER"` and no note | 422 `A note is required when the cancellation reason is OTHER` | API |
| N-3 | Already-cancelled appointment | Cancel again | 400 `Appointment already closed` | API |
| N-4 | INV-000050 (Neha Kapadia, ₹3,127, PENDING) | Record a CARD payment with no reference | **422** — `{"path":"reference","message":"Reference is required for CARD payments"}` | `POST /billing/6a75d4ecdd8ec097a356d035/payments` with `{"amount":100,"method":"CARD"}` — **verified live** |
| N-5 | Same | Split payment where one non-cash leg has no reference | 422 / 400 `Reference is required for <METHOD> payments` for that leg | API |
| N-6 | Cash payment | Record with no reference | Accepted — cash does not require a reference | API |
| N-7 | Invoice with a >20% discount pending approval | **Finalize** | 403 as in T06.3 | API |
| N-8 | Dr. Mehta has APT at 2026-08-13 11:20–11:35 | Book the identical doctor + date + slot | **409 CONFLICT** — `Doctor already has an appointment in this time range` | `POST /appointments` — **verified live** |
| N-9 | Same appointment exists | Book a *different* patient at 11:25–11:40 (overlapping) | **400** `Slot unavailable: SLOT_NOT_AVAILABLE` — the availability engine rejects it before the conflict check | **verified live** |
| N-10 | Doctor booked at another branch minutes earlier | Book across branches back to back | 409 `TRAVEL_BUFFER_VIOLATION` — *"Doctor needs at least 30 minutes to travel between branches — this slot is too close to another branch's appointment"* | API |
| N-11 | Room or device already booked in the range | Book | 409 `ROOM_UNAVAILABLE` / `DEVICE_UNAVAILABLE` — `Selected room/device is already booked in this time range` | API |
| N-12 | Room/device out of service | Book | 409 `Selected room is not in service` / `Selected device is not in service` | API |
| N-13 | Any payment | Refund with no reason | 422 as in T05.1 | **verified live** |
| N-14 | TS-000050 with consent unsigned | Start | 409 `HARD_STOP_BLOCKED` naming **the specific gate**: `Treatment cannot start: Treatment consent is not signed` | **verified live via preflight** |
| N-15 | Logged in as `dr.shah@aurah360.local` | `GET /appointments?limit=3` | **28** appointments, every one for Ananya Shah — automatically scoped, no filter to un-set | **verified live** |
| N-16 | Same session | `GET /appointments?doctorId=6a75d4d1dd8ec097a356ca4e` (Dr. Mehta's id) | **403** — `{"message":"doctorId is outside your scope","code":"DOCTOR_SCOPE_VIOLATION"}` | **verified live** |
| N-17 | A DOCTOR-role user with no linked doctor profile | Any doctor-scoped list | 409 `DOCTOR_PROFILE_MISSING` — *"Your user has the DOCTOR role but no linked doctor profile… Ask an administrator to link your user to a doctor profile."* | API |
| N-18 | A user with no branch assigned | Any branch-scoped list | 409 `BRANCH_SCOPE_UNASSIGNED` with a similar instruction | API |
| N-19 | Any user | Pass another branch's `branchId` | 403 `branchId is outside your branch scope`, code `BRANCH_SCOPE_VIOLATION` | API |
| N-20 | Doctor opens a colleague's *single* record by id | `GET /consultations/:id` | Allowed by design — single-record GETs are deliberately not doctor-scoped so a covering doctor can open a colleague's record. Lists are scoped; single reads are not | Documented carve-out in `scope.helper.js` |

**One caveat on N-8 worth stating to the dev team:** the 409 comes from a read-then-write conflict check. There is no database transaction and no unique index on doctor + date + start time. The only uniqueness in play is a sparse unique idempotency key, which correctly de-duplicates a retried request (a repeat returns the original appointment rather than an error). Two *genuinely simultaneous* bookings could therefore both pass the check. Also note that the conflict check is skipped entirely when the booking is flagged as requiring approval.

---

## 6. Known limitations

Stated plainly. None of these are described as working anywhere above.

1. **The AI copilot returns mock output.** `backend/.env` contains no `AI_*` or `ANTHROPIC_*` variables, so the provider falls back to `MOCK`. A live run just now returned `model: "mock-clinical-copilot-v1"` with `summary: "MOCK OUTPUT — not a real model response. Configure ANTHROPIC_API_KEY and AI_PROVIDER=ANTHROPIC for real suggestions."` and placeholder items ("Mock differential A", likelihood medium, "Deterministic mock entry — no clinical reasoning was performed"). The shape is correct and the whole UI works against it — only the content is fake. To make it real, set `AI_PROVIDER=ANTHROPIC`, `ANTHROPIC_API_KEY=…`, and **`AI_TIMEOUT_MS=60000`** — the default is 8000 ms, which will abort a real call before it finishes.
2. **Redis is not running, so no background job fires.** Port 6379 is not reachable from this machine. Everything driven by BullMQ is therefore dormant: points expiry, birthday bonuses, appointment reminders, and the jobs that would populate the recall worklist. This is why `/crm-extensions/recall` returns an empty list and why nothing has ever expired. Synchronous work is unaffected — loyalty accrual, for instance, runs in-process on an event emitter, not on a queue.
3. **The loyalty program is switched off and has no rules.** `programEnabled: false` and `GET /loyalty/rules` returns `[]`. No points have ever been earned by anyone — every patient balance reads zero. The engine, ledger, redemption endpoints and caps are all built and testable, but until the owner turns the program on and configures at least one earning rule (E1 visit, E2 spend, E5 referral are the recommended starting three), the loyalty parts of UC-11 and UC-12 have nothing to act on.
4. **Loyalty accrues when an invoice is FINALIZED, not when it is PAID.** The subscriber listens on `InvoiceFinalized`. `InvoicePaid` is emitted but only notifications consume it. This means points are credited on a bill that may still be unpaid — with ₹3,43,958 outstanding across 30 invoices in this database, that is a real difference. Confirm with the client which event they actually want before switching the program on.
5. **The mobile app has no Rewards screen.** `HomeScreen.js` shows a points-balance card when `loyalty.programEnabled` is true and, on tap, calls `navigation.navigate('More', { screen: 'Rewards' })` — but **no `Rewards` route is registered in `MoreStack.js` and no `RewardsScreen.js` exists**. The API client already has `loyaltyBalance`, `loyaltyLedger` and the dependent equivalents, so the screen is the only missing piece. The web patient portal has no loyalty page at all.
6. **WhatsApp and SMS cannot send.** Provider credentials are not configured, and production SMS additionally needs a DLT-registered entity, header and approved template IDs. Templates and the delivery log exist in `/notifications`; nothing leaves the building.
7. **Clinical photos with unconfirmed consent are shown with a warning, not withheld.** The upload form has a "Photography consent verified" checkbox, and the thumbnail list simply labels each photo "Consent ✓" or "Consent pending". A pending-consent photo is still displayed and still openable. There is also **no restricted-body-area rule** anywhere — the PRD's IMG-003 requirement to block privacy-sensitive areas server-side is not implemented.
8. **Session completion does not create billing items.** The code says so explicitly: package balance and stock are updated, "billing/invoices remain untouched (out of scope)". Someone has to raise the invoice. The PRD's TRT-005 "atomic close updates timeline, stock, package **and billing**" is only three-quarters implemented.
9. **The package balance gate is advisory at session start.** On the pre-flight it is reported non-blocking — you will see "2 of 27 session(s) remaining" or "Session limit reached", but an exhausted package does not stop a start. The cap is enforced one step earlier, when the session is *created* (403 `Session limit reached`).
10. **Consumables are matched to stock by name.** Free-text consumable names are resolved against inventory by case-insensitive exact match within the session's branch. A typo means the stock is silently not deducted — it is logged and skipped, never surfaced.
11. **Manual loyalty adjustments have no numeric limit.** Routing is purely by permission (see UC-12). The permission descriptions promise "within limit" / "above limit"; no limit exists in code.
12. **No database transactions anywhere.** Stated explicitly in the billing service. Consistency relies on idempotency keys, guarded conditional updates and sequential compensation (a failed loyalty redemption save writes a `CREDIT_REVERSAL`). It works for the observed cases but is worth knowing before high-concurrency use.
13. **Three of the six role landings have no seeded user.** The staff list contains only OWNER, ADMIN, two DOCTORs and two TECHNICIANs. There is no RECEPTIONIST, CASHIER or BRANCH_MANAGER account, so `/reception/desk`, `/billing/cash-desk` and `/branch` can currently only be reached by navigating directly as owner or admin — the role-based auto-landing for those three is untested against a real account. Create one user per role before the client demo.
14. **Some tab states are not in the URL.** `/billing` and `/patients/:id` keep tab state in component state only — those tabs cannot be bookmarked, shared or reached with the browser back button. `/treatments` is hybrid: it reads `?tab=` on load and writes it on change, but the URL stops being authoritative after mount. `/crm`, `/loyalty`, `/reports`, `/inventory`, `/pharmacy` and `/notifications` are fully URL-driven, as is the consultation workspace via `?section=`.
15. **The copilot's field names differ from the prompt-pack specification.** The live contract returns `follow_up_questions`, `investigations` and `diet_lifestyle_advice`, plus extra fields `procedural_options_note` and `aftercare_advice_english`. The prompt pack specifies `questions_to_ask`, `suggested_tests` and `diet_lifestyle`. The UI matches the code, so nothing is broken — but the prompt-pack document is out of date relative to the implementation, and whoever writes the real system prompt must target the implemented schema.
16. **`AiAssistPanel.jsx` and a `WORKSPACE_TABS` entry `{ id: 'ai', label: 'AI assist' }` are dead code** left over from when AI was a tab. Neither is imported by the workspace. Harmless, but do not let them mislead a future reader into thinking AI is still a tab.

---

## 7. Provenance of the examples

**Confirmed by live API calls on 07–08 August 2026** (`http://localhost:5000/api/v1`, owner token unless noted):

- 21 patients, PAT-000001 Aarav Patel through PAT-000021 Quickbook Newbie, with mobiles — `GET /patients?limit=25`
- 2 branches (Surat Main SURAT-01, Vesu SURAT-02) with hours, 15-minute slots, 5-minute buffer, 18% tax — `GET /branches`
- 2 doctors, Ananya Shah DOC-001 and Rahul Mehta DOC-002 (₹700 / ₹350, 15 min) — `GET /doctors`
- 6 staff users: 1 OWNER, 1 ADMIN, 2 DOCTOR, 2 TECHNICIAN — `GET /users` (this is how limitation 13 was found)
- 56 appointments; APT-000056 for Aarav Patel with Dr. Mehta — `GET /appointments`
- 51 invoices; INV-000051 with its 40% pending-approval discount and void timeline; INV-000050 Neha Kapadia ₹3,127 PENDING — `GET /billing`
- Dues: 30 invoices, **₹3,43,958.20** outstanding, ageing CURRENT 5 / ₹32,851.20, 8–30 days 13 / ₹1,93,166, 31–60 days 12 / ₹1,17,941, 60+ zero — `GET /billing/due-payments`
- Discount approval queue empty; `discountThresholdPercent: 20` on every invoice — `GET /billing/discount-approvals`
- Treatment plan **TP-000003** "Laser Hair Removal Plan", package "Laser Hair Full Legs — 8 Pack" ₹35,000 less ₹4,000, 27 sessions, 10 completed, **25 used, 2 remaining, 37%** — `GET /treatment-plans/patient/…` and `GET /treatment-sessions/progress/…`
- 50 sessions (20 scheduled, 10 in progress); TS-000050 with its device parameters and consumables — `GET /treatment-sessions/dashboard`
- TS-000050 pre-flight with the CONSENT gate failing and its "resolved by" text — `GET /treatment-sessions/:id/preflight`
- Pharmacy queue: RX-000002 and RX-000003, 2 items each, both READY — `GET /pharmacy/queue`
- Lab review queue: 2 Vitamin D panels from Metropolis for PAT-000003 against CON-000012 — `GET /consultations/lab-orders/review-queue`
- Low stock: Benzoyl Peroxide ITM-000006 at 3 against a minimum of 10; 424 inventory items — `GET /inventory/reports/low-stock`, `GET /inventory/items`
- Loyalty settings (10 pts = ₹1, min 500, step 100, 50% cap, 12-month expiry, `programEnabled: false`), zero rules, Aarav Patel's zero balance — `GET /loyalty/settings`, `/loyalty/rules`, `/loyalty/patients/:id/balance`
- Empty cash-close list, empty transfer list, empty recall list — `GET /billing-ops/cash-close`, `/inventory/transfers`, `/crm-extensions/recall`
- The mock AI copilot run and its 11 output keys — `POST /ai/copilot`
- Doctor scoping: `dr.shah` sees 28 appointments all her own; passing Dr. Mehta's `doctorId` returns 403 `DOCTOR_SCOPE_VIOLATION` — verified with a `dr.shah` token
- The five rejection cases N-1, N-4, N-8, N-9, N-13, each with its exact message and status code

One appointment (APT-000057) was created during the double-booking test and **cancelled again** with reason OTHER / "Documentation verification artifact - removing". No other data was changed.

**Read from source, not exercised at runtime:** the cash-close flow (no closes exist), the inventory transfer flow (no transfers exist), the recall outcome flow (no recall entries exist), the loyalty accrual and redemption flows (program disabled, no rules), the travel-buffer and room/device conflict cases, and the discount approve/reject decision path (the queue is empty).

**Illustrative, not from data:** the step-by-step narratives and named personas in Sections 2 and 3 — the shifts are invented, but every route, button label, field name, counter and rule inside them was read out of the current code.

**Route verification:** every route cited in this document was checked against `frontend/src/constants/routes.js` and confirmed registered in `frontend/src/routes/index.jsx`.

---

## 8. Corrections to the brief this document was written from

Recorded here because they change what can be demonstrated.

1. The seeded treatment plan at 25-of-27 sessions is **TP-000003**, not TP-000002.
2. Returning-patient rebook is **3 actions**, not 2 — patient, slot, confirm. It is 2 only when arriving with `?patientId=`.
3. Patient 360's 11 tabs are in a different order than expected — Overview, Medical, **Documents, Timeline**, Appointments, Billing, Prescriptions, Treatments, Photos, **Handoff notes**, Loyalty — and the tab state is **not** in `?tab=`.
4. Not every hub keeps tab state in `?tab=`. `/billing` has none at all; `/treatments` is hybrid. See limitation 14.
5. Loyalty accrues on invoice **finalized**, not invoice **paid**. See limitation 4.
6. A prescription reaches the pharmacy queue when the **prescription is finalized**, not when the consultation is signed. These are two separate actions, and signing alone leaves the prescription invisible to pharmacy.
7. Completing a treatment session decrements the package balance and writes stock movements but **does not** create billing items.
8. The package-balance safety gate is **advisory** at session start, not blocking. It is enforced at session creation.
9. Manual loyalty adjustment approval is **permission-based with no numeric threshold**.
10. The loyalty program is **disabled** with **zero rules** on this machine, so loyalty accrual cannot currently be demonstrated end to end at all.
11. The double-booking 409 is real but has **no transactional or unique-index backing**, and is skipped for approval-required bookings.
12. The mobile app's loyalty gap is more specific than "no loyalty screens": the home widget and API client exist; the `Rewards` screen it navigates to does not.
13. Three role landings (`/reception/desk`, `/billing/cash-desk`, `/branch`) have **no seeded user of that role**.
