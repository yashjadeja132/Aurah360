# Aurah 360 ClinicOS — Ideal Real-Life User Flows & Test Cases

**Purpose of this document:** This is a comprehensive, role-by-role set of real-life example flows and test cases derived from `aurah_prd.md` and `Aurah360_ClinicOS_Role_Based_UI_Screens.md`. Every flow below is designed as the **ideal, most user-friendly experience** for that role's real-world job — it is **explicitly NOT a description of how the current web/mobile app works today**. Use this as the reference for redesigning the actual UI/UX going forward.

Each screen/functionality includes:
- A named, concrete real-life scenario (fictional Surat clinic staff/patients)
- An ideal step-by-step flow, written from scratch for usability — not constrained by existing code or UI
- A test-case table: happy path, edge cases, and explicit "must NOT be allowed" cases
- Cross-role handoffs (what this role hands to/receives from other roles)
- Cross-references to the specific `aurah_prd.md` section backing each business rule

## Table of Contents

1. [Owner / Admin](#owner--admin)
2. [Receptionist & Branch Manager](#receptionist--branch-manager)
3. [Doctor & Nurse / Clinical Assistant](#doctor--nurse--clinical-assistant)
4. [Treatment Technician & Pharmacy](#treatment-technician--pharmacy)
5. [Cashier / Accountant & CRM / Call Desk](#cashier--accountant--crm--call-desk)
6. [Patient Mobile App](#patient-mobile-app)

---



# Owner / Admin

# Aurah 360 ClinicOS — Owner / Admin Role: Ideal Flows & Test Cases

**Purpose of this document.** This is a redesign reference for the Owner/Admin role in Aurah 360 ClinicOS, a multi-branch skin/hair/laser clinic system in Surat. It is written **from first principles** — describing the most intuitive, real-world flow a clinic owner would want, not how today's app happens to be built. Every module in the Owner/Admin screen inventory is covered: Dashboard suite, Patient Management, Appointment, Doctors, Staff, Treatment, Pharmacy, Inventory, Billing, CRM, Reports, Masters, Communication, AI, Settings.

**Fictional persona used throughout:** **Nilesh Shah**, owner of Aurah 360 (2 branches today: Adajan and Vesu, Surat), with 2 doctors and ~15 staff. Where useful we also introduce **Dr. Priya Mehta** (dermatologist, works both branches), **Kaushal** (Branch Admin, Vesu), **Foram** (Receptionist, Adajan), and **Meera** (Accountant).

**PRD cross-references** use section numbers from `aurah_prd.md` (e.g. §16.6 Identity/Authentication, §11.3 Billing, §9 AI).

**Legend for test tables:** H = Happy path, E = Edge case, P = Permission/security case, X = "Must NOT be allowed" case, C = Cross-role handoff.

---

## Table of Contents

1. Dashboard Suite
2. Patient Management
3. Appointment
4. Doctors
5. Staff
6. Treatment
7. Pharmacy
8. Inventory
9. Billing
10. CRM
11. Reports
12. Masters
13. Communication
14. AI
15. Settings
16. Cross-Cutting Owner Rules (applies to every module)

---

## 1. Dashboard Suite

Covers: **Dashboard, KPI Dashboard, Revenue Dashboard, Branch Performance, Appointment Analytics, Treatment Analytics, Patient Analytics, Inventory Analytics, CRM Analytics, Notification Analytics.**

### 1.1 Real-life scenario

> It's 8:45 AM. Nilesh is about to leave for a 9:00 AM meeting with a landlord about a possible third branch. Before he leaves, he wants a 90-second read on "how did yesterday go across both branches" — revenue, no-shows, any stock or staff issue that needs his attention today.

**Ideal step-by-step flow:**

1. Nilesh opens the app on his phone. Because he's Owner, the **Home Dashboard** loads to an **"All Branches (Consolidated)"** view by default — not the last branch he happened to look at. A branch switcher chip (`All Branches ▾`) sits top-left, always visible, so he never has to hunt for it.
2. The very top of the dashboard is a **"Yesterday at a glance"** strip: total revenue, total patients seen, appointments booked vs. completed vs. no-show, and a single red/amber/green "Attention needed" badge. This answers his question before he scrolls.
3. If the badge is amber/red, tapping it jumps straight to the specific alert (e.g., "Vesu branch: 3 low-stock SKUs", "Adajan: cash close variance ₹450 pending owner review"). He does not have to go module-hunting.
4. He taps **Branch Performance** to compare Adajan vs. Vesu side-by-side (revenue, patient count, doctor utilization, treatment conversion) — this is the number he needs for the landlord meeting (proof branch 2 is profitable, to justify branch 3).
5. He taps into **Revenue Dashboard** briefly to see the revenue trend line (last 30/90 days) and payment-mode split, confirming collections match bookings (sanity check against fraud/leakage).
6. He glances at **Appointment Analytics** to see today's booked load per branch so he knows if either branch is overbooked before doctors arrive.
7. He does NOT need to open Treatment/Patient/Inventory/CRM/Notification Analytics right now — but each is one tap away from the same shell via a persistent left rail, so if the "Attention needed" badge had pointed there, he'd already be one click in.
8. He closes the app. Total time: under 2 minutes, zero re-typing, zero drilling through irrelevant charts (PRD §17.1: "no irrelevant charts").

### 1.2 What "ideal" looks like per sub-dashboard

| Dashboard | Ideal primary view | Drill-down |
|---|---|---|
| KPI Dashboard | 6–8 headline tiles (revenue, patients, appointments, conversion, dues, stock risk) with trend arrows vs. prior period | Tap tile → relevant detail dashboard |
| Revenue Dashboard | Trend line + branch/doctor/service/payment-mode breakdown, refunds & discounts called out separately | Tap a bar → underlying invoice list (permission-gated) |
| Branch Performance | Side-by-side comparison table/chart across all branches, with per-branch traffic-light health | Tap branch → that branch's full operational dashboard |
| Appointment Analytics | Funnel: booked → confirmed → checked-in → completed → no-show/cancelled, by branch/doctor/source | Tap stage → filtered appointment list |
| Treatment Analytics | Sessions ordered vs. completed, protocol utilization, device/room utilization, adverse-event count (flagged prominently, never buried) | Tap adverse-event count → adverse event log |
| Patient Analytics | New vs. returning, retention/revisit interval, inactive cohort, lifetime value bands | Tap cohort → CRM recall list handoff |
| Inventory Analytics | Stock value, near-expiry, low-stock count, fast/slow movers, wastage | Tap low-stock → Inventory > Low Stock screen |
| CRM Analytics | Lead pipeline funnel, source conversion %, campaign delivery health | Tap source → CRM > Leads filtered by source |
| Notification Analytics | Sent/delivered/read/failed by channel, opt-out trend, provider health | Tap "failed" → Communication > Notification Logs |

### 1.3 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner logs in, lands on consolidated dashboard for 2 branches with yesterday's data fully loaded | All tiles populated, "Attention needed" badge computed correctly, load < 2s (NFR-002) |
| 2 | H | Owner switches from "All Branches" to "Vesu only" | Every widget on the page re-filters consistently; URL/filter state is shareable without exposing patient identity (§17.7) |
| 3 | E | New branch (3rd branch) added mid-month with zero historical data | Branch Performance shows it with an explicit "No data yet" state, not a zero/blank that looks like an error |
| 4 | E | One branch's revenue feed lags due to a sync delay | Dashboard shows a visible "as of [timestamp]" freshness indicator per branch, not a silently stale number |
| 5 | E | Owner opens dashboard before any appointments exist for the day (very first login post-go-live) | Empty state explains "No data yet — data will appear as your branches use the system", not a crash or infinite spinner |
| 6 | P | Org Admin (not Owner) opens the same dashboard | Sees consolidated view only if explicitly granted; by default restricted per role config (§3, §16.1 minimum-necessary-access) |
| 7 | P | Owner attempts to view exact per-patient clinical detail from an Appointment Analytics drill-down | Drill-down stops at aggregate/operational level; "management summary access does not automatically grant unrestricted patient-level clinical access" (§14.3) |
| 8 | X | Owner tries to export raw patient-identifiable data directly from a dashboard chart without going through the controlled Reports export permission | Must NOT be allowed — dashboards are view-only insight surfaces; bulk export requires the separate "bulk export" permission and is audited (§3.1, §16.6 step-up) |
| 9 | C | Branch Admin flags a "cash variance" during their cash close (Billing module) | Owner's dashboard "Attention needed" badge surfaces it same-day; owner can approve/query the variance from the badge, closing the loop back to the Branch Admin |
| 10 | E | Two owners (Owner + delegated Org Admin) view dashboard simultaneously during a live cash-close | Both see consistent, transactionally correct numbers — no race condition between reads and Billing writes (NFR-004) |

---

## 2. Patient Management

Covers: **Patients, Add Patient, Patient Profile, Patient Timeline, Documents, Photos, Prescriptions, Treatments, Billing History, Communication History.**

### 2.1 Real-life scenario

> A regular patient, Rekha Patel, calls Nilesh directly (she knows him personally) upset about a billing discrepancy from her last visit. Nilesh needs to pull up her full record — appointments, treatments, bills, and communications — to resolve it himself, without wading through irrelevant clinical detail he shouldn't casually browse.

**Ideal step-by-step flow:**

1. From anywhere in the app, Nilesh taps the persistent global search / **Patients** icon and types "Rekha" or her mobile number. Results show masked-but-sufficient identity (name, masked mobile, MRN, last visit branch) with duplicate-candidate warnings if any (§5.2, §17.4 Patient search).
2. He opens her **Patient Profile** — a 360° view: summary header (MRN, age, branch, allergy/high-risk badges), and tabs for Timeline, Documents, Photos, Prescriptions, Treatments, Billing History, Communication History (§17.4 "Patient 360").
3. Because Nilesh is Owner (not her treating doctor), the profile defaults to an **administrative view**: he sees appointment/visit metadata, billing history, and communication history freely, but clinical notes/diagnosis/prescriptions show a **"Restricted clinical — view requires reason"** gate. If he taps in, a step-up prompt (re-enter MFA + reason: "Billing dispute investigation") logs the access (§16.2, §16.6 step-up, §16.8 audit: "sensitive view").
4. He goes straight to **Billing History**, finds the disputed invoice, sees the itemization, discount applied, payment mode, and the audit trail of who created/edited it.
5. He resolves it as a billing correction (issuing a credit note) via the Billing module — not by silently editing the old invoice (§11.3 controls: reversal, not overwrite).
6. He checks **Communication History** to see what WhatsApp/SMS she already received about this bill, so his callback doesn't contradict an automated message.
7. He calls Rekha back informed, resolves it, and the whole interaction — his sensitive-view access, the credit note, and his callback note — is now audit-traceable.

### 2.2 Add Patient — ideal flow

1. Reception normally does this, but Owner/Admin can register a patient (e.g., VIP walk-in, or fixing a data-entry issue).
2. Search first (mobile/MRN/name+DOB) to catch duplicates before creating a new record — duplicate candidates surface immediately with a "this might be the same person" prompt (§5.2).
3. Progressive minimum-first form: identity + contact + branch + source + consent — nothing else is mandatory to get a patient checked in fast (§5.1, §17.5 form rules — one question per row, minimal required fields).
4. Consents captured as separate toggles: data/record processing, communication, marketing, clinical photography — each independently revocable later (§16.3 consent catalogue).
5. Save creates MRN + timeline + pending intake tasks for nurse/doctor to complete later (§5.2 step 6).

### 2.3 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner searches "9825…" mobile number, patient exists at the other branch | Cross-branch match found, shown with branch context, no duplicate created |
| 2 | H | Owner opens Patient Profile → Billing History → issues credit note for a disputed charge | Credit note created with reason, linked to original invoice, original invoice remains immutable (§11.3, NFR-005) |
| 3 | E | Owner searches a name with Gujarati/Hindi transliteration variants ("Rekha"/"Rekhaben"/"रेखा") | Search tolerates spacing/case/transliteration and still finds the record (NFR-006) |
| 4 | E | Two staff simultaneously try to register the exact same new patient (walk-in at two counters) | System detects near-duplicate on save and forces a merge-review step rather than creating two MRNs (§5.2 point 5, NFR-004 concurrency) |
| 5 | P | Owner opens a patient's clinical notes/diagnosis tab without a documented reason | Step-up MFA + mandatory reason field required before restricted clinical content renders; access is logged (§16.6, §16.8) |
| 6 | P | Owner tries to view another branch's patient without being granted that branch's access | Blocked by default; "no other-branch access unless granted" (§3, ORG-004 access rule) |
| 7 | X | Owner attempts to permanently delete a patient record (e.g., "clean up test data") | Must NOT be allowed — no hard delete of patient/clinical/financial history; only deactivate/archive with audit trail; erasure only via the formal Data-Subject Rights case workflow with legal/clinical-integrity checks (§16.5, PRV-002) |
| 8 | X | Owner tries to silently edit a signed doctor's note from the Patient Profile to "fix a typo" | Must NOT be allowed — signed clinical records use addendum/amendment only, never silent overwrite, and only the authoring/authorized clinician can amend (§8.3 EMR-005, §16.10) |
| 9 | C | Owner escalates a billing dispute found in Patient Profile → Accountant (Meera) issues the actual refund | Owner's investigation note and the resulting refund both appear in the patient's audit trail, linked by a case/reference ID |
| 10 | E | Patient has photos marked "hidden, not released" | Owner sees a "Photos exist — release status: hidden" indicator but photo pixels are gated behind the same clinical-photo access permission (view vs. download separate) (§7.2, §16.4) |
| 11 | E | Patient record has an unresolved Front Desk Handoff Note (e.g., "immediate triage alert" flagged by reception) that a doctor never acknowledged | Owner sees this flagged prominently on the profile header, not buried in a tab, since it is operationally urgent (§5.3) |

---

## 3. Appointment

Covers: **Appointment Calendar, Daily Schedule, Weekly Calendar, Queue Monitor, Walk-in Queue, Pending Approvals, Reschedule Requests.**

### 3.1 Real-life scenario

> Dr. Priya Mehta is double-booked on paper for Thursday — she's supposed to be at Adajan 4–6 PM but a patient app request also confirmed a Vesu slot at 5 PM. Kaushal (Branch Admin, Vesu) flags it to Nilesh because he can't resolve doctor-level conflicts himself. Nilesh needs to see the whole week across both branches, fix the conflict, and make sure the affected patient isn't just silently dropped.

**Ideal step-by-step flow:**

1. Nilesh opens **Appointment Calendar**, defaulting to **All Branches**, **Week view**, filtered to Dr. Priya Mehta only (filter chips: branch, doctor, service, status, source — §6.4).
2. He immediately sees the overlapping blocks rendered with Dr. Priya's consistent color and each branch's badge, so the conflict is visually obvious without reading fine print (§4.2, §6.4).
3. He opens the event drawer on the newer (Vesu 5 PM) booking — sees patient summary, contact preference, and how it was booked (patient app, auto-confirmed because it matched an "available" slot the roster hadn't yet blocked).
4. Because this is a doctor-roster-vs-booking conflict (not just a UI overlap), the ideal system already caught it at booking time — travel-buffer + global collision check should have prevented the second confirmation (§6.2). Since it still happened (e.g., roster was edited after the booking existed), the system shows an **"Impacted appointment"** banner requiring resolve: reassign, reschedule, or override with audit (§4.2 roster-change-after-confirmed-booking rule).
5. Nilesh picks "Reschedule" → system shows Dr. Priya's next real availability at Vesu → he picks a slot → a preview of the patient notification is shown before saving (§6.4 "preview patient notification before save").
6. He confirms; the patient automatically receives a WhatsApp/SMS explaining the change with a reschedule-confirm action — generic wording only, no clinical detail (§12.2, §7.2 high-risk rule).
7. He checks the **Pending Approvals** tab to make sure no other "custom time" requests from the patient app are sitting unresolved before end of day.
8. He glances at **Queue Monitor** for both branches to confirm nobody physically waiting right now is affected.

### 3.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner filters calendar to "All branches, Dr. Priya Mehta, this week" | Consistent doctor color + branch badges across all branches' events in one view (§6.4) |
| 2 | H | Owner resolves a doctor double-booking via reschedule with patient preview | Slot revalidated server-side, patient notified with new time only (old reminder job cancelled/deduplicated, §18.3) |
| 3 | E | Owner tries to drag-drop a confirmed appointment onto a slot where the room is under cleaning-buffer | Drag/drop requires server revalidation; blocked with a clear conflict message, not silently allowed (§17.7) |
| 4 | E | Walk-in queue token requested when the branch has hit configured daily capacity | System either queues with an honest "over-capacity, expect delay" flag or blocks per branch policy — never silently overbooks (§6.2 configurable overbook permission) |
| 5 | E | A patient's WhatsApp reschedule request lands exactly when Owner is manually rescheduling the same appointment | Locking/idempotency ensures only one change commits; the other actor sees a conflict/refresh state, not data loss (§6.2, APT-008, NFR-004) |
| 6 | P | Owner attempts to view the Queue Monitor's public/waiting-room display mode | Shows token/initials only — never full patient name or diagnosis, even to Owner, when in "public display" mode (§6.5, §17.2) |
| 7 | X | Owner tries to force-confirm a patient-requested "custom time" slot that violates a doctor's leave block, without going through the override-with-reason path | Must NOT be allowed silently — any override of leave/travel/roster constraints requires an explicit reason and is audited (§4.2, §16.8 "conflict override") |
| 8 | X | Owner attempts to delete a cancelled/no-show appointment record entirely from history | Must NOT be allowed — cancellation/no-show reason, actor, time are retained permanently for audit and analytics (§6.3, §16.8) |
| 9 | C | Branch Admin (Kaushal) flags a doctor conflict he cannot resolve at his permission level | Escalates to Owner/Org Admin queue (e.g., a "needs owner attention" flag on Pending Approvals); Owner resolution is visible back to Kaushal |
| 10 | E | Owner views Weekly Calendar during a period when a branch is on a declared holiday | Calendar clearly renders the holiday/closed state for that branch rather than showing it as merely "no appointments" |
| 11 | E | Owner opens Reschedule Requests list when zero requests are pending | Clean empty state: "No pending reschedule requests" with a shortcut back to the calendar, not a blank table |

---

## 4. Doctors

Covers: **Doctors List, Doctor Profile, Doctor Schedule, Doctor Leave, Doctor Availability.**

### 4.1 Real-life scenario

> Dr. Priya Mehta wants to reduce her Vesu days from 3 to 2 per week starting next month and take a 5-day leave for a family wedding. Nilesh needs to update her roster clinic-wide, make sure existing bookings in the affected window are handled — not silently orphaned — and confirm her total capacity doesn't create a coverage gap.

**Ideal step-by-step flow:**

1. Nilesh opens **Doctors List** → taps **Dr. Priya Mehta** → **Doctor Profile**, confirming her specialty, branch privileges (both branches), consultation types/durations and current roster at a glance.
2. He opens **Doctor Schedule**, sees her recurring weekly pattern (e.g., Mon/Wed/Fri Vesu, Tue/Thu Adajan) rendered as a simple weekly grid, not raw text.
3. He edits the recurring roster to remove one Vesu day starting a future effective date (not retroactive) — the system asks "this change affects future bookings only, or do you want to review existing bookings in the transition week?" (§4.2 roster-change rule).
4. Any already-confirmed appointment that falls in a now-removed slot is shown in an **"Impacted appointments"** list with one-click reassign/reschedule per patient, each triggering proper patient notification.
5. Separately, he goes to **Doctor Leave**, adds the 5-day leave block with dates and a reason (optional, internal), which automatically blocks that window from ever showing as available in the booking engine — no separate manual calendar block needed.
6. He checks **Doctor Availability** (the resulting computed slots after roster ∩ branch hours ∩ leave ∩ existing bookings) to visually confirm no bookable gap-day looks broken.
7. Because Vesu now has one less day of Dr. Priya's time, the system optionally nudges Nilesh: "Vesu will have reduced consult capacity on Wednesdays going forward — consider adjusting other doctor schedules" (a helpful non-blocking insight, not mandatory).

### 4.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner edits Dr. Priya's recurring roster effective a future date | Change applies prospectively; historical/past appointments unaffected (§4.2, ORG-006 masters effective-dating) |
| 2 | H | Owner adds a 5-day leave block | Booking engine immediately excludes those dates/times from availability everywhere she's rostered, across both branches (§6.2 availability formula) |
| 3 | E | Owner tries to add leave that overlaps 6 already-confirmed appointments | System shows the impacted list and requires explicit reassign/reschedule/override per appointment before leave is finalized — cannot "leave and forget" (§4.2) |
| 4 | E | Doctor is rostered at Branch A 5–6 PM and Branch B 6:15 PM (10 min travel reality vs. 15 min configured buffer) | Global collision + travel-buffer check flags this as unrealistic back-to-back and blocks/warns before save (§4.2, §6.2) |
| 5 | E | New doctor onboarded with zero prior schedule | Doctor Availability screen shows a clean "No availability configured yet" state guiding Owner to set up a roster, not a confusing blank calendar |
| 6 | P | Org Admin attempts to edit a doctor's signature/registration number | Should require elevated/Owner-level or medical-lead-approved permission since this affects prescription legitimacy — not a routine edit (§16.10 clinical governance) |
| 7 | X | Owner tries to delete a doctor profile who has historical signed encounters | Must NOT be allowed — deactivate only; historical authored clinical records must remain attributable and intact (§16.6 termination rule, NFR-005) |
| 8 | X | Owner tries to reassign a doctor's already-signed prescription to another doctor's name | Must NOT be allowed under any circumstance — authorship of signed clinical records is immutable (§8.3, §16.10) |
| 9 | C | Doctor requests leave via her own portal (self-service) | Enters Owner/Branch Admin approval queue rather than auto-applying, since leave affects booked patients and coverage planning |
| 10 | E | Doctor Schedule view for a doctor who works 3 different branches with different hours each | Weekly grid clearly separates by branch badge/color per block, not merged into one ambiguous line |

---

## 5. Staff

Covers: **Staff List, Add Staff, Roles, Permissions.**

### 5.1 Real-life scenario

> Nilesh is hiring a new receptionist, Foram, for the Adajan branch, and separately needs to demote a treatment technician (Ravi) who is going on long leave, to a "view-only" temporary access so he can't accidentally act on patients while away but the account isn't deleted.

**Ideal step-by-step flow (Add Staff):**

1. Nilesh opens **Staff List**, taps **Add Staff**.
2. Progressive form: name, mobile, email, designated branch(es), role template (Receptionist), start date. Role template pre-fills a sensible permission bundle instantly — Nilesh doesn't have to build permissions from scratch (§3 "Role is only a starting template").
3. He reviews the auto-applied **Permissions** for Receptionist (search/register, booking, check-in, documents, invoice entry) and confirms Foram should NOT get diagnosis/prescription/photo-export rights (already excluded by template, per §3 core-access table) — he doesn't need to manually strip anything, reducing risk of over-provisioning.
4. He sets MFA requirement — since Receptionist is not a "privileged role" it may be configurable, but Owner can mandate MFA for all staff at Adajan if he wants stricter policy (§16.6).
5. Save creates the account; system sends Foram a secure first-login/invite (not a plaintext password in chat) — Owner never sees or sets her password directly (prohibited action: entering/creating credentials on someone's behalf).
6. Foram's account is now visible in Staff List with status "Invited — pending first login."

**Ideal step-by-step flow (Adjust access for leave):**

1. Nilesh opens Ravi's staff profile from **Staff List**.
2. Rather than deleting the account, he uses a **"Suspend / Temporary Access Change"** action: sets status to "On Leave" which automatically revokes active sessions and removes him from the live treatment queue rotation, while preserving his authored history (§16.6 termination principle, applied proportionally to leave).
3. He reassigns Ravi's pending treatment-queue items to another technician so patients aren't stuck.
4. When Ravi returns, Owner reactivates the account; historical audit trail is untouched throughout.

### 5.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner adds new Receptionist via role template | Correct default permission bundle applied instantly; account status "Invited" | 
| 2 | H | Owner suspends a staff member going on leave and reassigns their queue | Sessions revoked immediately, queue items reassigned, history preserved (§16.6) |
| 3 | E | Owner tries to add a staff member with a mobile number already used by another active staff account | Blocked with a clear duplicate-account message, not a silent overwrite |
| 4 | E | Owner customizes a role's permission bundle (e.g., gives one receptionist invoice-void rights) | Custom permission set is saved as an override tied to that individual, clearly labeled as "customized from template" so it's auditable and not confused with the base role later |
| 5 | P | A Branch Admin attempts to create a new Owner-level account | Blocked — role/permission changes above one's own scope require Owner/Org Admin and step-up authentication (§16.6 step-up, SEC-002) |
| 6 | P | Owner attempts to grant themselves "break-glass" clinical photo access without a reason | Blocked — break-glass requires reason, recent MFA, short expiry, and triggers a prominent audit + alert even when the requester is the Owner (§3.1) |
| 7 | X | Owner tries to permanently delete a staff account that has authored signed clinical notes, invoices, or stock movements | Must NOT be allowed — deactivate/terminate only; authored history must remain attributable (§16.6 "Termination: preserve authored audit history") |
| 8 | X | Owner tries to bulk-change 20 staff members' roles in one action without individual review | Should require explicit confirmation per meaningful change and is fully audited as a "role change" event; bulk change is not silently mass-applied without visibility into who's affected (§16.8 identity/access audit family) |
| 9 | C | Owner changes a Treatment Technician's permitted protocols/skills | Treatment module immediately respects the updated skill list — technician can no longer be assigned to a protocol requiring a credential they no longer hold (§4.3 Staff skill, §10.3) |
| 10 | E | Owner views Roles/Permissions screen and tries to see exactly what a "Receptionist" role can and cannot do before assigning it | Clear, plain-language permission matrix (not raw technical flags) so Owner can decide confidently (§17.1 usability goal) |

---

## 6. Treatment

Covers: **Treatment Dashboard, Treatment Plans, Treatment Sessions, Protocol Management, Package Management.**

### 6.1 Real-life scenario

> Nilesh's medical lead wants to update the laser-hair-reduction protocol to add a mandatory patch-test step that was previously optional, following a near-miss adverse event at a competitor clinic reported in the news. Nilesh needs to publish this protocol update clinic-wide without breaking sessions already in progress, and separately wants to check how many patients are mid-way through a "Package of 6" that might be affected.

**Ideal step-by-step flow:**

1. Nilesh opens **Protocol Management**, finds "Laser Hair Reduction — Full Body," opens it for edit.
2. Because protocols are versioned (§10.2), he doesn't edit the live version directly — he creates a **new version** (v3), adds "Patch test: mandatory, minimum 24 hours prior" as a pre-step, and sets an effective date.
3. System clearly shows: "Sessions already completed keep their original protocol version (v2) in history; only sessions started after [effective date] will require this new patch-test step" (§10.2 versioning rule, §16.10).
4. He requires medical-lead sign-off before v3 goes live (a configurable approval gate) — this is a clinical governance change, not a routine text edit (§16.10 "approved, versioned and effective-dated by clinic medical lead").
5. He publishes; **Treatment Dashboard** across both branches will now show "Waiting Consent/Patch Test" as a blocking status on any new order under this protocol until the patch test is recorded (§10.3 statuses).
6. He then opens **Package Management**, filters "Package of 6 — Laser Hair Reduction," sees active packages and how many sessions each patient has consumed vs. remaining, confirming none are stuck mid-package because of the protocol change (protocol change doesn't retroactively invalidate consumed sessions).
7. He checks **Treatment Sessions** log briefly for any recent adverse-event flags — these must never be hidden or auto-resolved by a billing/completion action (§10.3 "Adverse event... cannot be hidden by completing billing").

### 6.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner publishes protocol v3 with new mandatory patch-test step, effective a future date | New orders after that date enforce patch test as a hard-stop; old in-progress sessions keep v2 rules (§10.2, §16.10) |
| 2 | H | Owner reviews Package Management for a specific package type and sees usage-vs-remaining per patient | Accurate session counts, no double-counting a cancelled/reversed session (§10.4) |
| 3 | E | A treatment session is "In Progress" under v2 at the exact moment v3 goes live | Session-in-progress is unaffected; system does not retroactively force a mid-session protocol swap |
| 4 | E | Owner tries to publish a protocol version with a missing mandatory field (e.g., no aftercare template) | Blocked with a specific validation message, not a silent partial save (§17.5 validation rules) |
| 5 | P | A Treatment Technician attempts to edit protocol parameters directly from the treatment queue screen | Blocked — technicians see the versioned protocol read-only; only authorized protocol-management roles can change it (§10.3 "staff cannot edit signed doctor order," extended to protocol integrity) |
| 6 | X | Owner attempts to mark a recorded adverse event as resolved/hidden by simply completing the linked invoice | Must NOT be allowed — adverse event workflow is independent of billing completion and requires its own closure with severity, escalation, and clinician sign-off (§10.3, §16.10) |
| 7 | X | Owner tries to retroactively change the protocol version recorded against an already-completed historical session (e.g., "to make our records look consistent") | Must NOT be allowed — completed sessions permanently retain the protocol version actually used at the time (§10.2 "Completed sessions keep the used protocol version") |
| 8 | C | Doctor orders a treatment; protocol requires device+room+operator skill that isn't currently available at that branch | Order is blocked/queued with a clear resource-gap message rather than silently accepted, and Branch Admin/Owner visibility is raised if this recurs (§10.1 step 2–3) |
| 9 | E | Owner reverses a consumed package session (patient disputes it was actually done) | Requires approval + audit trail, cannot be a casual undo click (§10.4 "reversal requires approval/audit") |
| 10 | E | Owner views Treatment Dashboard when a device is in "Maintenance/Blocked" state | Any protocol requiring that device shows a blocked/unavailable status rather than allowing a reservation that will fail later (§10.3) |

---

## 7. Pharmacy

Covers: **Pharmacy Dashboard, Medicine Master, Products, Dispense Medicines, Sales.**

### 7.1 Real-life scenario

> Nilesh notices from his dashboard that Adajan's pharmacy sold an unusually high quantity of a particular cosmeceutical last week — he wants to check if it was legitimate prescription-linked dispensing or if there's a control gap allowing free-form direct sale without oversight, since that affects both stock accuracy and clinical safety (prescription-linked vs. self-directed purchase).

**Ideal step-by-step flow:**

1. Nilesh opens **Pharmacy Dashboard**, sees the daily sales summary flagged with an anomaly indicator on that SKU.
2. He drills into **Sales**, filters by product and date range, and sees each transaction tagged clearly as either "Prescription-linked" (with the prescribing doctor and patient) or "Direct sale" (permitted OTC-type product, with the dispensing staff member) — never ambiguous (§11.1 "Prescription is a clinical order; pharmacy fulfillment records actual batch/quantity separately").
3. He confirms most were prescription-linked and legitimate; one was a direct sale by a staff member who technically shouldn't have that permission — he escalates that to Staff > Permissions.
4. He checks **Medicine Master** to confirm the product's pricing, GST/HSN, and unit are correctly configured (misconfigured tax could also cause reporting anomalies) — but changes here require accountant verification, so he flags it to Meera rather than editing tax fields himself (§11.1 "Tax/accounting treatment is... accountant-verified").
5. He checks **Products** master to see the linked batches, confirming FEFO (first-expiry-first-out) was followed on the dispensing.
6. He does not personally use **Dispense Medicines** (that's operational pharmacy staff's job) but opens it read-only to see the live prescription queue and confirm no backlog is building at either branch.

### 7.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner filters Sales by product/date and sees prescription-linked vs. direct-sale split clearly labeled | Every sale traceable to either a signed prescription or an authorized direct-sale permission holder (§11.1) |
| 2 | H | Owner reviews Medicine Master pricing discrepancy and routes it to Accountant for correction rather than editing directly | Change request logged; accountant approval required before price/tax fields update (§11.1) |
| 3 | E | A dispensing attempt is made against a prescription that requires a substitution (different brand, same generic) | System requires explicit "authorized substitution" flag with reason before completing — cannot silently swap brand (§11.1 "substitution is separately authorized") |
| 4 | E | Batch selected for dispensing is expired | Blocked at point of dispensing regardless of who initiates it, including Owner using an admin override screen (§11.2 "expired-batch block") |
| 5 | P | Owner attempts to directly edit a signed prescription's medicine/dose from the Pharmacy module | Must NOT be allowed — "Pharmacy cannot change signed prescription" (§3 role restriction, §11.1) — even Owner must route through the doctor for a clinical change |
| 6 | X | Owner tries to delete a completed sale/dispensing record to "clean up a mistake" | Must NOT be allowed — must be corrected via a return/adjustment entry with reason and audit, never a silent delete (stock and payment entries use reversal, §3.1) |
| 7 | X | Owner attempts to dispense a controlled/prescription item as a "direct sale" to bypass doctor sign-off | Must NOT be allowed even by Owner override — clinical safety control, not merely a business rule; system should hard-block or require documented clinical exception (§11.1, §16.10) |
| 8 | C | Pharmacy staff flags a near-expiry batch; Owner sees it surfaced on Inventory Analytics and decides on a clearance sale/return-to-vendor | Cross-links cleanly between Pharmacy Dashboard, Inventory Analytics, and Vendor/Purchase masters |
| 9 | E | Two pharmacy counters attempt to dispense the last unit of a batch simultaneously (at two branches, but same central stock pool if shared) | Locking prevents negative stock; second attempt sees "no longer available, next batch: …" (§11.2 negative-stock prevention, NFR-004) |

---

## 8. Inventory

Covers: **Inventory Dashboard, Product Master, Vendor Master, Purchase, GRN, Stock, Transfer, Expiry, Low Stock.**

### 8.1 Real-life scenario

> Vesu branch is running low on a laser-treatment consumable, but Adajan has excess. Nilesh wants to approve an inter-branch transfer instead of placing a fresh purchase order, to save money — and wants to review the vendor's last purchase terms before deciding whether to also renegotiate pricing.

**Ideal step-by-step flow:**

1. Nilesh sees the alert on **Inventory Dashboard** / **Low Stock** widget: "Vesu: Consumable X — 3 units left, reorder level 10."
2. He checks **Stock** screen filtered to that SKU across both branches — sees Adajan has 40 units, well above its own reorder level.
3. Rather than raising a **Purchase** order, he initiates a **Transfer**: Adajan → Vesu, quantity 15, with a reason. The transfer workflow is request → approve → dispatch → in transit → receive, with both branches reconciling stock counts (§11.2 Transfer).
4. He approves it himself (as Owner) since it's urgent; Adajan's Branch Admin gets a dispatch task, and Vesu's staff get a "goods in transit, expect receipt" notice.
5. Once Vesu confirms receipt (GRN-like reconciliation for internal transfer), stock ledgers update atomically at both branches — an immutable movement ledger entry is created (§11.2 "Immutable stock movement ledger").
6. Separately, he opens **Vendor Master** for that consumable's supplier, reviews last **Purchase** order's landed cost and payment terms, and makes a note to renegotiate given rising order frequency.
7. He checks **Expiry** dashboard across both branches to make sure the transferred stock isn't near-expiry (transferring soon-to-expire stock just relocates the wastage risk rather than solving it).

### 8.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner approves an inter-branch transfer instead of a new purchase | Stock ledgers update atomically at both branches on receipt confirmation; movement is logged immutably (§11.2 INV-002) |
| 2 | H | Owner reviews Vendor Master purchase history before a renegotiation | Full purchase/GRN history with landed cost visible per vendor |
| 3 | E | Transfer is dispatched from Adajan but Vesu never confirms receipt (goods lost/delayed) | Transfer remains visibly "In Transit" indefinitely with an aging indicator — never silently auto-closes as received |
| 4 | E | Owner attempts to transfer more units than currently in stock at the source branch | Blocked — negative-stock prevention applies to transfers just like sales (§11.2) |
| 5 | E | GRN is received with a quantity different from the PO (partial delivery) | System supports partial GRN with clear variance shown, not forcing an all-or-nothing receipt |
| 6 | P | A Branch Admin at Vesu tries to approve a transfer they initiated themselves without a second approver (self-approval) | Depending on configured control, self-approval of your own transfer request should be flagged or blocked to prevent stock manipulation — Owner should be able to configure a maker-checker rule (§11.2 controls, "unusual adjustment approval") |
| 7 | X | Owner attempts to manually increase stock count in the Stock screen without a corresponding Purchase/GRN/Transfer/Adjustment record ("just fix the number") | Must NOT be allowed — every stock change must be a recorded, reasoned movement type (adjustment requires approval + reason), never a silent count edit (§11.2, NFR-005) |
| 8 | X | Owner tries to dispense/sell an expired batch by manually overriding the expiry block "just this once" | Must NOT be allowed — expired-batch block is a hard control (§11.2 "expired-batch block"), clinical/consumer-safety issue, not a business convenience |
| 9 | C | Pharmacy raises a Purchase request; Owner approves the PO; Vendor delivers; Pharmacy/Branch Admin completes GRN | Full chain visible end-to-end from Owner's Inventory Dashboard without needing to ask each role separately for status |
| 10 | E | Owner views Expiry dashboard consolidated across branches for a slow-moving high-cost item | Sorted by days-to-expiry and value-at-risk so the highest-cost risk surfaces first, not just alphabetically |

---

## 9. Billing

Covers: **Billing Dashboard, Invoice, Payments, Due Payments, Refunds, Cash Closing.**

### 9.1 Real-life scenario

> At month-end, Nilesh reviews cash closing across both branches. Vesu's cashier reports a ₹450 shortfall at cash close. Separately, a patient is requesting a ₹5,000 refund for an unused package that exceeds the front-line discount/refund authority of the accountant, so it's escalated to Nilesh for approval per the clinic's approval-threshold policy.

**Ideal step-by-step flow:**

1. Nilesh opens **Cash Closing**, filtered to Vesu, sees the day's opening cash, collections by mode, expected vs. counted, and the ₹450 variance flagged in amber with the cashier's note ("possibly a change-giving error").
2. He can either accept the variance with a reason (small, explainable) or request the cashier re-verify — either action is logged with an approver (§11.3 "Cash close: variance and approver").
3. He opens **Refunds**, sees the pending ₹5,000 refund request sitting in an approval queue because it exceeds the accountant's discount/refund threshold (§11.3 "Discount/void/refund approval threshold, mandatory reason and audit").
4. He reviews the linked package/invoice, confirms the unused-session balance, approves the refund with a reason ("goodwill, package underused due to clinic schedule change"), and the system creates a **credit note / reversal** — never a silent edit of the original invoice (§11.3 controls).
5. He checks **Due Payments** dashboard to see aging dues across both branches, useful for deciding whether to nudge CRM/reception to collect outstanding balances.
6. He glances at **Billing Dashboard** for the consolidated month-end revenue, discount, and refund totals to sanity-check against Revenue Dashboard numbers (shared metric dictionary, §14.3 "Shared metric dictionary prevents different dashboards calculating the same KPI differently").

### 9.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner approves a refund above accountant's threshold with a documented reason | Refund processed as a reversal/credit note linked to original invoice; approver, reason, and timestamp audited (§11.3, §16.8 finance/stock audit) |
| 2 | H | Owner reviews and accepts a small cash-close variance with a reason | Variance recorded, cash close finalized, both cashier and approver identity retained |
| 3 | E | A refund request is submitted for an invoice that was already fully refunded once | System blocks a duplicate refund on the same line item / warns clearly, doesn't allow double-refunding |
| 4 | E | Discount is applied that exceeds the pre-configured maximum discount % for that service | Requires the same approval escalation path as refunds — mandatory reason + Owner/authorized approval (§11.3) |
| 5 | E | Payment is split across cash + UPI + a partial due balance | Invoice correctly tracks multiple modes and remaining due; no mode silently overwrites another (§11.3 split/partial) |
| 6 | P | An Accountant attempts to approve their own refund request that exceeds their threshold | Must NOT be allowed — self-approval above threshold is blocked; escalates to Owner/Branch Admin as configured (maker-checker) |
| 7 | X | Owner (or anyone) attempts to edit a finalized invoice's line items directly after payment is recorded, instead of issuing a credit note/adjustment | Must NOT be allowed — signed/paid invoices are immutable; corrections use credit note or adjustment workflow (§11.3, NFR-005) |
| 8 | X | Owner attempts to close a cash register with a variance by simply changing the "counted" figure to match "expected" without a note | Must NOT be allowed — variance must be recorded as-is with a reason; the app should not let the counted figure be silently altered to hide a discrepancy (§11.3, audit integrity) |
| 9 | C | Accountant (Meera) submits a refund that exceeds her approval limit | Owner receives a specific "pending your approval" queue item (not lost in general notifications), approves/rejects, and Meera sees the outcome and can process accordingly |
| 10 | E | Owner views Billing Dashboard mid-day while transactions are actively being recorded at both branches | Numbers update consistently without double-counting an in-flight (not-yet-committed) transaction |
| 11 | E | A patient disputes a bill for a treatment session that was later reversed for a package-usage correction (see Treatment §6.2 test 9) | Billing Dashboard/invoice reflects the corrected package usage and reversed billing item consistently, no orphaned charge |

---

## 10. CRM

Covers: **Dashboard, Leads, Recall Patients, Campaigns, Referrals, Feedback, Reviews, Offers.**

### 10.1 Real-life scenario

> Nilesh wants to launch a Diwali offer for laser hair reduction packages, but only to patients who've consented to marketing (not just service reminders), and wants to check how well last quarter's Instagram ad campaign actually converted into paying patients before deciding how much more ad budget to allocate.

**Ideal step-by-step flow:**

1. Nilesh opens **CRM Dashboard**, sees the lead-pipeline funnel (New Lead → Contacted → Appointment Requested → Booked → Visited → Treatment Converted → Lost) segmented by source.
2. He clicks into **Referrals**/source breakdown for "Instagram Ad" specifically, sees conversion % from lead to Treatment Converted, and cost-per-conversion if ad spend is tracked — this tells him whether to increase Instagram budget.
3. He opens **Leads**, filters "Lost/Not Interested" from Instagram to understand drop-off reasons logged by the call desk (e.g., "price too high," "wrong location") — informing whether the offer should include a discount.
4. He goes to **Offers**, creates a new offer: title, image, description, validity window, branch/service relevance, terms, and a booking CTA (§12.5 Offer board).
5. Before publishing, he sets audience targeting to only patients/leads with **marketing consent = yes** — the system enforces this automatically; he cannot accidentally blast it to someone who only consented to appointment reminders (§12.4 "appointment consent does not automatically authorize promotions").
6. He checks **Recall Patients** to see if any lapsed patients (haven't visited in 6+ months) might be worth including in this campaign specifically, separate from new leads.
7. He reviews recent **Feedback** and **Reviews** to make sure there's no unresolved complaint that would make an active marketing push look tone-deaf timing-wise (e.g., a recent adverse-event complaint should pause promotional contact to that specific patient, even if not to the whole list).

### 10.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner creates a Diwali offer targeted only to marketing-consented audience | Non-consented leads/patients excluded automatically from the send list; system doesn't allow overriding this via a "select all" (§12.4) |
| 2 | H | Owner reviews source-conversion for Instagram Ads over last quarter | Funnel numbers match underlying Leads/Appointments data (shared metric dictionary, §14.3) |
| 3 | E | A lead has no source tagged (data entry gap) | Shown explicitly as "Unknown/Untagged" bucket in analytics rather than silently excluded or miscategorized as "Other" |
| 4 | E | Patient previously opted out of marketing, then later re-opts in | New consent event recorded with timestamp/method; campaign eligibility updates going forward without needing manual list editing (§12.4 withdrawal history) |
| 5 | E | Owner tries to launch a campaign referencing a specific patient's clinical detail in the message copy (e.g., a templated message pulling in "acne treatment" for personalization) | System should restrict marketing message content to generic/service-level text, not expose diagnosis; any personalization must stay within approved non-clinical fields (§12.4, §7.2 high-risk rule extended to marketing) |
| 6 | P | CRM/Call Desk staff attempts to view a patient's clinical details from within a Lead record | Blocked — "Marketing view excludes clinical details" (§3 CRM/Call Desk restriction) |
| 7 | X | Owner attempts to send a promotional WhatsApp/SMS to a patient who has explicitly opted out of marketing, using the "service reminder" template category to bypass the opt-out | Must NOT be allowed — suppression must apply across all campaign tools regardless of template category used to route around it (§12.4 "suppression applies across campaign tools") |
| 8 | X | Owner tries to merge a public review-request campaign with an internal complaint-escalation case to "manage the narrative" (e.g., suppress a public review request from a patient who filed a complaint, without a legitimate service reason) | Should NOT be silently automatic — "review-request" and "complaint escalation" are explicitly kept separate processes (§12.5 "complaint escalation is separate from public-review request"); any suppression must be reasoned/policy-based, not ad hoc |
| 9 | C | Recall Patients list is generated from Patient Analytics' "inactive cohort" | Owner can push a filtered cohort directly into a Recall campaign or CRM worklist without re-exporting/re-uploading a list manually |
| 10 | E | A referral code is used by a walk-in patient who claims to be referred by an existing patient, but the referrer isn't in the system | Owner/reception can capture the referral as free text pending verification, with the system flagging it as unverified rather than silently crediting a referral bonus |

---

## 11. Reports

Covers: **Appointment Reports, Revenue Reports, Doctor Reports, Patient Reports, Inventory Reports, Pharmacy Reports, Treatment Reports, CRM Reports, Audit Reports.**

### 11.1 Real-life scenario

> Nilesh's accountant asks for a consolidated monthly revenue report by branch and payment mode for tax filing, and separately, a potential investor evaluating a stake in the clinic has asked for a "doctor productivity" report. Nilesh also, as part of quarterly governance, needs to pull an Audit Report to confirm no unauthorized role changes or break-glass access happened last month.

**Ideal step-by-step flow:**

1. Nilesh opens **Reports**, selects **Revenue Reports**, sets filter: date range = last month, branch = All (consolidated), group by = branch + payment mode.
2. The report builder shows the exact metric definitions used ("Revenue = invoiced amount net of discounts and refunds, excluding pending dues") and the generation timestamp, so there's no ambiguity when handing it to the accountant (§14.3 "Filter state, timezone, generation time and metric definition are visible on export").
3. He exports as XLSX — this is a separate, audited permission from on-screen viewing (§14.3 "On-screen view and CSV/XLSX/PDF export use separate permissions; sensitive exports are audited").
4. For the investor's "Doctor Reports" request, he generates per-doctor productivity (consultations, treatment conversion, revenue contribution) but does **not** include any patient-identifiable clinical data — the report is designed to be safely shareable outside the clinic's immediate operational team.
5. Because this report has more than a normal row count / is a heavier query, it runs **asynchronously** and Nilesh gets a notification with an expiry-limited download link rather than the browser hanging (§14.3 "Large reports run asynchronously and provide expiry-limited download").
6. He opens **Audit Reports**, filters to "Role/Permission changes" and "Break-glass access" for the last quarter, confirming everything logged has a legitimate matching reason and no orphaned/unexplained event exists.
7. He notes one break-glass event by a Branch Admin during a night emergency and confirms it auto-notified him at the time (per §3.1 "break-glass requires... prominent audit and owner/privacy alert") — closing the loop that the control worked as intended.

### 11.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner generates consolidated Revenue Report by branch + payment mode with visible metric definitions | Export includes filter state, generation timestamp, and metric glossary; matches Billing Dashboard numbers exactly (§14.3) |
| 2 | H | Owner generates Doctor Report for external (investor) sharing | No patient-identifiable clinical data included; aggregate-only fields |
| 3 | H | Owner runs Audit Report for role changes and break-glass events over a quarter | Every event shows actor, timestamp, branch, reason, and result; nothing missing or redacted without explanation |
| 4 | E | A report is requested for a date range spanning a period before a branch existed | Report correctly shows zero/no-data for that branch in that period rather than an error or a misleading zero that looks like "bad performance" |
| 5 | E | Two large reports (e.g., full-year Inventory Report and full-year CRM Report) are queued simultaneously | Both process asynchronously without blocking the UI; Owner is notified individually per completion |
| 6 | P | A Branch Admin attempts to export a consolidated (all-branch) Revenue Report | Blocked or restricted to their own branch scope unless explicitly granted wider access (§3 Branch Admin restriction, §14.3 authorized branch selection) |
| 7 | P | Owner attempts to view an Audit Report entry's underlying full sensitive payload (e.g., full clinical note content behind a "sensitive view" audit line) | Audit shows metadata (who/when/what action) but "audit text avoids storing full sensitive payloads" (§16.8) — Owner cannot use the audit log itself as a backdoor to bypass normal clinical-view permission gates |
| 8 | X | Owner attempts to edit or delete an entry in the Audit Report ("this log entry is embarrassing, remove it") | Must NOT be allowed under any circumstance — "Audit records are append-oriented, tamper-evident" (§16.8); even Owner cannot edit/delete audit history |
| 9 | X | Owner tries to export a Patient Report containing full clinical detail (diagnosis, treatment specifics) without the sensitive-export permission separately granted | Must NOT be allowed by default — sensitive exports are a distinct, audited permission, not bundled with general reporting access (§14.3, §16.2) |
| 10 | C | Accountant requests a specific report Owner doesn't normally look at (e.g., Pharmacy margin report) | Owner can grant a scoped, time-bound reporting permission rather than sharing their own full Owner login — supports least-privilege delegation (§16.6 service accounts / least scopes principle applied to human delegation too) |
| 11 | E | Owner tries to compare two custom date ranges (e.g., this Diwali vs. last Diwali) that don't align to calendar months | Report builder supports arbitrary custom ranges, not just fixed month/quarter presets |

---

## 12. Masters

Covers: **Branches, Services, Consultation Types, Treatment Categories, Protocols, Rooms, Devices, Medicines, Products, Vendors, Packages, Discounts, Taxes.**

### 12.1 Real-life scenario

> Nilesh is opening a 3rd branch (Athwa) in two months. He needs to set up the branch master, decide which services/rooms/devices it will offer (a smaller footprint than Adajan/Vesu — no laser room initially), configure its fee schedule (some services priced slightly higher due to premium location), and make sure global masters like Medicines/Taxes are inherited correctly rather than rebuilt from scratch.

**Ideal step-by-step flow:**

1. Nilesh opens **Masters > Branches**, clicks "Add Branch," fills code, address, coordinates, phone, hours, holidays, facilities — status starts as "Inactive/Setup" so it doesn't appear in live booking until ready (§4.1 ORG-002).
2. He opens **Services** master, and because organization-level services are inherited by default (§4.1 ORG-006), Athwa automatically shows the full service catalogue — he simply **deactivates** the laser-specific services for Athwa only (since no laser room yet) rather than rebuilding the whole catalogue.
3. He sets up **Rooms** and **Devices** for Athwa — just a consultation room and a procedure room to start, with correct capacity/cleaning-buffer and availability config (§4.3).
4. He reviews **Consultation Types** and **Treatment Categories** — these are org-wide masters, no branch-specific change needed unless Athwa needs a unique offering.
5. He checks **Protocols** — confirms Athwa inherits all approved protocols, but since it has no laser device yet, any protocol requiring that device simply won't be selectable there until the device master is added later (system naturally prevents mis-booking without needing a manual rule).
6. He opens **Medicines**, **Products**, **Vendors** — org-wide, no branch action needed; Athwa's pharmacy/inventory will just start with zero stock until the first Purchase/GRN.
7. He configures a **branch-specific fee override** in Services for a few premium-positioned services (allowed override per §4.1 ORG-006 "branches override only allowed fields") — e.g., consultation fee 10% higher at Athwa.
8. He reviews **Discounts** and **Taxes** masters to confirm Athwa uses the same GST/HSN and discount-approval-threshold rules as other branches (accountant-verified, §11.1) unless a specific reason exists to differ.
9. He sets up **Packages** availability — decides the "Laser Hair Reduction" package is simply not offered at Athwa (no device) while other packages are.
10. Finally, he flips Athwa's branch status to "Active" only once staff, roster, and masters are all confirmed ready — avoiding a half-configured branch going live by accident.

### 12.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner adds a new branch and it inherits org-level Services/Protocols/Medicines automatically | No manual re-entry of shared masters; branch-specific overrides applied only where explicitly set (§4.1 ORG-006) |
| 2 | H | Owner deactivates a service at one branch only (Athwa has no laser) | Service remains fully active at other branches; Athwa staff simply never see it as bookable |
| 3 | E | Owner tries to activate a branch before any staff/doctor roster exists for it | Should warn "no doctors/staff assigned yet — appointments cannot be booked" rather than silently going live with a broken booking experience |
| 4 | E | A protocol requires a device that doesn't exist at a given branch | That protocol is simply unselectable/hidden at that branch context, not shown as an error every time someone tries |
| 5 | E | Owner edits a master (e.g., a Service's default price) that has already been used in past invoices | Change applies prospectively only; historical invoices retain the price used at the time (effective-dating, §4.1 ORG-006, "masters use effective dating") |
| 6 | P | A Branch Admin attempts to edit an organization-wide master (e.g., add a new Medicine to the shared master list) | Should be restricted or routed through an approval step depending on configured policy — org-wide masters are typically Owner/Org Admin scope (§3 role table) |
| 7 | X | Owner tries to delete a Service/Protocol/Device master that has historical bookings/sessions linked to it | Must NOT be allowed — must deactivate (soft-disable), never hard-delete, to preserve historical record integrity (§4.1 ORG-005 "deactivate/merge/transfer... without losing historical records") |
| 8 | X | Owner tries to change a Tax master value retroactively to alter a past invoice's effective tax without accountant review | Must NOT be allowed — "Tax/accounting treatment is configurable and accountant-verified" (§11.1); tax changes should not silently rewrite historical financial records |
| 9 | C | Accountant (Meera) proposes a new Discount tier; Owner approves it in Masters > Discounts | Once approved, the discount tier is immediately available (with its approval threshold) in the Billing module's discount workflow |
| 10 | E | Owner searches a long Masters list (e.g., Products with hundreds of SKUs) | Fast, tolerant search with recent/favorites first (NFR-006, §17.5 "searchable combobox, recent/favorite items first") |
| 11 | E | Owner merges/transfers a branch that's being shut down into another branch | ORG-005 "branch deactivate/merge/transfer workflow without losing historical records" — all historical patients/invoices/staff assignments remain queryable under the merged context |

---

## 13. Communication

Covers: **WhatsApp Templates, SMS Templates, Email Templates, Push Templates, Voice Templates, Notification Logs.**

### 13.1 Real-life scenario

> Nilesh wants to add a new WhatsApp template for "package expiry reminder" but knows WhatsApp/DLT require pre-approval before templates can be used live. He also wants to check why a batch of SMS reminders failed to deliver last week — a provider issue or a data problem.

**Ideal step-by-step flow:**

1. Nilesh opens **Communication > WhatsApp Templates**, clicks "Add Template," drafts the copy in English/Gujarati/Hindi variants, marks category as "Transactional/Service" (not Marketing) since it's a service-adjacent reminder, and keeps the content generic — no treatment specifics, per the high-risk rule (§7.2, §12.4).
2. The system clearly shows the template's status as **"Draft — pending WhatsApp/DLT approval"** — Nilesh cannot accidentally send it live before the provider-side approval completes (§12.4 "DLT/SMS: block unregistered free text in production").
3. Once approved (status flips to "Approved — Active"), it becomes selectable in the Follow-up/Recall engine's reminder plan configuration.
4. Separately, he opens **Notification Logs**, filters to last week's failed SMS batch, sees per-message status (sent/delivered/failed) with provider error codes, and can see it was a **provider outage window**, not a data/template problem — confirmed via the "provider health" indicator (§12.6 NTF-007, §14.2 Communications report dimensions).
5. He checks whether those failed reminders were retried automatically (idempotent retry policy) and whether any patient's appointment was affected as a result (cross-check with Appointment Analytics no-show rate for that day) — deciding whether proactive manual outreach is warranted.
6. He reviews **Email/Push/Voice Templates** briefly to ensure none of them leak sensitive content (e.g., push notification text stays generic: "You have a new document in your Aurah 360 app" rather than naming a diagnosis, §7.2, §13.2).

### 13.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner creates a new WhatsApp template and it correctly enters "pending approval" state | Cannot be selected for live sending until approval status flips to Active (§12.4, §12.6 NTF-002) |
| 2 | H | Owner reviews Notification Logs and identifies a provider outage as the cause of failed sends | Clear provider-health/error-code visibility distinguishes provider vs. data vs. consent-block failures |
| 3 | E | Owner tries to save a template containing diagnosis/treatment-specific placeholder text (e.g., "{{diagnosis}}") | Should be blocked/flagged by template validation — external message content must stay generic per the high-risk rule (§7.2, §12.4) |
| 4 | E | A patient's number is on the DND/opt-out list but a transactional reminder still needs to reach them | Transactional/service messages follow their own legal basis separate from marketing opt-out, but voice-call preferences and quiet hours must still be respected (§12.4) |
| 5 | E | Same notification event is delivered twice due to a duplicate webhook from the provider | System deduplicates and shows one logical delivery record, not two (§12.6 NTF-007 idempotency) |
| 6 | P | A CRM/Call Desk staff member attempts to create/edit a WhatsApp Template | Should require Owner/Org Admin approval-level access since templates affect compliance (DLT/WhatsApp registration) — not a routine CRM edit |
| 7 | X | Owner attempts to send a one-off free-text WhatsApp/SMS blast bypassing the approved-template system ("just this once, urgent offer") | Must NOT be allowed in production for WhatsApp/DLT SMS — "block unregistered free text in production" (§12.4); must go through an approved template even for urgent sends |
| 8 | X | Owner attempts to edit the content of a template that has already been sent historically, to make it retroactively look different in the Notification Logs | Must NOT be allowed — historical sent messages reference the exact template version used at send time; template edits create a new version, not a rewrite of history |
| 9 | C | Doctor's Follow-up order (EMR module) triggers a reminder using an Owner-approved WhatsApp template | Full chain works without doctor needing to know template plumbing — clinical order to patient message is seamless and compliant |
| 10 | E | Owner reviews Notification Analytics and sees an unusually high opt-out rate after a recent campaign | Drill-through from analytics to the actual Notification Logs/Campaign to investigate root cause (content, frequency, targeting) |

---

## 14. AI

Covers: **AI Dashboard, AI Settings, Prompt Management, AI Usage, AI Logs.**

### 14.1 Real-life scenario

> Nilesh read about a clinic elsewhere getting into trouble for an AI tool leaking patient data. Before allowing doctors to use the AI draft-note assistant more broadly, he wants to personally verify the privacy boundary is real (not just marketing claims), check usage/cost is within budget, and know he has a kill switch if something goes wrong.

**Ideal step-by-step flow:**

1. Nilesh opens **AI Dashboard** — sees a summary: which AI use cases are currently enabled (e.g., "Suggested questions," "Report summary," "Draft note"), acceptance/edit/reject rates by doctors, and a safety-flag count (§9.4 AI-005, §16.11).
2. He opens **AI Settings**, and for each use case sees a clear toggle plus a **per-branch/per-use-case kill switch** — he tests turning off "Draft note" for a moment to confirm doctors immediately fall back to normal manual documentation with no workflow interruption (§16.11 "Shutdown: per-use-case/branch kill switch and immediate fallback").
3. He opens **AI Logs**, and critically, confirms the logs show **prompt version, model, input manifest reference, output hash, and doctor accept/edit/reject** — but never raw patient name/phone/MRN/diagnosis text in plain form (§9.2, §16.11 "no raw restricted data in telemetry"). He specifically searches for any patient identifier appearing in a log entry — the search should return zero results because of the de-identification gateway.
4. He opens **Prompt Management**, sees the versioned prompt registry for each use case, with an approval/rollback history — confirming that a prompt change can't go live without passing through evaluation (§16.11 "regression gate before model/prompt change").
5. He checks **AI Usage** for cost/latency tracking, confirming the clinic's AI spend is within the budget he set, and there's a clear per-doctor and per-branch usage breakdown (§9.4 AI-007 "budget tracking").
6. Satisfied, he leaves all approved use cases enabled but notes he'll review the safety-flag count monthly.

### 14.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner reviews AI Dashboard acceptance/edit/reject rates per use case | Clear breakdown by doctor/branch/use case, helping Owner judge real clinical value vs. novelty use |
| 2 | H | Owner searches AI Logs for any occurrence of a real patient name/phone/MRN | Zero matches — de-identification gateway guarantees this by design, not by luck (§9.2 AI-002, §16.11) |
| 3 | H | Owner disables a specific AI use case via the kill switch | Doctors using it immediately fall back to normal manual workflow with no data loss or blocked consultation (§9.2 "Timeout or provider outage never blocks consultation," extended to manual kill switch) |
| 4 | E | AI provider is down / times out during a live consultation | Doctor sees a clear "AI unavailable — continue manually" state; consultation is not blocked (§9.2, NFR-020) |
| 5 | E | A doctor's free-typed complaint text accidentally includes the patient's phone number before sending to AI | Privacy filter strips/blocks it before the provider call; Owner can confirm this via AI Logs showing a "PII redacted" flag rather than a raw leak (§18.3 mandatory test, AI-002) |
| 6 | E | New prompt version is proposed for "Draft note" use case | Cannot go live without passing the evaluation set / safety review gate; Owner sees this as a required approval step, not optional (§16.11 evaluation, §9.4 AI-007) |
| 7 | P | A doctor attempts to access AI Settings/Prompt Management directly | Should be restricted to Owner/Org Admin/designated AI governance role — doctors consume AI, they don't govern its configuration (§3 role scopes) |
| 8 | X | Owner attempts to enable an autonomous image-diagnosis AI feature ("just to try it") before it's clinically validated and explicitly phase-gated | Must NOT be allowed — "Do not start MVP with autonomous clinical image analysis... any future image-assist requires explicit patient consent, clinically evaluated supported use... and mandatory doctor confirmation" (§9.3) — this must be a hard product gate, not a settings toggle Owner can flip solo |
| 9 | X | Owner tries to view a specific patient's AI conversation history threaded together with another patient's for a "comparison" | Must NOT be allowed — "No global cross-patient chat memory... partitioned by organization and patient" (§9.2); even Owner cannot construct a cross-patient AI view, since the architecture itself prevents it |
| 10 | C | AI "red-flag assist" surfaces a suggestion during a doctor's consultation | Doctor accepts/edits/rejects it inline; Owner later sees the aggregate accept/reject rate on AI Dashboard, but never the specific patient-linked clinical content of that single interaction unless going through the same sensitive-view gate as any clinical record |
| 11 | E | Owner checks AI Usage cost report mid-month | Real-time-enough cost tracking so Owner isn't surprised by an end-of-month bill; alert if trending over configured budget (§9.4 AI-007) |

---

## 15. Settings

Covers: **Clinic Profile, Branch Settings, User Management, Roles, Permissions, Consent Forms, Languages, Backup, Security, Audit Logs.**

### 15.1 Real-life scenario

> Nilesh's accountant recommends enabling mandatory MFA for all privileged roles clinic-wide (not just Owner) after a phishing scare at another local business. He also wants to confirm backups are actually working (not just "assumed to work"), review the current consent form wording with his legal advisor's redline, and check the master Audit Log for anything unusual in the last week.

**Ideal step-by-step flow:**

1. Nilesh opens **Settings > Security**, sees the current MFA policy (e.g., "Mandatory for Owner/Org Admin/Branch Admin, optional for others"). He changes it to mandatory for all staff roles that touch clinical/financial data (§16.6 "mandatory MFA for privileged roles and configurable MFA for all staff").
2. This change itself is a privileged action — the system requires **step-up authentication** (re-enter MFA) before saving, since it's a security-policy change (§16.6 step-up: "role/permission change... integration secrets").
3. He opens **Backup**, sees the last successful backup timestamp, RPO/RTO targets displayed plainly, and the date of the last **quarterly restore test** with evidence — not just "backup enabled: yes" (§16.9 "At least quarterly end-to-end restore into isolated environment with evidence").
4. He opens **Consent Forms**, updates the clinical-photography consent wording per his legal advisor's redline, sets a new version with an effective date — historical consents already given remain valid under the version the patient actually signed, while all new captures use the updated wording (§16.3, §16.4).
5. He opens **Audit Logs** (org-wide, deeper than the Reports > Audit Reports summary), searches the last 7 days for anything flagged high-severity (failed logins, break-glass, bulk exports) and finds nothing unusual — confirms his security posture is intact.
6. He briefly checks **Clinic Profile** and **Branch Settings** to confirm legal name, invoice settings, and financial year are correctly configured ahead of the accountant's month-end filing.
7. He checks **Languages** to confirm Gujarati/Hindi/English are all active and that a recently added Services entry has translations filled in (no missing-translation gaps that would show raw keys to Gujarati-speaking staff, §17.9).
8. **User Management/Roles/Permissions** here mirror the Staff module (§5) — Owner may prefer to manage day-to-day staff from the Staff module, but Settings houses the underlying role/permission templates themselves — the two should stay visibly in sync, not diverge into two different "sources of truth."

### 15.2 Test cases

| # | Type | Test case | Expected result |
|---|---|---|---|
| 1 | H | Owner changes MFA policy to mandatory for all privileged roles | Requires step-up re-authentication to save; existing sessions for affected users are prompted to set up MFA at next login, not silently locked out without notice (§16.6) |
| 2 | H | Owner reviews Backup screen and confirms last quarterly restore test evidence exists | Concrete date + evidence artifact shown, not just a green checkmark with no substantiation (§16.9) |
| 3 | H | Owner updates Consent Form wording with a new effective version | Historical consents remain valid under the version originally signed; new captures require the new version's consent (§16.3, §16.4) |
| 4 | E | Owner tries to save a Security policy change but their own MFA session has expired | Blocked, prompted to re-authenticate before the change is accepted — this is exactly the step-up control working as intended, not a bug |
| 5 | E | A translation key is missing for Gujarati on a newly added Service name | System should visibly flag "missing translation" to Owner/admin rather than silently showing the raw key or falling back with no indication (§17.9, NFR-014) |
| 6 | P | An Org Admin attempts to change the organization's Backup/DR configuration or Security policy | Should require Owner-level authority for infrastructure/security-critical settings, not general Org Admin scope, depending on configured governance (§3, §16.7) |
| 7 | P | Owner attempts to view Audit Logs' underlying raw payload for a "sensitive view" event | Sees actor/time/action/reason metadata; full sensitive payload is deliberately excluded from audit text (§16.8) — same boundary as in Reports §11.2 test 7 |
| 8 | X | Owner attempts to disable audit logging entirely for a branch ("it's slowing things down") | Must NOT be allowed — audit for sensitive view/change/export and operational overrides is a P0 non-negotiable control (§16.6.12 SEC-004); no UI path should exist to fully disable it |
| 9 | X | Owner attempts to restore a backup directly into the live production environment without going through an isolated-environment verification step, mid-business-day, without notice | Must NOT be allowed as a casual self-service action — restores follow a tested runbook with defined RTO/RPO and impact communication (§16.9 downtime procedure, incident response) |
| 10 | X | Owner tries to grant themselves impersonation/support access to a staff member's account silently | Must NOT be allowed — "Admin/support impersonation is off by default; any approved support access is time-limited, reasoned, visible and audited" (§16.7) — even Owner-initiated impersonation must be visible and audited, not silent |
| 11 | C | Legal advisor redlines the Consent Form; Owner updates it in Settings | New version immediately governs all new patient registrations/captures across every branch and every role that triggers a consent screen (Reception, Nurse, mobile app) — one edit propagates correctly everywhere |
| 12 | E | Owner attempts to deactivate a Language (e.g., temporarily disable Hindi) while active patients have Hindi as their preferred language | Should warn about impact on those patients' communication preferences before confirming, not silently switch them to a default language without notice |

---

## 16. Cross-Cutting Owner Rules (applies to every module above)

These are PRD-driven guardrails that should be enforced consistently everywhere the Owner/Admin role operates, not just in one module:

| Rule | PRD reference | Applies to |
|---|---|---|
| Deny-by-default authorization on every server action, never just hidden UI | §16.6, SEC-001 | All modules |
| Step-up (re-auth/MFA) required for: bulk export, role/permission change, break-glass, refund above threshold, clinical-photo download, integration secret change, security-policy change | §16.6, §3.1 | Staff, Billing, Settings, Patient Management |
| Break-glass access requires reason + recent MFA + short expiry + owner/privacy alert, even when Owner is the one invoking it | §3.1 | Patient Management, Settings |
| Signed clinical/financial/stock records are never silently overwritten — amendment, credit note, or reversal only | §16.10, §11.3, §11.2, NFR-005 | Patient Management, Billing, Inventory, Treatment |
| No hard delete of patient, clinical, financial, or audit records — deactivate/archive only; erasure only via formal rights-request case | §16.5, PRV-002 | Patient Management, Doctors, Staff, Masters, Settings |
| Audit is append-only and tamper-evident; not even Owner can edit or delete an audit entry | §16.8 | Reports, Settings |
| Management/aggregate dashboard access never implicitly grants patient-level clinical detail access | §14.3 | Dashboard Suite, Reports |
| External communication (WhatsApp/SMS/push/voice/email) never contains diagnosis, treatment specifics, or clinical photos — generic text + secure link only | §7.2, §12.4 | Communication, CRM |
| Marketing consent is separate from and never implied by service/appointment consent | §12.4, §16.3 | CRM, Communication |
| AI requests are de-identified, current-patient-only, and every output requires human doctor accept/edit/reject before being clinically committed | §9.2, §16.11 | AI |
| Every master change is effective-dated; historical transactions retain the values in force when they were created | §4.1 ORG-006 | Masters, Billing, Treatment |
| Approval thresholds (discount/refund/void) are configurable but always require mandatory reason + audited approver, and self-approval above one's own threshold is blocked | §11.3, §3.1 | Billing |
| Owner impersonation/support access is never silent — always time-limited, reasoned, visible, audited | §16.7 | Settings, Staff |

---

*End of document. This reference is intended to guide a future UI/UX redesign of the Owner/Admin experience and should be revisited whenever the underlying PRD sections it cites are revised.*


---

# Receptionist & Branch Manager

# Aurah 360 ClinicOS — Ideal Test-Case & User-Flow Reference
## Receptionist & Branch Manager Roles

**Purpose of this document:** This is a from-scratch, ideal-world redesign reference for the **Receptionist** and **Branch Manager** roles at Aurah 360 (skin/hair/laser clinic, Surat, multi-branch). It is **not** constrained by the current web app's existing structure. Every flow below describes what a real front-desk receptionist and a real branch manager at a busy clinic would want, in the most intuitive click-by-click order, so that a future redesign has a concrete north star.

**How to read this document:** Each screen/module has:
1. A real-life scenario with a named fictional staff member, walked through step by step.
2. A test-case table: happy path, edge cases, and at least one "must NOT be allowed" case.
3. Cross-role handoff notes.
4. Cross-references to PRD business rules (section numbers refer to `aurah_prd.md`).

**Recurring cast of characters** (used throughout for continuity):
- **Kavya** — Receptionist, Aurah 360 Surat–Adajan branch, 2 years experience.
- **Meera** — Branch Manager, Adajan branch.
- **Dr. Rina Shah** — Dermatologist, works Adajan (Mon/Wed/Fri) and Vesu (Tue/Thu/Sat).
- **Priya Solanki** — Walk-in patient, first-time visitor, wants laser consultation.
- **Ramesh Patel** — Returning patient, hair-loss treatment package, comes for session 4 of 6.
- **Ayesha Khan** — Existing patient calling to reschedule.
- **Jignesh** — Treatment technician (laser).
- **Owner** — Mr. Arjun Mehta, Aurah 360 founder, oversees both branches.

---

# PART A — RECEPTIONIST

## A1. Dashboard

### Scenario
Kavya logs in at 9:00 AM before the clinic opens. She wants one glance to know: how many patients are booked today, who has already confirmed, who might not show up, whose documents are missing, and if anything urgent needs her attention before the doctor arrives.

### Ideal flow
1. Kavya logs in with her staff PIN/password + device-remembered session (MFA already validated for the day).
2. Landing screen shows, for **her active branch only** (Adajan — selectable if she's cross-trained at two branches):
   - "Today at a glance" tiles: Total appointments (18), Confirmed (14), Pending confirmation (3), No-show risk (1, flagged because patient didn't respond to yesterday's reminder), Walk-ins expected (historical average, e.g. "~4 typical for a Saturday").
   - "Needs your attention now" list, sorted by urgency: e.g. "Ramesh Patel — arriving in 20 min — package session 4/6, no dues," "Priya Solanki registered online but documents incomplete," "1 reschedule request awaiting your action."
   - "Missing documents / consent" chip count — patients today who haven't uploaded ID or signed consent.
   - Doctor arrival status: "Dr. Rina Shah — checked in / not yet arrived," so Kavya knows whether to hold early walk-ins.
   - Quick-action shortcuts pinned at top: New Patient, Book Appointment, Check-in, Walk-in, Upload Report, Record Payment — matching PRD §17.8 "reception shortcut palette."
3. Tapping any tile deep-links into the relevant filtered list (e.g. tapping "Pending confirmation" opens Today's Queue filtered to that status).

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Kavya opens dashboard at shift start | All tiles load within 2s (PRD NFR-002); numbers match Today's Queue counts |
| Edge case | No appointments booked today (rare slow day) | Dashboard shows friendly empty state "No appointments yet — Book one or check in a walk-in," not a blank/broken layout |
| Edge case | Doctor called in sick after appointments were confirmed | Dashboard surfaces a red banner: "Dr. Rina Shah unavailable today — 6 affected appointments need reschedule," with one-click "View affected list" |
| Edge case | Kavya has access to two branches | Branch switcher is visible and defaults to her currently clocked-in branch; switching requires her role to actually be granted at that branch (server-checked, not just UI) |
| Edge case | Network/API is slow or the notification provider (WhatsApp/SMS) is down | Dashboard still loads all core counts; only the "delivery status" widget shows "Provider degraded" without blocking anything else (PRD §2.2 Safe failure) |
| Must NOT allow | Kavya's dashboard shows revenue totals, doctor's personal notes, or another branch's patient list | Dashboard must show only her branch's operational counts — no financial P&L, no clinical note previews, no cross-branch patient data unless explicitly granted (PRD §3 role table — Receptionist restriction; §16.2 data classification) |

### Cross-role handoff
- Doctor-unavailable banner triggers a task for **Branch Manager** to approve mass-reschedule or escalate to **Owner** if same-day cancellation affects many patients.

---

## A2. Today's Queue

### Scenario
It's 10:15 AM. Kavya needs a single live view of everyone physically in the branch or expected shortly, so she can tell any patient "you're 2nd in line" without guessing.

### Ideal flow
1. Kavya opens **Today's Queue** — a real-time board (auto-refreshing, no manual reload needed) grouped into columns: **Expected**, **Checked-in / Waiting**, **In Consultation**, **Awaiting Treatment**, **In Treatment**, **Awaiting Billing**, **Completed** (PRD §6.3 state machine, §6.5).
2. Each card shows: token number, patient display name (or masked initials if the queue is shown on a public-facing screen — PRD §6.5, §17.2 "patient identity masked on public display mode"), doctor, scheduled time vs arrival time, elapsed wait, and a status chip.
3. Kavya can:
   - Drag a "Waiting" card to reorder — but **only with a mandatory reason** (e.g. "Elderly patient," "Doctor requested priority," "Patient has connecting appointment") — reordering without reason is blocked (PRD §6.5 "manual jump requires reason").
   - Mark statuses: Called, Temporarily Away, Late, No Response, Left, No-show.
   - Click a card to open a side drawer with patient summary, contact preference, and any handoff note flag.
4. A branch-visible waiting-room TV/monitor shows a stripped version: token + initials + doctor name only — never full name, complaint or diagnosis.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Ramesh checks in, queue auto-adds him under his scheduled doctor with correct wait timer | Card appears instantly in "Checked-in/Waiting," timer starts from check-in time |
| Edge case | Two patients scheduled at the same time with same doctor (overbooked slot) | Queue shows both, sorted by arrival/appointment time; Kavya can see conflict badge; system does not silently drop one |
| Edge case | Walk-in Priya arrives with no appointment while 5 scheduled patients are waiting | Priya gets a token and joins queue by default sorting rule (arrival time), not automatically bumped ahead of scheduled patients (PRD §6.5 default sort = appointment/arrival time with configurable clinical priority) |
| Edge case — reordering with reason | Kavya needs to move an anxious elderly patient ahead | She selects "Reorder," picks a reason from a controlled list or types one, confirms — action is logged with her name, timestamp, reason (PRD §6.5, §16.8 audit) |
| Edge case — no-show handling | Ayesha was called 3 times over 20 minutes and never responds | Kavya marks "No Response" → after configured threshold, patient auto-flips to "No-show," slot is released back to availability, and a task is created for CRM follow-up/recall (PRD §6.3, §12.1) |
| Edge case | Doctor finishes early and asks for the next patient before their turn per queue order | System still shows recommended next-in-line based on sort rule; doctor/reception can override but override requires reason and is audited — prevents unfair jumping without record |
| Must NOT allow | Public waiting-room display shows full patient name or diagnosis | Display mode strictly renders token + initials + doctor only; server does not even send full name/diagnosis payload to the public display context (PRD §6.5, §16.2) |
| Must NOT allow | Receptionist reorders queue with no reason entered | Save button remains disabled/blocked until a reason is provided |

### Cross-role handoff
- "Awaiting Treatment" and "Awaiting Billing" columns are the trigger points that page **Treatment Technician** and **Cashier/Accountant** respectively — no manual phone calls needed.
- No-show entries flow automatically into **CRM/Call Desk**'s recall worklist (PRD §12.1).

---

## A3. Patient List

### Scenario
Ramesh's daughter calls asking to check her father's next appointment date. Kavya needs to find him fast without seeing anyone else's records.

### Ideal flow
1. Kavya opens **Patient List**, types "Ramesh" or his mobile number into a single, prominent search box (not separate fields for name/phone/MRN — PRD §17.4 "one search box").
2. Results appear as she types (search tolerant of spacing/typos/transliteration — PRD NFR-006), showing masked-safe preview: name, age, mobile (partially masked if her permission level requires it), last visit, branch.
3. She can filter by branch, doctor, status (active/inactive), or source, but by default only sees patients tied to her branch access scope.
4. Clicking a row opens **Patient Profile**.
5. A persistent "+ New Patient" button sits beside the search box for the case where no match is found.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Search "9825012345" | Exact patient found instantly, single result |
| Edge case | Search "Ramesh Patel" — common name, multiple matches across branches | List shows all matches with disambiguating info (DOB, mobile last 4 digits, branch, last visit) so Kavya picks correctly, without exposing more identity data than needed |
| Edge case | Search returns zero results | Friendly prompt: "No match found — Register new patient?" with one click into Register Patient, pre-filling searched name/mobile |
| Edge case | Very large patient database (10,000+) | Search remains sub-1.5s response (PRD NFR-002/NFR-006), pagination or infinite scroll works smoothly |
| Must NOT allow | Kavya searches and sees a patient's clinical diagnosis or internal doctor notes in the list preview | List preview shows only identity/administrative fields — no diagnosis, no restricted clinical class data (PRD §16.2 Restricted clinical class) |
| Must NOT allow | Kavya bulk-exports the entire patient list to Excel | Bulk export requires a separate elevated permission not granted to Receptionist by default (PRD §3.1 "Separate permissions for... bulk export") |

### Cross-role handoff
None directly — this is a pure lookup screen, but it's the entry point into almost every other receptionist flow.

---

## A4. Register Patient

### Scenario
Priya Solanki walks in for the first time, asking about laser hair reduction. Kavya must register her in under 3 minutes without making her fill out a long form while standing at the counter.

### Ideal flow
1. Kavya clicks **+ New Patient** (or arrives here from a failed search).
2. **Step 1 — Duplicate check first:** System asks for mobile number before anything else and instantly checks for likely duplicates (same/similar mobile, name+DOB) — shows "Possible match found: Priya Solanki, DOB 12-Mar-1998, last visit 2024" if one exists, letting Kavya confirm "that's her" (goes to check-in) or "different person, continue" (PRD §5.2 step 1, §5.4 PAT-001).
3. **Step 2 — Minimum required fields only:** Full name, DOB-or-age (auto-calculates the other), gender, mobile, branch, source (dropdown: Walk-in / Google / Instagram ad / Referral / Other — with controlled "Other" text), and the mandatory consent acknowledgments (privacy notice + care/record processing). This is deliberately short — no full medical history at the counter (PRD §5.2 step 3, §5.4 PAT-002/PAT-003/PAT-004).
4. **Step 3 — Optional quick-add:** email, address, emergency contact, preferred language, referrer name if "Referral" selected, guardian info if patient is a minor.
5. One button: **Save & Check-in** — creates the MRN, timeline, and immediately drops her into the queue in one action, rather than making Kavya save and then separately search-and-check-in.
6. A confirmation toast shows the new MRN and a "Print ID card / Send welcome WhatsApp" quick action.
7. A "pending intake" task auto-generates for the **Nurse** to complete detailed history/allergies/skin-hair-laser questionnaire before the doctor sees her (PRD §5.2 step 4).

### Test cases

| Type | Scenario | Edge cases | Expected result |
|---|---|---|---|
| Happy path | New patient, unique mobile number | — | Registration completes in under 3 minutes, MRN generated, patient auto-queued |
| Duplicate detection | Priya's mobile matches an existing record with a different name spelling ("Priya" vs "Priyaa") | System flags as likely duplicate, shows side-by-side comparison | Kavya must explicitly choose "same person" or "different person" — **no automatic silent merge** (PRD §5.2 step 5) |
| Duplicate detection — false positive | Two unrelated patients share a family landline/mobile (common in India) | System still flags similarity but Kavya can mark "not a duplicate" with one click, and this decision is recorded so it doesn't re-flag identically next time (or flags but shows "previously reviewed, not duplicate") |
| Minor / dependent | Priya brings her 10-year-old for a mild acne consult | Registration requires guardian name, relationship, and guardian mobile; guardian becomes the primary contact and authorizer (PRD §5.1 Guardian/dependent, PAT-005) |
| Missing mandatory consent | Kavya tries to save without the patient acknowledging the privacy notice | Save is blocked with a clear inline message — not a generic error (PRD §17.5, §17.8) |
| Source = Referral | Priya says "my friend Ramesh told me about this place" | Kavya selects Referral, searches and links Ramesh's patient record as referrer — preserved for both the CRM funnel and future referral rewards (PRD §12.5) |
| Network failure mid-registration | Wi-Fi drops after Kavya enters details but before save | Form retains entered data locally and shows "not saved yet" indicator; retry does not create a duplicate record (idempotent save) (PRD NFR-004) |
| Must NOT allow | Kavya tries to enter Priya's Aadhaar/government ID as a required field | Government ID is never a mandatory field; only optional if clinic policy explicitly requires it, and it's never sent to AI or unnecessarily displayed (PRD §5.1, §16.11) |
| Must NOT allow | Kavya is asked to also fill in detailed clinical history (allergies, medicines) at the front counter | Clinical history capture is explicitly deferred to nurse intake — receptionist screen doesn't even expose those fields, reducing her liability and the patient's wait time (PRD §5.2 step 4, §5.4) |

### Cross-role handoff
- Auto-created "pending intake" task routes to **Nurse/Clinical Assistant**.
- If Priya mentions something noteworthy during registration ("I'm scared of needles," "I had a bad experience elsewhere"), Kavya should be prompted: "Add a note for the doctor?" → routes into **A20 Front Desk Handoff Note** logic embedded contextually here, not as a separate hidden screen.

---

## A5. Edit Patient

### Scenario
Ramesh has moved to a new address and got a new mobile number since his last visit 3 months ago.

### Ideal flow
1. From Patient Profile, Kavya clicks **Edit**.
2. Only administrative/contact fields are editable by receptionist (name spelling, DOB correction with reason, mobile, address, email, source correction, emergency contact, guardian info, consent toggles).
3. Clinical fields (allergies, diagnosis, medicine history) are **visible read-only** here if permitted, but not editable by reception — a lock icon with tooltip "Clinical fields — edit by doctor/nurse only."
4. Any change to identity-critical fields (name, DOB, mobile) requires a brief reason ("Correction," "Patient life update," "Data entry error") — this becomes part of the audit trail, not a silent overwrite.
5. Save shows a diff summary before commit: "Mobile: 98xxx1111 → 98xxx2222 — Confirm?" to prevent butter-fingers errors that could misroute reminders.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Update mobile number and address | Saved with audit entry (old value, new value, reason, actor, timestamp) |
| Edge case | Editing DOB changes patient's age bracket, which could affect an active minor/guardian relationship | System warns: "This patient will now be marked as an adult — guardian requirement removed?" requiring explicit confirmation |
| Edge case | Two staff edit the same patient simultaneously | Optimistic locking — second save shows "record changed since you opened it, review updated version" rather than silently overwriting (PRD NFR-004/NFR-005) |
| Edge case | Kavya tries to withdraw a consent that's needed for an active upcoming appointment/communication | System explains impact ("Withdrawing SMS consent will stop the reminder for tomorrow's appointment") before confirming, per PRD §16.5 rights workflow — but she can still proceed since it's the patient's genuine choice |
| Must NOT allow | Kavya edits diagnosis, prescription, or allergy list | These fields are not exposed as editable to Receptionist role at all — enforced server-side, not just hidden in UI (PRD §3, §16.6 "no reliance on hidden UI") |
| Must NOT allow | Kavya silently deletes/overwrites a wrong mobile number with no trace | Every identity-field change is versioned/audited; no hard overwrite without history (PRD §16.8) |

### Cross-role handoff
- If a contact-detail change affects an already-scheduled reminder/campaign, the notification engine should pick up the new number automatically for future sends.

---

## A6. Patient Profile

### Scenario
Ramesh arrives for his 4th laser session. Kavya wants a single screen showing everything relevant to greeting him well and processing him quickly — without wading through pages of clinical detail she doesn't need.

### Ideal flow
1. Patient Profile opens with a **summary header**: photo (if available), name, MRN, age, branch(es) visited, allergy/high-risk badge (visible even to reception as a safety flag, without revealing full clinical reasoning), active package status, outstanding dues badge.
2. Tabs relevant to reception: **Overview**, **Appointments**, **Documents**, **Billing**, **Communication History**. Clinical tabs (Encounters/SOAP notes, Diagnosis, full Prescriptions) are either hidden or shown in a clearly "restricted — view by clinical staff only" collapsed state.
3. Overview shows: next appointment, active package/session countdown ("Session 4 of 6 — Laser Hair Reduction, Underarms"), last visit date, preferred language/channel, any **unresolved handoff note flag**.
4. Quick actions available inline: Book Appointment, Check-in, Upload Document, Create Invoice, Send Reminder — so Kavya never has to leave the profile to act.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Open Ramesh's profile, see package progress and book his next session directly from the profile | All info accurate and current; one click into Book Appointment pre-filled with his usual doctor/service |
| Edge case | Patient has visited multiple branches | Profile shows a unified cross-branch timeline (permission-aware) — e.g. "Visited Vesu branch on 12-Jan for consultation" — but Kavya only sees what her access scope permits (PRD §5.4 PAT-007, ORG-004) |
| Edge case | Patient has an outstanding due from previous visit | Prominent due badge with amount, so Kavya can proactively mention it at checkout rather than surprising the patient at billing |
| Edge case | Allergy or high-risk badge exists ("Isotretinoin history — laser caution") | Reception sees a generic caution badge but not the deep clinical reasoning; enough to know to notify the doctor/nurse, not enough to over-expose restricted clinical data |
| Must NOT allow | Kavya opens the doctor's SOAP note or internal diagnosis text | Tab is either absent or shows "Restricted — clinical staff only," never renders the actual note content to reception (PRD §16.2, §8.3 "comments classified as staff-only/internal clinical/patient-facing") |
| Must NOT allow | Kavya downloads/exports full clinical photo set | Photo download/export requires a separate, higher permission not default for Receptionist (PRD §7.2 Access row, §3.1) |

### Cross-role handoff
- Unresolved handoff-note flag here is the same object surfaced in A20 — visible to doctor before consultation starts.

---

## A7. Patient Timeline

### Scenario
Ramesh mentions he "already gave a report last time" and Kavya needs to confirm whether it's actually on file before telling him he doesn't need to bring it again.

### Ideal flow
1. From Patient Profile, Kavya opens **Timeline** — a single chronological feed of all visit-level events: appointments, documents uploaded, invoices, communications sent — sorted by clinical/event date, not just upload date (PRD §7.1 "Timeline sorts by clinical date").
2. Each entry is a card: date, type icon, one-line description ("Lab report uploaded — CBC, dated 02-Jun-2026"), and status (Reviewed/Unreviewed) — again, no clinical value/diagnosis content shown to reception, just administrative metadata.
3. Filter chips: Documents, Appointments, Billing, Communications — Kavya can quickly toggle to "Documents only" to answer this exact question.
4. Clicking a document card opens a lightweight preview showing only the metadata (name, date, category) with an option to open the file (if her permission allows viewing the actual file, e.g. an external lab PDF, but not necessarily a clinical photo).

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Filter to Documents, find the previous CBC report | Found instantly with correct clinical date, confirms to Ramesh he doesn't need to re-bring it |
| Edge case | Timeline has 3+ years of history across two branches | Pagination/lazy-load keeps timeline fast (NFR-002); cross-branch entries clearly tagged with branch badge |
| Edge case | A document was uploaded but is still "Pending" malware scan | Timeline shows "Scan pending — not yet available" rather than exposing a potentially unsafe file (PRD §7.1) |
| Must NOT allow | Timeline shows the doctor's internal diagnosis text inline in the feed | Clinical encounter entries show only "Consultation with Dr. Rina Shah — completed" without diagnosis/plan detail to reception role (PRD §16.2, §8.3) |
| Must NOT allow | Kavya can edit or delete a past timeline entry | Timeline is read-only/append-oriented from reception's view — no delete controls exposed (PRD §16.8 "Audit records are append-oriented") |

### Cross-role handoff
None beyond what's already covered in A6 — this is a supporting detail view.

---

## A8. Book Appointment

### Scenario
Ayesha Khan calls to book a first-time consultation for hair fall with Dr. Rina Shah, preferably this week, evening slot after work.

### Ideal flow
1. Kavya searches/selects Ayesha (or registers her fresh, per A4).
2. **Book Appointment** panel opens as a guided 4-step flow, not a giant form:
   - Step 1: Branch (defaults to caller's usual branch) → Doctor (searchable, shows only doctors actually available at that branch) → Service/consultation type.
   - Step 2: Calendar shows only real bookable slots (computed from the full availability engine: doctor roster ∩ branch hours ∩ room/device ∩ existing bookings ∩ travel buffer — PRD §6.2) — Kavya never sees a slot she can't actually book.
   - Step 3: If Ayesha wants a time that isn't in the available list (e.g., "can he see me at 9:15pm, after hours?"), Kavya can submit it as a **custom request**, which becomes "Pending Approval" rather than a fake confirmation (PRD §6.2, §6.3).
   - Step 4: Confirm — system shows a plain-language summary ("Ayesha Khan, Thu 6:30 PM, Dr. Rina Shah, Adajan branch, Hair Fall Consultation") before finalizing, and previews exactly what notification the patient will receive (PRD §6.4 "preview patient notification before save").
3. On confirm, appointment is created, confirmation WhatsApp/SMS auto-sent, and Kavya sees the new appointment in her calendar immediately.
4. If Ayesha is a returning patient with an existing package, the flow pre-suggests "Book next session" instead of a generic new booking.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Book Thursday 6:30 PM slot, doctor and room available | Confirmed instantly, notification sent, calendar updated |
| Edge case — cross-branch conflict | Dr. Rina Shah has a Vesu branch appointment ending 6:00 PM the same evening and travel buffer requires 45 min | System refuses to show that Adajan slot as available, or shows it greyed out with reason "Doctor traveling from Vesu branch" (PRD §4.2, §6.2) |
| Edge case — concurrent booking race | Two receptionists (Kavya at Adajan, a colleague at a call center) try to book the same last slot simultaneously | Database locking ensures only one succeeds; the second gets an immediate "slot just taken, here are next available times" rather than a silent double-booking (PRD §6.2, APT-008) |
| Edge case — custom/off-slot request | Ayesha insists on a time outside standard hours | Booking is created as "Pending Approval," doctor/branch notified to accept, propose alternate, or reject — not silently confirmed (PRD §6.3) |
| Edge case — walk-in vs scheduled conflict | A walk-in occupies the room right when a scheduled patient's appointment starts | System should never have double-booked the room in the first place (availability engine already reserved it); if a walk-in is squeezed in ad hoc, Kavya is warned about the resource clash before confirming |
| Edge case — package session booking | Ramesh's next session is due; Kavya books from his package instead of a fresh service selection | System deducts from package **only when session is completed**, not at booking time (PRD §10.4) — booking simply reserves the slot |
| Must NOT allow | Kavya overrides a real doctor/room double-booking without any resource re-check | Not permitted — every booking action revalidates resources server-side; client never assumes availability (PRD §15.4 "Authorization is server-side... client filters are never security boundaries") |
| Must NOT allow | Kavya books an appointment for a patient without any consent acknowledgment on file for a first-time patient | System blocks and redirects to complete minimum consent first |

### Cross-role handoff
- Pending-approval bookings notify **Doctor** (and/or **Branch Manager** if doctor delegates approval authority) to accept/reject.
- Cross-branch conflicts that need judgment calls escalate to **Branch Manager** or **Owner** for scheduling policy decisions.

---

## A9. Calendar

### Scenario
Kavya wants to see the whole day/week at a glance — not just her own bookings — to help patients pick convenient times and to spot gaps she can fill with recall calls.

### Ideal flow
1. Calendar opens defaulting to **Day view**, branch-scoped, with a doctor filter row (avatars with consistent colors + branch badges — PRD §6.4, §4.2).
2. Views: Day / Week / Month / Agenda-list — Kavya toggles based on need; agenda/list is default on mobile/tablet (PRD §17.7).
3. Each appointment card shows patient display name, time, service type, and status color — but never exposes complaint/diagnosis text on the card itself (PRD §17.7).
4. Drag-and-drop reschedule is available to Kavya (permitted role) but always triggers a server resource re-check + confirmation summary + patient-notification preview before saving (PRD §6.4, §17.7) — it can never silently bypass approval rules.
5. A side "Unscheduled requests" panel lists pending-approval/custom requests waiting to be placed into real slots.
6. Filter state can be saved as a personal view (e.g., "My daily view — Dr. Shah only") for faster daily use.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Switch to Week view, filter to Dr. Rina Shah | Shows only her appointments across the week with correct branch badges (since she alternates branches) |
| Edge case | Drag an appointment to a new time that conflicts with another booking | Drop is rejected with an inline reason, not silently accepted then broken |
| Edge case | Kavya drags an appointment to a time within the same slot but a different room that's under maintenance | System blocks with "Room 2 unavailable — under maintenance until 3 PM" |
| Edge case | Large clinic day with 40+ appointments across 3 doctors | Calendar remains performant and legible; overlapping appointments don't visually collide unreadably |
| Must NOT allow | Kavya reassigns an appointment to a doctor with no privilege at that branch | System prevents the reassignment — doctor-branch privilege is enforced server-side (PRD §4.2) |
| Must NOT allow | Drag-and-drop reschedule skips sending the required patient notification | Every reschedule via drag-drop still triggers/queues the standard notification event — cannot be silently suppressed by convenience UI (PRD §6.4, §12.2) |

### Cross-role handoff
- Same escalation paths as A8 for conflicts requiring doctor/branch manager decisions.

---

## A10. Walk-in

### Scenario
Priya Solanki (from A4) has just registered and now needs to be added to today's live queue since she has no prior appointment.

### Ideal flow
1. From Priya's profile (or directly from Today's Queue), Kavya taps **Walk-in / Add to Queue**.
2. Quick panel: select branch (auto-filled), preferred doctor (or "any available dermatologist"), reason/service category (e.g. "Laser consultation"), and priority note if relevant ("first-time, nervous").
3. System checks whether any doctor at the branch is realistically available soon (not overloaded) and gives an honest estimated wait: "Estimated wait: ~25 minutes, 2 patients ahead."
4. Confirm generates a token number and drops her into Today's Queue at the correct position by the branch's default sorting rule.
5. A printed/digital token slip can be handed to Priya with the token number and estimated wait.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Register walk-in, join queue, get token #14 | Token issued, queue entry created, wait estimate shown |
| Edge case | No doctor is at the branch at all right now (e.g., doctor running late) | System is honest: "No doctor currently available — estimated arrival 11:15 AM" rather than a fake token/wait time |
| Edge case | Walk-in wants a specific doctor who isn't at that branch today | System clearly informs: "Dr. Rina Shah is at Vesu branch today; available doctors here are Dr. X" and offers to book Dr. Shah a different day instead |
| Edge case — walk-in vs scheduled conflict | Priya's walk-in token would place her ahead of a scheduled patient purely by arrival time coincidence | Default sort rule (appointment/arrival time) is applied consistently — walk-ins don't automatically jump ahead of scheduled patients just by asking (PRD §6.5) |
| Must NOT allow | Kavya manually assigns Priya a token number out of sequence with no reason | Token numbers are system-generated sequentially; any queue position override still requires the documented reason field from A2 |

### Cross-role handoff
- Feeds directly into A2 Queue and A11 Check-in states.

---

## A11. Check-in

### Scenario
Ramesh has a 3:00 PM scheduled session and arrives at 2:55 PM.

### Ideal flow
1. Kavya searches Ramesh (or he's shown in "Expected soon" on the dashboard) and taps **Check-in**.
2. System confirms arrival time, auto-transitions his appointment status from Confirmed → Checked-in → Waiting, and places him in the queue.
3. A quick confirmation banner shows any pending items before check-in completes: "Consent renewal needed" or "Dues ₹500 outstanding from last visit" — informational, not blocking, so Kavya can mention it while he waits.
4. If any **unresolved handoff note** or urgent flag exists from a previous visit, it surfaces here as a gentle reminder to re-raise with the doctor if still relevant.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Check in a patient with a scheduled appointment 5 minutes early | Status transitions correctly, added to queue with correct scheduled-time reference |
| Edge case | Patient arrives significantly early (1 hour before appointment) | Check-in still succeeds but queue position accounts for the actual scheduled time, not just arrival order, unless clinic policy allows early slotting into gaps |
| Edge case | Patient checks in for the wrong branch's appointment (arrived at Adajan but was booked at Vesu) | System detects mismatch and alerts Kavya: "This appointment is booked at Vesu branch — check in here anyway or redirect?" rather than silently checking in against the wrong branch's resources |
| Edge case | Patient already checked in once (double-tap or two staff both try) | System is idempotent — second check-in attempt shows "Already checked in at 2:55 PM," not a duplicate queue entry |
| Must NOT allow | Check-in silently overrides an active "Cancelled" appointment status | If the appointment was already cancelled, check-in flow blocks and requires Kavya to first resolve the cancellation (re-book or override with reason) — no invisible state jump |

### Cross-role handoff
- Successful check-in is the trigger that moves the patient into the doctor's "My Day" waiting list.

---

## A12. Reschedule

### Scenario
Ayesha calls the morning of her appointment saying she's stuck at work and needs to move it to next week.

### Ideal flow
1. Kavya opens Ayesha's appointment (from Patient Profile, Calendar, or Today's Queue).
2. Taps **Reschedule**, which opens the same availability-engine slot picker as Book Appointment, pre-filtered to the same doctor/service, with a note showing the original time for reference.
3. Kavya picks a new real slot (or submits a custom request, going Pending Approval as in A8).
4. System asks for a brief reschedule reason (optional but encouraged: "Patient request," "Doctor unavailable," "Clinic-initiated") for reporting/no-show analytics purposes.
5. Confirmation preview shows old time struck through, new time highlighted, and the exact notification text the patient will get — before Kavya commits.
6. Old slot is released back into availability immediately upon confirm.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Reschedule to next available slot next week, same doctor | Old slot released, new slot reserved, confirmation sent, calendar reflects the move |
| Edge case | The only slot Ayesha wants next week is already fully booked | System shows next-best real alternatives rather than a dead end; doesn't allow overbooking unless clinic policy explicitly permits (with clear "overbook" labeling and approval) |
| Edge case | Reschedule requested for a package session that's tied to a treatment cadence (e.g., laser sessions need ~4 week gaps) | System should flag if the new date breaks the recommended protocol interval, informing Kavya so she can advise the patient, without hard-blocking a patient's legitimate scheduling need |
| Edge case | Reschedule initiated by patient via WhatsApp lands as a request while Kavya is also trying to reschedule manually | System prevents a race condition — only one reschedule action wins, and Kavya sees a live "already rescheduled via WhatsApp" notice if she opens it after (PRD §12.3, §15.4) |
| Must NOT allow | Reschedule of a same-day appointment to a slot that doesn't leave the required room/device cleaning buffer | Blocked by the same availability engine rule used for original booking — reschedule doesn't get a shortcut around resource rules (PRD §6.2) |

### Cross-role handoff
- Reschedule notifications and the doctor's calendar update automatically; no separate manual notice needed to the doctor.

---

## A13. Cancel

### Scenario
Ramesh's package session needs to be cancelled entirely — he's traveling out of town for two weeks and will rebook later himself.

### Ideal flow
1. From the appointment, Kavya taps **Cancel**.
2. System requires a reason from a short controlled list (Patient request, Clinic-initiated, Duplicate booking, No longer needed, Other) plus optional free text.
3. If cancelling within a short window of the appointment time, system flags this as "late cancellation" for internal reporting (not shown to the patient as a penalty unless clinic policy includes cancellation fees — out of scope unless configured).
4. Confirmation shows impact: "This will release the 3:00 PM slot and notify Ramesh." Kavya confirms.
5. If it's a package session, system asks: "Does this count as a used session or should it remain available in his package?" — defaulting to **not consumed**, since sessions are only deducted on completion (PRD §10.4).
6. Cancellation notification sent (generic, no clinical content) and slot released for others to book.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Cancel with reason "Patient request — traveling" | Appointment marked Cancelled, slot released, patient notified, package session preserved |
| Edge case | Cancel an appointment that already has "Checked-in" status (patient physically present but situation changed, e.g. feeling too unwell to continue) | System allows cancel from any active non-completed state but logs the actual prior state for audit |
| Edge case | Cancelling a treatment-linked appointment that already had pre-treatment consumables prepared/reserved | System warns Kavya: "Room/device reservation and consumable prep will be released — confirm?" so nothing is wasted silently |
| Must NOT allow | Cancel with no reason recorded | Reason is mandatory — cannot save a bare cancel (PRD §6.3 "Reason, actor, time... recorded") |
| Must NOT allow | Cancelling silently deletes the appointment record from history | Cancelled appointments remain visible in the patient's timeline/history with status "Cancelled" — never hard-deleted (PRD §16.8) |

### Cross-role handoff
- Cancellations feed into Branch Manager's "no-show/cancellation rate" reporting and CRM's recall list if the visit was clinically important (e.g., a follow-up).

---

## A14. Upload Reports

### Scenario
Ramesh brings a printed blood test report from an external lab that the doctor wants on file before today's session.

### Ideal flow
1. From Patient Profile → Documents, Kavya taps **Upload Report**.
2. She can either take a photo/scan directly (see A16 Scan Documents) or upload an existing digital file (PDF/JPG/PNG/HEIC).
3. Before the upload is saved, a **mandatory metadata form** appears (PRD §7.1):
   - Document name (e.g., "CBC Report").
   - Clinical/report date (the date on the actual report — not today's date) — a common receptionist mistake the UI should proactively warn against, e.g. "This date is 3 years old — confirm this is correct?"
   - Category (Lab / Pathology / Imaging / Prescription / External consultation / Consent / Invoice / Other).
   - Source (Patient / External doctor / Laboratory / Hospital / Internal).
   - Optional link to today's visit/order.
4. Upload proceeds with visible progress bar; system runs malware scan (Pending → Clean/Quarantined/Rejected) before the file becomes viewable (PRD §7.1).
5. Kavya sets patient visibility default to **Hidden** (not released to patient app) unless clinic policy differs — release is a doctor decision.
6. Confirmation shows the document now appears in the patient's Documents tab and Timeline, flagged "Unreviewed" for the doctor.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Upload a PDF lab report with correct metadata | Appears in Documents tab, status "Unreviewed," visible to doctor pre-consultation |
| Edge case — upload failure | Wi-Fi drops mid-upload | Upload shows retry option, does not create a broken/partial file record; original never gets silently corrupted |
| Edge case — wrong file type | Kavya accidentally selects a .docx file | System rejects with a clear message ("Unsupported file type — please use PDF/JPG/PNG/HEIC") before wasting an upload attempt |
| Edge case — malware flagged | File comes from a USB stick and is flagged during scan | Document shows "Quarantined — cannot be opened," visible to admin/security review, never openable by any user until cleared (PRD §7.1) |
| Edge case — duplicate report | The same CBC report is uploaded twice by mistake | System detects likely duplicate (same patient, same date, same category) and asks "This looks similar to a report already uploaded on [date] — upload anyway or cancel?" |
| Edge case — missing mandatory metadata | Kavya tries to save without entering the clinical date | Save blocked with inline validation, not a silent default to today's date (a genuinely dangerous default for clinical records) |
| Must NOT allow | Kavya overwrites/replaces the original uploaded file directly | Corrections create a new version; the original file is immutable and retained (PRD §7.1 DOC-003) |
| Must NOT allow | Kavya sets visibility to "Released to patient" for a report she doesn't understand the clinical significance of | Reception can upload and set default visibility to Hidden, but "Release" to patient requires doctor approval — enforced as a separate, higher permission (PRD §7.1, EMR-006) |

### Cross-role handoff
- Uploaded, unreviewed documents appear in the **Doctor's** report-review queue before/during consultation.

---

## A15. Upload Photos

### Scenario
Priya's first laser consultation requires "before" photos of the treatment area (underarms) for doctor assessment and future before/after comparison.

### Ideal flow
1. From Patient Profile → Photos (or directly from the visit/encounter context), Kavya taps **Add Photo**.
2. **Consent check first**: system verifies clinical photography consent is on file; if not, it presents the consent capture screen before the camera even opens (PRD §7.2, §16.4 "Capture screen must show patient, visit, side/body area, purpose and consent status before camera opens").
3. Kavya selects: body region, laterality (left/right/bilateral), and visit/purpose context.
4. Camera opens with a **standardized pose/positioning overlay guide** (distance, angle, lighting cues) to keep before/after comparisons consistent (PRD §7.2 Standardization).
5. **Restricted-area check**: if the selected body region matches a clinic-blocked privacy-sensitive area, the system prevents capture entirely at the UI/API level unless a doctor-authorized exception workflow is separately triggered (PRD §7.2 IMG-003, §16.4).
6. Photo is captured, reviewed for quality (blur/lighting check prompts retake if poor), and saved as the immutable original.
7. Default patient visibility is **Hidden**; release is a doctor/clinic decision (PRD §7.2 Patient release).

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Capture underarm "before" photo with consent on file | Saved with full metadata (visit, date/time, region, laterality, photographer, device), hidden from patient app by default |
| Edge case — no consent yet | Kavya tries to open camera for a first-time patient with no photo consent | Camera is blocked; consent capture screen appears first, camera only unlocks after consent is recorded |
| Edge case — restricted body area | A patient's complaint area happens to be a clinic-blocked privacy-sensitive region | System blocks capture through the UI entirely; only a doctor-initiated, separately consented exception workflow (with chaperone/same-gender rules if adopted) can proceed — receptionist cannot override this (PRD §16.4) |
| Edge case — poor photo quality | Photo is blurry/underlit | System prompts "Photo quality low — retake?" rather than silently accepting an unusable clinical photo |
| Edge case — upload/save failure | Camera capture succeeds but save to server fails (device runs out of storage mid-sync) | Photo remains queued locally for retry; not silently lost, and not falsely marked as "saved" in the UI |
| Must NOT allow | Kavya shares or exports a clinical photo via personal WhatsApp/email to "send to the doctor quickly" | Clinical photos never leave the platform through informal channels; sharing/export uses only the sanctioned in-app access with its own permission and audit (PRD §7.2 Access, high-risk rule) |
| Must NOT allow | Kavya sets a newly captured photo to "Released to patient app" immediately | Release requires explicit doctor/clinic authorization, not a receptionist default action (PRD §7.2 Patient release) |

### Cross-role handoff
- New photos appear in **Doctor's** and **Nurse's** photo/compare workspace tagged "Unreviewed"/pending pairing with future after-photos.

---

## A16. Scan Documents

### Scenario
Ramesh has 3 loose pages of an old prescription from another clinic that need to go on file quickly.

### Ideal flow
1. Kavya taps **Scan Documents** (usable from a tablet/phone camera or a connected desktop scanner).
2. Multi-page capture mode: she scans page 1, sees a live crop/rotate suggestion (auto-detects document edges), confirms, scans page 2, page 3 — building one multi-page document rather than 3 separate uploads.
3. Compression happens automatically without harming legibility; a progress indicator shows upload status per page with retry if any page fails.
4. Before final save, she reviews a **metadata screen** exactly like A14 (name, clinical date, category, source) — applied once to the whole multi-page document.
5. Save creates one document record with page count, immutable original, and "Unreviewed" status.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Scan 3 pages, confirm crop, save with metadata | Single multi-page document created, visible in Documents tab and Timeline |
| Edge case | One page scans blurry/skewed | System flags that specific page for retake without forcing Kavya to redo the whole batch |
| Edge case | Scan interrupted mid-batch (app closed accidentally) | Partially scanned pages are recoverable/resumable, not lost outright, and definitely not silently saved as an incomplete document without her review |
| Edge case | OCR/AI proposes a report date automatically from a scanned prescription | Kavya must actively verify/confirm the AI-suggested date rather than it being auto-accepted (PRD §7.1 "a human must verify structured data") |
| Must NOT allow | Scanned pages get committed to the record before Kavya reviews/confirms metadata | Metadata review is a required checkpoint before commit, per PRD §17.5 "metadata review before commit" |

### Cross-role handoff
- Same as A14 — routes to doctor's review queue.

---

## A17. Create Invoice

### Scenario
Ramesh has just finished session 4 of his laser package (no charge — already paid) plus he wants to buy a home-care serum recommended by the doctor. Priya, after her consultation, needs to pay a consultation fee.

### Ideal flow
1. From the patient's "Awaiting Billing" queue card or Patient Profile, Kavya taps **Create Invoice**.
2. System pre-populates line items automatically from what actually happened during the visit: consultation fee (per doctor/service fee schedule), any treatment session performed (marked "Included in package — ₹0" if applicable, so it's transparent, not hidden), and any products/medicines dispensed.
3. Kavya can add additional items (e.g., the home-care serum) from a searchable product list with live stock/price.
4. Any discount requires selecting a reason and, above a configured threshold, triggers an approval request to Branch Manager rather than letting Kavya apply it unilaterally (PRD §11.3 Controls, §16.6 step-up).
5. Invoice total is calculated with configured tax rules (not hardcoded), shown clearly broken down.
6. Kavya reviews the final invoice summary with the patient before moving to payment.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Invoice with consultation fee + product, no discount | Correct total with tax breakdown, ready for payment |
| Edge case | Package session used — should show ₹0 for the treatment line, not omit it entirely | Line item still appears (transparency) with amount ₹0 and a note "Covered by Package #1234, session 4/6" |
| Edge case | Kavya applies a discount above her authorized threshold | System blocks finalization and routes an approval request to Branch Manager/Accountant; invoice sits in "Pending discount approval" until resolved (PRD §11.3 Controls) |
| Edge case | Product added to invoice but stock is actually zero at this branch | System warns before finalizing: "Item out of stock at this branch — dispense record may fail" and prevents completing the pharmacy-linked dispense without resolving stock |
| Edge case | Patient wants to split payment across cash + UPI | Invoice supports multiple payment modes on the same bill (handled in A18) |
| Must NOT allow | Kavya edits or deletes an already-finalized/paid invoice line item directly | Finalized invoices use amendment/credit-note/reversal workflows, never silent edits (PRD §11.3, §16.8) |
| Must NOT allow | Kavya sees internal cost/margin figures on products while billing | Invoice screen shows sale price only, not purchase cost/margin (PRD §16.2 Confidential financial — no clinical/cost detail beyond role need) |

### Cross-role handoff
- Discount-approval-required invoices route to **Branch Manager**/Accountant.
- Product line items auto-generate a pharmacy dispensing record for **Pharmacy staff**.

---

## A18. Receive Payment

### Scenario
Priya's invoice for ₹1,200 consultation fee is ready. She wants to pay ₹700 by UPI and ₹500 cash.

### Ideal flow
1. From the finalized invoice, Kavya taps **Receive Payment**.
2. She selects payment mode(s): Cash / UPI / Card / Bank Transfer / Other — MVP has no payment gateway, so this is manual entry with a reference field (UPI transaction ID, card last 4 digits, etc.) (PRD §11.3 Payment modes).
3. For split payment, she adds each amount+mode as a separate line until the total matches the invoice amount; system shows a running "Remaining to collect" balance.
4. If the patient can't pay the full amount today, Kavya can record a **partial payment**, leaving a tracked **Due** balance rather than forcing an all-or-nothing entry.
5. On save, system timestamps, records the collecting staff member, and updates the patient's due/paid status instantly.
6. Immediately offers **Print Receipt** (A19).

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Split ₹700 UPI + ₹500 cash = ₹1,200 total | Payment recorded correctly across both modes, invoice marked Paid |
| Edge case — payment failure/mismatch | UPI amount entered doesn't match what patient's app shows they actually sent | Kavya can hold the invoice as unpaid/pending until reconciled — she is not forced to mark it paid on unverified information; a reference/reconciliation note field exists |
| Edge case — underpayment | Patient can only pay ₹800 of ₹1,200 today | System accepts partial payment, invoice shows "Due: ₹400," and a due-payment task/reminder is generated (feeding CRM/Accountant dues report) |
| Edge case — overpayment / refund needed | Patient later says they were double-charged | Refund is a separate authorized action (not a simple negative payment entry) requiring reason and approval, creating a credit note trail (PRD §11.3 Controls) |
| Edge case — cash drawer discrepancy at day's end | Cash collected doesn't match expected total | This surfaces in **Cash Closing**, a Branch Manager/Accountant function — Kavya's individual payment entries remain the audit source of truth for reconciliation |
| Must NOT allow | Kavya issues a refund directly without approval | Refunds require a separate elevated permission/approval workflow, distinct from "receive payment" (PRD §11.3, §3.1) |
| Must NOT allow | Payment recorded with no reference for card/UPI modes | Reference field should be required for traceable modes (configurable), preventing unreconcilable "UPI, no ref" entries |

### Cross-role handoff
- Due balances and refund requests flow to **Cashier/Accountant** and **Branch Manager** dashboards.
- Cash entries feed the branch's daily **Cash Closing** and **Daily Revenue** (Branch Manager module).

---

## A19. Print Receipt

### Scenario
Priya wants a printed receipt for her records/insurance/employer reimbursement.

### Ideal flow
1. After payment is recorded, Kavya taps **Print Receipt** (or later, from the invoice history, "Reprint Receipt").
2. Receipt preview shows: clinic branch details, invoice number, date, patient name (or as configured), itemized charges, tax breakdown, payment mode(s), amount paid, balance due (if any), and authorized signature/stamp line.
3. She can print physically or send a digital copy via WhatsApp/email — but the **content sent externally must remain within the safe-content policy** (a receipt is transactional/financial, generally acceptable to send as itself, but must avoid embedding sensitive diagnosis text even if a line item name hints at a treatment — line items should use configured neutral service names).
4. Reprints are logged (who reprinted, when) without restriction on frequency, but visibly flagged as "Reprint #2" so it's clear it's not the original.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Print receipt immediately after payment | Correct, complete receipt printed/generated |
| Edge case | Printer offline/out of paper | System offers digital receipt (PDF/WhatsApp/email) as an immediate fallback, doesn't block the patient from leaving with proof of payment |
| Edge case | Patient requests receipt days later, wants a duplicate | Reprint accessible from invoice history, clearly labeled as a reprint, with original issue date preserved |
| Edge case | Invoice was later partially refunded | Reprinted receipt reflects the current adjusted state (post-refund) with a note, not the stale original numbers |
| Must NOT allow | Receipt line items expose specific clinical diagnosis phrasing (e.g., "Isotretinoin for cystic acne") in patient-facing print | Service/line item names on receipts use clinic-configured neutral commercial names ("Dermatology Consultation," "Laser Session — Package") rather than raw clinical text (PRD §7.2 high-risk rule extended to printed material) |

### Cross-role handoff
None significant — terminal step of the billing flow.

---

## A20. Recall List

### Scenario
It's a slower Tuesday afternoon. Meera (Branch Manager) has asked Kavya to spend 30 minutes calling patients who missed follow-ups to bring them back in.

### Ideal flow
1. Kavya opens **Recall List** — a worklist of patients whose doctor-set follow-up date has passed without a booked/completed visit, or who no-showed and haven't rebooked (PRD §12.1).
2. Each entry shows: patient name/contact, original follow-up purpose (generic, e.g. "Follow-up: Acne review" — not deep clinical detail), how overdue, last contact attempt, and priority (urgent flags surfaced without exposing raw clinical severity language).
3. Kavya calls or messages each patient and logs the outcome directly on the entry: **Booked / Call Later / Not Interested / Unreachable / Wrong Number / Opted Out** (PRD §12.1).
4. "Booked" outcome links directly into Book Appointment pre-filled with the recall context; other outcomes reschedule the next follow-up attempt automatically per clinic policy (e.g., "Call Later" reappears in 3 days).
5. List can be filtered/sorted by urgency, days overdue, or assigned doctor.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Call Ramesh, he agrees to rebook, Kavya books directly from the recall entry | Outcome "Booked" logged, new appointment created, recall entry closed |
| Edge case | Patient says "call me next week instead" | Kavya logs "Call Later," entry reappears in her worklist automatically at the right time rather than her needing to remember manually |
| Edge case | Number is disconnected/wrong | Logs "Wrong Number" — flags the patient record for a data-correction task rather than silently repeating failed calls forever |
| Edge case | Patient explicitly asks to stop being contacted | "Opted Out" immediately suppresses future recall/marketing contact for that patient across all campaign tools, respecting withdrawal consent rules (PRD §12.4 Withdrawal) |
| Edge case | The recall reason relates to something clinically urgent (e.g., "doctor flagged: recheck in 1 week — concerning finding") | The recall entry shows enough urgency signal to prioritize the call, but the underlying clinical severity/diagnosis text stays out of the CRM-facing text (marketing/recall notes exclude clinical detail, PRD §12.5) |
| Must NOT allow | Kavya sees or is asked to relay the doctor's actual diagnosis reasoning while calling the patient | Recall entries use the doctor's structured follow-up purpose/category, not free clinical narrative (PRD §8.3 "structured follow-up order," §12.5) |

### Cross-role handoff
- Escalates unreachable/urgent recall cases to **CRM/Call Desk** if the clinic has a dedicated call team; Receptionist and CRM share this worklist by design.

---

## A21. Follow-up Booking

### Scenario
Dr. Rina Shah has just signed a note for Priya setting a follow-up in "4 weeks, purpose: assess laser response." Kavya needs to either book it now (if Priya is still at the counter) or ensure the automated reminder plan is armed.

### Ideal flow
1. Kavya opens the **Follow-up Booking** worklist (or is prompted directly if Priya is still checking out): shows the doctor's structured follow-up order — recommended date/window, purpose, priority, preferred doctor/branch (PRD §8.3).
2. If Priya is present, Kavya books it directly into a real slot right then — the ideal, friction-free outcome.
3. If Priya has already left, the system automatically creates a tracked follow-up task and arms the reminder plan (WhatsApp/SMS one day before due date with a secure booking link) without requiring Kavya to do anything further (PRD §12.1, §12.2).
4. If the follow-up date arrives and no appointment exists yet, it appears on Kavya's/CRM's worklist to proactively call rather than waiting passively.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Book Priya's 4-week follow-up while she's still at the counter | Slot reserved directly linked to the doctor's follow-up order, no separate manual reminder needed |
| Edge case | Patient leaves without booking; automated reminder later succeeds and patient books via WhatsApp herself | System recognizes the existing follow-up order is now fulfilled and doesn't double-remind or create a duplicate obligation |
| Edge case | Doctor set a "date window" (e.g., "within 3-5 weeks") rather than an exact date | Booking flow shows the whole window as valid options rather than forcing one exact date |
| Edge case | Preferred doctor for follow-up isn't available in the recommended window | System offers the next closest available slot with that doctor or a clearly flagged "different doctor" alternative, letting Kavya/patient choose knowingly |
| Must NOT allow | The follow-up purpose text shown to reception/patient contains the doctor's full diagnostic reasoning | Follow-up purpose uses the doctor's structured, patient-safe purpose field (e.g., "Laser response review") — not raw clinical assessment text (PRD §8.3, §12.1) |

### Cross-role handoff
- This is inherently a doctor → reception handoff object; if unresolved past due date, it escalates into A20 Recall List.

---

## A22. Send Reminder

### Scenario
Kavya notices tomorrow's queue and wants to make sure a couple of patients who haven't confirmed get a manual nudge beyond the automatic reminder.

### Ideal flow
1. From Today's Queue/Calendar, Kavya selects one or more patients with "Pending confirmation" status and taps **Send Reminder**.
2. System shows which channel(s) are available per patient preference (WhatsApp/SMS/voice) and which **approved template** will be used — Kavya cannot free-type arbitrary clinical content into an external message (PRD §12.4 DLT/WhatsApp policy).
3. Preview shows exact message content before sending: generic appointment info + secure manage link, no diagnosis/treatment detail (PRD §7.2 high-risk rule, §12.2).
4. On send, delivery status becomes trackable (Sent → Delivered → Read/Answered → Failed) in the Notification Center.
5. If a patient has opted out of a channel, that channel is simply unavailable/greyed out for them — not silently sent anyway.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Send WhatsApp reminder to 3 pending-confirmation patients | Each gets the approved template message; delivery status tracked individually |
| Edge case | Patient has opted out of WhatsApp but not SMS | Only SMS option is available/selectable for that patient; WhatsApp is disabled with a clear reason shown |
| Edge case | WhatsApp provider is down | System falls back to SMS/voice automatically or clearly tells Kavya to try another channel — doesn't fail silently (PRD §2.2 Safe failure, NTF-007) |
| Edge case | Reminder sent but patient number is invalid/no longer in service | Delivery status shows "Failed — invalid number," prompting Kavya to verify contact details (A5 Edit Patient) |
| Must NOT allow | Kavya composes a custom free-text WhatsApp/SMS message containing treatment details ("your laser session for underarm hair") | Outbound business-initiated messages must use approved templates with safe generic content; free-text with clinical content is blocked by design (PRD §12.4 DLT/WhatsApp policy, high-risk rule) |

### Cross-role handoff
- Failed deliveries surface to **CRM/Call Desk** for manual phone follow-up.

---

## A23. WhatsApp

### Scenario
Kavya wants to check whether Ramesh actually read yesterday's reminder and confirmed his appointment, without personally texting him from her own phone.

### Ideal flow
1. Kavya opens the **WhatsApp** communication panel from the patient profile or Notification Center — a unified, auditable view of all business-initiated WhatsApp interactions with that patient (never her personal WhatsApp).
2. She sees message history: template sent, delivery/read status, and any button interactions the patient made (e.g., "Confirmed," "Reschedule requested").
3. If the patient replied with a reschedule request via WhatsApp, it appears here as a **Pending Approval** item routed the same way as A12, so Kavya can act on it from within ClinicOS, not by chatting back informally.
4. Outside the permitted service window, Kavya sees a clear note that only approved templates can be used to re-engage; if she genuinely needs to reach the patient, she uses the phone/call option instead — never bypasses this by using her own personal number.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Confirm Ramesh read and clicked "Confirm" on yesterday's reminder | Status shows "Delivered → Read → Confirmed," visible timeline |
| Edge case | Patient replies with a free-text question ("Can I bring my sister too?") outside structured buttons | System surfaces this as a human-escalation item for Kavya to respond to using an approved channel/method, not auto-processed as a booking action (PRD §12.3 step 6) |
| Edge case | Patient requests reschedule via WhatsApp interactive button | Automatically creates a Pending Approval reschedule request, doctor/branch notified, exactly mirroring A12 (PRD §12.3) |
| Must NOT allow | Kavya sends a personal, unapproved free-text WhatsApp message with appointment/clinical details from her own number | All patient-facing WhatsApp communication flows through the platform's approved-template, audited channel — not personal devices/accounts (PRD §12.4 WhatsApp policy, §16.1 "No surprise disclosure") |
| Must NOT allow | Kavya can see WhatsApp messages between the patient and a different branch's receptionist without relevant access | Message history respects branch/relationship scoping like any other patient data (PRD §16.2) |

### Cross-role handoff
- Reschedule/booking requests via WhatsApp feed the same appointment workflow as any other channel (A8/A12).

---

## A24. SMS

### Scenario
An elderly patient without WhatsApp/smartphone needs appointment confirmations by SMS only.

### Ideal flow
1. Kavya sets/confirms the patient's preferred channel as SMS in their profile (A5/A6).
2. SMS panel shows the DLT-registered sender header and approved template being used (e.g., "AURA36-Your appointment is confirmed for {date} {time} at {branch}. Call {phone} for help.") — Kavya cannot send arbitrary unregistered text in production (PRD §12.4 DLT/SMS policy).
3. Delivery status (Sent/Delivered/Failed) is visible per message.
4. If SMS fails (e.g., DND registry block for promotional-category messages, though transactional should be exempt), Kavya sees the failure reason and can escalate to a phone call.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Send appointment confirmation SMS to a DND-registered number using a transactional template | Delivered successfully since transactional messages are typically DND-exempt when properly registered |
| Edge case | SMS marked as failed due to invalid/inactive number | Kavya is alerted to verify the contact number in the patient profile |
| Edge case | Clinic hasn't yet completed DLT template registration for a new use case | That message type is simply unavailable to send until registered — system doesn't allow sending unregistered content in production (PRD §12.4, NTF-003) |
| Must NOT allow | Kavya types a custom SMS body outside the approved template library | No free-text SMS composer is exposed for business-initiated messages in production; only approved templates with variable slots are usable |

### Cross-role handoff
None beyond the shared notification/delivery-status system also used by A22/A23.

---

# PART B — BRANCH MANAGER

## B1. Branch Dashboard

### Scenario
Meera starts her day at the Adajan branch and needs a command-center view: staffing status, queue health, revenue so far, and any pending approvals waiting on her.

### Ideal flow
1. Meera logs in; dashboard is scoped strictly to her branch (Adajan) by default, with no cross-branch data unless she's separately granted multi-branch oversight (PRD §3 Branch Admin row).
2. Key widgets: today's queue snapshot (waiting/in-consultation/in-treatment counts and average wait time), staff attendance status (who's checked in/late/absent), today's revenue running total vs. yesterday/same-day-last-week, stock alerts (low stock/near expiry counts), and a **pending approvals** inbox (discount approvals, roster change conflicts, reschedule mass-approvals).
3. A "Doctor status" row shows which doctors are on shift, running late, or on approved leave today.
4. One-click drill-downs into Queue Monitor, Staff Attendance, Daily Revenue, Stock, and Branch Reports.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Open dashboard at 9 AM | All widgets load with current, branch-scoped data within 2s |
| Edge case | A doctor calls in sick with 6 booked patients today | Dashboard surfaces urgent banner requiring Meera's action: reassign, mass-reschedule, or escalate to Owner if no substitute available |
| Edge case | Revenue is significantly below the same day last week | Widget highlights the variance (not just raw number) so Meera notices trends, not just totals |
| Edge case | Meera also has oversight of a second branch temporarily (e.g., covering for another manager on leave) | Branch switcher available, but each branch's data remains clearly separated and never blended into one misleading aggregate view unless she explicitly opens a "combined" view she's authorized for |
| Must NOT allow | Branch Dashboard shows another branch's revenue, staff, or patient data without explicit grant | Server-side branch scoping enforced regardless of what the UI attempts to render (PRD §3, §16.6 Authorization) |
| Must NOT allow | Dashboard exposes detailed patient clinical content (diagnosis, prescriptions) | Branch Manager's view is operational/financial/staffing — not a clinical record viewer (PRD §16.2, §3 restriction) |

### Cross-role handoff
- Doctor-unavailable and major revenue-variance alerts may escalate to **Owner** if beyond Meera's resolution authority (e.g., needing a locum doctor approved).

---

## B2. Queue Monitor

### Scenario
Meera notices from her dashboard that average wait time has crept up to 40 minutes and wants to understand why and intervene.

### Ideal flow
1. Meera opens **Queue Monitor** — a management-level version of the receptionist's Today's Queue, but branch-wide across all doctors/rooms simultaneously, with wait-time analytics overlaid (not just individual patient cards).
2. She sees which doctor/room is the bottleneck (e.g., "Dr. Shah's queue: 6 waiting, avg wait 45 min" vs. another doctor with an empty queue).
3. She can message the front desk/doctor directly from here ("Can we route the next 2 walk-ins to Dr. X instead?") or trigger a queue reassignment with reason, same audit rule as A2.
4. Historical comparison: today's wait time vs. this branch's typical Tuesday — helping her judge if this is a real problem or normal variance.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Identify Dr. Shah's queue is the bottleneck and reassign 2 walk-ins to another available doctor | Reassignment completes with reason logged, both patients notified of doctor change, queue rebalances |
| Edge case | Only one doctor is on shift and there's genuinely no way to rebalance | System shows the honest constraint rather than suggesting an impossible reassignment; Meera's only real levers are managing patient expectations/priority, not fabricating capacity |
| Edge case | A patient has been waiting far longer than anyone else with no clear reason | Monitor flags outlier wait times distinctly (e.g., red highlight) so Meera can personally check in, rather than it being buried in a long list |
| Must NOT allow | Meera reassigns a patient to a doctor without the required credential/protocol authorization for that patient's treatment type | Reassignment still respects service-doctor eligibility rules — not a pure convenience override (PRD §4.3 Staff skill, TRT-003) |

### Cross-role handoff
- Direct extension of Receptionist's A2 Queue — Meera's actions here are visible live to reception staff.

---

## B3. Staff Attendance

### Scenario
It's 9:10 AM and Meera needs to know who has actually clocked in today, since one technician, Jignesh, hasn't shown up and there's a laser session booked at 9:30.

### Ideal flow
1. Meera opens **Staff Attendance** — a live roster-vs-actual view for today: scheduled staff, check-in time, status (On time / Late / Absent / On leave / Half-day), and any notes.
2. Jignesh shows as "Not checked in — scheduled 9:00 AM," flagged in an "attention needed" state once he's meaningfully late per configured threshold.
3. Meera can call him directly from the app (tap-to-call), mark his status manually if he calls in sick ("Absent — reported"), and immediately see which of today's bookings are now at risk (the 9:30 laser session) so she can arrange a substitute or proactively reschedule that patient — closing the loop with reception rather than leaving it to chance.
4. She can also log a **manual attendance correction** for herself/others with a reason (e.g., biometric device malfunction) — always audited, never a silent edit.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | All staff check in on time | Dashboard shows a clean all-green roster |
| Edge case | Technician doesn't show up, has a booked treatment session | System proactively cross-references today's schedule and flags "1 booking at risk due to staff absence" so Meera doesn't have to manually cross-check two separate screens |
| Edge case | Staff member checks in from an unexpected location/device (potential buddy-punching concern) | If the clinic uses geo/device-based check-in, an anomaly flag appears for Meera's awareness — informational, not auto-punitive |
| Edge case | Manual attendance correction needed | Meera edits with a mandatory reason; system keeps the original recorded time alongside the correction for audit (PRD §16.8 audit — no silent overwrite) |
| Must NOT allow | Meera edits another branch's staff attendance | Attendance edit scope is limited to her own branch's roster (PRD §3 Branch Admin restriction) |
| Must NOT allow | Attendance records are silently deleted rather than corrected | Corrections are additive/audited, never a raw delete (PRD §16.8) |

### Cross-role handoff
- Attendance gaps affecting bookings trigger a direct handoff to **Receptionist** (reschedule/notify affected patients) and, if unresolved, escalate to **Owner** for locum/backup staffing decisions.

---

## B4. Staff Schedule

### Scenario
Meera needs to build next week's roster, making sure there's always at least one dermatologist and one technician covering laser hours, while respecting approved leave requests.

### Ideal flow
1. Meera opens **Staff Schedule** — a weekly/monthly grid of all branch staff (doctors, nurses, technicians, reception, pharmacy) with their assigned shifts.
2. She drags to assign shifts, with the system warning if a shift leaves a required skill/coverage gap (e.g., "No treatment technician assigned Thursday 2-6 PM despite 3 laser sessions already booked").
3. Approved leave/blocked time is shown as read-only on top of the grid — she can't accidentally schedule someone who's on approved leave; if she needs to override, it requires an explicit reason and possibly leave-cancellation coordination with that staff member.
4. For doctors who work across branches (like Dr. Rina Shah), her schedule here is read-only/informational — cross-branch doctor rostering is centrally managed (PRD §4.2), and Meera can only manage local branch staff shifts and see doctor availability for local planning purposes.
5. Publishing the new schedule notifies affected staff and updates the availability engine feeding Book Appointment.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Build a full week's roster with no gaps | Schedule saves, staff notified, availability engine updated for booking |
| Edge case | Meera tries to schedule a technician during their approved leave | System blocks or requires explicit override + reason; leave data is respected, not just visually decorative (PRD §4.2 roster/leave rules) |
| Edge case | A coverage gap exists (no technician during booked laser hours) | Warning shown proactively before publishing, not discovered later when a patient can't be treated |
| Edge case | Meera tries to edit Dr. Rina Shah's cross-branch roster directly from this screen | Not permitted here — doctor central roster is managed at the org/admin level; Meera can request a change but not directly overwrite the doctor's multi-branch schedule (PRD §4.2, §3 role boundaries) |
| Must NOT allow | Publishing a schedule that creates a doctor double-booking across branches | Global collision check still applies even though Meera is working at branch level (PRD §4.2, APT-008) |

### Cross-role handoff
- Cross-branch doctor scheduling conflicts escalate to **Organization Admin/Owner**.
- Published schedule changes propagate automatically to **Receptionist's** Book Appointment slot availability.

---

## B5. Branch Calendar

### Scenario
Meera wants a bird's-eye operational view of the whole branch's day — all doctors, all rooms/devices — to spot resource bottlenecks before they become patient complaints.

### Ideal flow
1. Meera opens **Branch Calendar** — similar to the Receptionist's Calendar (A9) but with a management lens: resource utilization view (rooms/devices, not just doctors), and the ability to see aggregate load, not just individual bookings.
2. She can filter to "Room 2" or "Laser Device #1" to see its full day's utilization and identify idle gaps she could sell into or bottleneck hours needing a second unit/room.
3. She can review (not necessarily perform) pending approval requests across the branch and delegate/approve directly from here if she has that authority.
4. Drag-and-drop adjustments follow the exact same resource-revalidation rules as A9 — management doesn't get a shortcut around real constraints.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | View Room 2's utilization for the day | Accurate, real-time view of bookings and gaps |
| Edge case | Two different services are both trying to claim the same laser device in overlapping windows | Calendar clearly visualizes the conflict; system would have already prevented double-booking at creation, but Meera can audit "how did this almost happen" via any near-miss/override logs |
| Edge case | Meera wants to approve a doctor's pending custom-time request directly from the branch calendar | Approval action available inline if her role includes that authority, and it follows the same server-side resource re-validation as anywhere else |
| Must NOT allow | Meera overrides a real resource conflict just to "make the calendar look full" | Resource rules are enforced server-side; management convenience never bypasses collision prevention (PRD §6.2, §15.4) |

### Cross-role handoff
- Shared object with **Receptionist's** Calendar and **Doctor's** calendar — same underlying data, role-appropriate lens.

---

## B6. Daily Revenue

### Scenario
At 6 PM, Meera wants to close out the day financially: total collected, by payment mode, by doctor/service, and flag any discrepancies before the cashier does the physical cash count.

### Ideal flow
1. Meera opens **Daily Revenue** — a real-time-updating summary: total invoiced, total collected, outstanding dues created today, breakdown by payment mode (cash/UPI/card/other), by doctor, by service category, and any discounts/refunds applied with their approval trail.
2. Comparison against yesterday and the same weekday last week/month for quick trend-spotting.
3. She can drill into any invoice from here for detail, and see which discount/refund approvals are still pending her sign-off.
4. This feeds directly into (but is distinct from) the physical Cash Closing process — Daily Revenue is the system-of-record total; Cash Closing (owned by Accountant/Cashier, with Branch Manager approval) reconciles actual cash counted against it.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Review the day's revenue at close | Accurate totals matching individual invoice/payment records exactly |
| Edge case | A large discount was applied earlier in the day pending Meera's approval and she forgot to act on it | It's still visibly flagged as "Pending your approval" in this view at day's end, not silently expired or auto-approved |
| Edge case | Revenue significantly under target for the day | Widget/report highlights the shortfall with drill-down (e.g., "Fewer treatment sessions completed than booked — 3 no-shows") rather than just a flat number |
| Edge case | A payment was recorded with a mismatched/unverifiable UPI reference (from A18) | Flagged here for reconciliation before day-close, not silently counted as clean revenue |
| Must NOT allow | Meera edits a finalized invoice's amount directly from this report to "fix" a discrepancy | Corrections must go through the proper amendment/refund workflow with audit — reports are read-only views of the ledger, not editable surfaces (PRD §16.8, §11.3) |
| Must NOT allow | Daily Revenue shows purchase cost/margin data mixed into the same view without appropriate permission | Cost/margin is a separate, more restricted financial view (PRD §16.2 Confidential financial) |

### Cross-role handoff
- Feeds into **Cashier/Accountant's** Cash Closing and **Owner's** consolidated Revenue Dashboard across branches.

---

## B7. Stock

### Scenario
Meera gets a message from Jignesh that the branch is nearly out of a key laser gel/consumable, and she needs to check stock levels and decide whether to request a transfer from the Vesu branch or place a new purchase order.

### Ideal flow
1. Meera opens **Stock** (branch-scoped inventory view): current quantities, reorder-level alerts (low stock), near-expiry/expired batch alerts, and pending GRN/transfer status.
2. She can see the item in question, its current quantity vs. reorder level, and recent consumption rate (so she can judge urgency, not just a raw number).
3. She initiates either a **Transfer Request** to another branch with available stock (Request → Approve → Dispatch → In Transit → Receive workflow, PRD §11.2 Transfer) or flags it for the next **Purchase Order** if it's a genuine reorder situation.
4. Expired/near-expiry batches are clearly separated and cannot be accidentally dispensed — the system already blocks expired-batch dispensing at the pharmacy/treatment level (PRD §11.2 Controls), and Meera's view is where she monitors this risk proactively.

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Spot low-stock alert, initiate transfer request from Vesu branch | Transfer request created, both branches see status through to reconciliation |
| Edge case | Requested transfer item isn't actually available at the other branch either | System shows real-time cross-branch stock visibility before Meera wastes a request, or the request is created but immediately flagged "may not be fulfillable — check with branch" |
| Edge case | An item shows in stock but a chunk of that quantity is actually an expired batch | Stock view separates usable vs. expired quantity clearly — "50 units total, 30 usable, 20 expired — awaiting disposal" — not one misleading combined number |
| Edge case | Meera tries to manually adjust stock count to match a physical recount that's off | Manual adjustment requires reason and, above a threshold, approval — never a silent overwrite of the stock ledger (PRD §11.2 Controls, negative-stock prevention) |
| Must NOT allow | Meera dispenses/sells stock directly from this management view bypassing the pharmacy dispensing workflow | Stock view here is for monitoring/transfer/purchase decisions — actual dispensing against a prescription/sale remains the Pharmacy role's workflow with its own linkage rules (PRD §11.2, §11.4 INV-003) |
| Must NOT allow | Negative stock is allowed to be recorded silently | System prevents negative stock without an explicit, audited adjustment reason (PRD §11.2 Controls) |

### Cross-role handoff
- Transfer requests are two-way with the receiving/sending branch's manager.
- Low-stock/expiry alerts also visible to **Pharmacy/Medical Staff** who execute the actual purchase/dispensing actions.

---

## B8. Branch Reports

### Scenario
Owner Arjun Mehta asks Meera for a quick summary of the Adajan branch's performance this month — appointments, revenue, no-show rate, and treatment conversion — before their weekly review call.

### Ideal flow
1. Meera opens **Branch Reports** — a filter-builder style report center scoped to her branch: pick report group (Appointments, Revenue, Doctor performance, Patient retention, Inventory, CRM/source conversion), date range, and any sub-filters (doctor, service).
2. Report renders as both a chart and an underlying table, with the metric definitions visible (e.g., what exactly counts as a "no-show") so there's no ambiguity when she presents numbers upward (PRD §14.3 Reporting rules — "Shared metric dictionary").
3. She can save a report as a personal/branch view for recurring weekly use, and export to PDF/CSV/XLSX for the Owner meeting — export uses a separate permission and is itself audited (PRD §14.3, §16.8).
4. Large reports (e.g., a full year of data) generate asynchronously with a notification when ready, rather than freezing her screen (PRD §14.3, NFR-002).

### Test cases

| Type | Scenario | Expected result |
|---|---|---|
| Happy path | Generate this month's Appointment + Revenue summary for Adajan | Accurate report matching underlying data, clear filter/date state shown |
| Edge case | Meera requests a very large date range (e.g., 3 years) | Report runs asynchronously; she's notified when the download is ready rather than the UI hanging |
| Edge case | Meera tries to view/export another branch's data for comparison | Blocked unless she has been explicitly granted multi-branch or consolidated-view access; she can request it, but can't just widen a filter into unauthorized scope (PRD §14.3 "Authorized branch selection," §3) |
| Edge case | Report definitions seem to differ from what the Owner's consolidated dashboard shows for the same metric | Because of the shared metric dictionary rule, this should not happen — if it does, it indicates a bug, and the report should show its calculation method transparently for troubleshooting |
| Must NOT allow | Branch Reports exposes patient-level clinical details (e.g., a report row listing individual diagnoses) | Reports at this level are aggregate/operational/financial, not row-level clinical exports; patient-level clinical detail remains outside Branch Manager's report scope (PRD §16.2, §14.3 "does not automatically grant unrestricted patient-level clinical access") |
| Must NOT allow | Meera exports a sensitive report (e.g., staff performance with disciplinary implications) without the export being logged | All exports are audited regardless of role (PRD §16.8 Data administration — Export) |

### Cross-role handoff
- Feeds directly into **Owner's** consolidated Branch Performance/Revenue dashboards — same underlying data, rolled up across branches.
- Any anomaly requiring policy-level action (e.g., persistent high no-show rate, low conversion) is the trigger for Meera to escalate a written note/recommendation to **Owner**.

---

# Appendix — Key PRD Cross-References Used Throughout

| Business rule | PRD reference | Where applied above |
|---|---|---|
| Queue default sort = appointment/arrival time; manual jump needs reason | §6.5 | A2, A10, B2 |
| Front Desk Handoff Note — categories, prohibited content, audit | §5.3 | A4, A6 |
| Duplicate patient detection, no silent auto-merge | §5.2, PAT-001 | A4 |
| Availability engine formula (doctor ∩ branch ∩ service ∩ room ∩ device ∩ staff − leave/blocks/buffers) | §6.2 | A8, A9, A12, B4, B5 |
| Pending Approval for custom/off-slot requests | §6.2, §6.3 | A8, A12, A23 |
| Restricted clinical data hidden from Receptionist/Branch Manager views | §16.2, §3 | A6, A7, A14, A15, B1, B8 |
| Clinical photo consent-before-capture and restricted-area blocking | §16.4, §7.2 | A15 |
| No diagnosis/clinical detail in external WhatsApp/SMS/push | §7.2 high-risk rule, §12.4 | A19, A22, A23, A24 |
| Manual payment modes only, split/partial/due, refund needs approval | §11.3 | A17, A18, B6 |
| Discount/refund/void approval thresholds and audit | §11.3, §16.6 | A17, B6 |
| Append-oriented audit, no silent overwrite/delete | §16.8 | A5, A13, B3, B6 |
| Branch-scoped access, deny-by-default server-side authorization | §3, §16.6 | Throughout Part B |
| Stock transfer/purchase workflow, expired-batch controls | §11.2 | B7 |
| Recall worklist outcomes and opt-out suppression | §12.1, §12.4 | A20 |
| Reporting: shared metric dictionary, async export, branch-scope | §14.3 | B8 |

---

*Document prepared as a redesign reference for Aurah 360 ClinicOS — Receptionist and Branch Manager role flows. Cross-checked against `aurah_prd.md` (v1.0, 04 August 2026) and `Aurah360_ClinicOS_Role_Based_UI_Screens.md`.*


---

# Doctor & Nurse / Clinical Assistant

# Aurah 360 ClinicOS — Doctor & Nurse/Clinical Assistant Flows and Test Cases
### Ideal Redesign Reference (Not Constrained by Current Build)

**Purpose of this document:** This is a from-scratch, ideal-world design of every screen/functionality listed for the **Doctor** and **Nurse / Clinical Assistant** roles in the Aurah 360 ClinicOS role-based screen inventory. It is written for a future redesign — it does **not** describe how the current web app happens to be built. Every flow is grounded in the PRD's business rules (consent-before-photo, AI de-identification and human-in-the-loop, sign/lock/amend, hard stops for patch test/consent/contraindications, privacy classification, audit).

**Cast of characters used throughout:**
- **Dr. Ananya Shah** — senior dermatologist, Aurah 360 Surat (Adajan branch), does laser hair reduction (LHR), acne, pigmentation, PRP.
- **Dr. Rohan Mehta** — dermatologist, floats between Adajan and Vesu branches on different days.
- **Nurse Priya Solanki** — Clinical Assistant, Adajan branch, handles intake, vitals, photos, treatment prep.
- **Patient Meera Patel** — 29F, returning patient, LHR underarms + upper lip, session 6 of 8.
- **Patient Kabir Joshi** — 34M, new patient, acne + post-acne scarring.
- **Patient Ishaan (7M)** — new pediatric patient, minor, brought by mother for a mole check (guardian consent needed).

---

## How to read this document

Each module has:
1. **Real-life scenario & ideal step-by-step flow** (click-by-click, in plain language).
2. **Test cases table** — happy path, edge cases, "must NOT allow" cases.
3. **Cross-role handoffs.**
4. **PRD business-rule cross-references** (cited as `§section`).

---

# PART A — DOCTOR ROLE

## A1. My Dashboard

### Scenario
It's 8:50 AM. Dr. Ananya Shah logs into her tablet before clinic opens at 9:00 AM. She wants a 30-second orientation to her day — not analytics, just "what do I need to know before I start."

### Ideal flow
1. Dr. Shah logs in (MFA already set up on her staff account, §16.6). Landing screen is **My Dashboard**, scoped only to her own patients/branch — never a generic admin-style KPI wall (§14.1: "Doctor: Today's patients, waiting/consulting/treatment states, follow-ups, report review and requested appointments").
2. Top strip: today's date, branch (Adajan), her name/photo, a single toggle if she's also rostered at Vesu today (cross-branch color/badge, §4.2).
3. Card 1 — **Today's snapshot**: total patients today (14), how many already checked in (3), new vs returning split, first-slot time.
4. Card 2 — **Needs your attention now**: red-flagged items bubble to the top — e.g., "Kabir Joshi: patch test result pending review", "Meera Patel: front-desk handoff note marked Doctor Attention", "2 lab reports awaiting your review."
5. Card 3 — **Pending approvals**: treatment orders she raised yesterday that are still "Awaiting Consent" or "Awaiting Resource" in the nurse/technician queue.
6. Card 4 — **Follow-ups due this week** for her patients, with one-click "review and confirm."
7. One primary button: **Start My Day → Today's Patients.**
8. No irrelevant charts, no revenue/inventory noise (§17.1, §14.3 "management summary access does not automatically grant unrestricted patient-level clinical access" — same logic in reverse, doctor dashboard stays clinical, not financial).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| DASH-01 | Happy path | Dr. Shah logs in at 8:50 AM | Dashboard loads <2s (§NFR-002), shows only her/her branch's data |
| DASH-02 | Edge | Dr. Shah is rostered at both Adajan (AM) and Vesu (PM) today | Dashboard shows a branch switcher with a clear badge; patient counts split per branch, never merged silently |
| DASH-03 | Edge | A red-flag handoff note exists but doctor hasn't acknowledged it | "Needs attention" card persists across page reloads until acknowledged; acknowledgment is timestamped and audited (§5.3) |
| DASH-04 | Edge | Network/AI provider is down | Dashboard still loads fully (no AI widgets on this screen depend on live AI call) — safe failure (§2.2 "Safe failure") |
| DASH-05 | Must NOT allow | — | Doctor must NOT see another doctor's patient list or another branch's financial/revenue figures without explicit multi-branch privilege (§3, role table) |

### Cross-role handoff
Nurse's morning huddle notes (vitals flagged abnormal, missing consents) surface here as "needs attention" — nurse enters them in Patient Queue/Vitals, doctor sees the rollup.

---

## A2. Today's Patients

### Scenario
Dr. Shah taps "Today's Patients" to see her actual list before her 9 AM slot.

### Ideal flow
1. List/kanban view with columns: **Waiting → In Consultation → Awaiting Treatment → In Treatment → Awaiting Billing → Completed** (§6.3 state machine, §17.4 "Doctor My Day").
2. Each patient card: preferred name, age, MRN (masked to last 3 digits in list view per §16.2 "masked list display where possible"), appointment time, elapsed wait time, service, new/returning tag, any allergy/red badge, and the "front desk handoff" flag icon if reception left a note.
3. Cards sorted by appointment time by default; doctor can filter by branch (if cross-branch today), status, or search a specific patient.
4. Tapping a card opens a quick-preview drawer: last visit summary, chief complaint captured by nurse, vitals if taken, consent status — before fully opening the consultation, so the doctor isn't surprised mid-room.
5. Elapsed-time color changes (not color-only — also a numeric "42 min waiting" label) if a patient has waited long, per §17.1 "status never communicated by color alone."
6. One-tap "Call in" moves the patient card to In Consultation and opens the Consultation workspace directly.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| TP-01 | Happy path | Meera Patel checked in 10 min ago for her 11 AM LHR follow-up | Card shows in "Waiting," elapsed timer live, tapping "Call in" opens her Consultation screen pre-loaded with LHR session-6 context |
| TP-02 | Edge | Two patients scheduled at the same time due to overbooking permission | Both appear, doctor manually chooses order; no system auto-merge |
| TP-03 | Edge | Walk-in added mid-morning by reception | New card appears in real time without full-page refresh; ordering follows configured priority rule with a "manual jump requires reason" audit if reception queue-jumped (§6.5) |
| TP-04 | Edge | Patient has an unresolved "Doctor Attention" handoff note | Red badge is persistent and cannot be dismissed by simply opening the chart — requires explicit acknowledge action |
| TP-05 | Must NOT allow | — | Doctor list view must NOT display full unmasked MRN/government ID or another doctor's patients in a shared branch view (§16.2) |

---

## A3. My Calendar

### Scenario
Dr. Mehta wants to see his week across two branches to decide whether he can fit in an extra Saturday slot for a returning laser patient.

### Ideal flow
1. Views: Day / Week / Month / Agenda, with a resource-aware but simplified skin (§6.4, §17.7 — standard FullCalendar views; Premium resource-timeline is a licensing decision, not exposed to doctor as raw complexity).
2. Filter chips: All branches / Adajan / Vesu, service type, status, source.
3. His own appointments always in one consistent color; a branch badge (small colored tag) distinguishes Adajan vs Vesu blocks so he never mistakes location (§4.2 "Same doctor keeps one consistent color; branch badge prevents wrong-location confusion").
4. Blocked/leave time and travel buffer between branches shown as gray "unavailable" blocks — he cannot drag a booking into a travel-buffer slot.
5. Tapping an appointment opens the event drawer: patient summary, visit state, contact preference, handoff note, and permitted quick actions (confirm, propose alternate time, mark no-show) — never a full record edit from calendar view (§6.4).
6. Drag-and-drop reschedule (if he has permission) triggers resource re-validation and a preview of the patient notification before committing (§6.4).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| CAL-01 | Happy path | Dr. Mehta views his week, sees Adajan (blue) AM blocks and Vesu (orange) PM blocks | Clear visual separation with badges, no overlap |
| CAL-02 | Edge | Dr. Mehta tries to drag a Vesu 5:30 PM appointment to 5:00 PM right after an Adajan 4:45 PM slot ends, violating travel buffer | System blocks the drop and explains: "Travel buffer required between branches (30 min)" |
| CAL-03 | Edge | Double-booking attempted across branches due to a race condition (two staff booking simultaneously) | Global collision check + DB locking/idempotency ensures only one commits (§6.2, §18.3) |
| CAL-04 | Edge | Doctor requests leave day after some slots already confirmed | System flags impacted appointments and requires reassign/reschedule/override with audit trail, not silent cancellation (§4.2) |
| CAL-05 | Must NOT allow | — | Doctor must NOT be able to bypass the availability engine (doctor ∩ branch hours ∩ room ∩ device ∩ staff) by direct drag-drop without server revalidation (§6.2, §17.7) |

---

## A4. Patient List

### Scenario
Dr. Shah wants to pull up a patient she saw two months ago (Meera Patel) without going through today's queue.

### Ideal flow
1. One prominent search box: search by name, mobile, MRN — tolerant of spacing/case/transliteration (§NFR-006).
2. Recent patients and "my patients" shown by default before typing.
3. Results show masked identity fields (last visit date, service, next follow-up chip) — full detail only after opening the profile.
4. Duplicate-candidate warning surfaces if a near-duplicate name/mobile exists, but doctor cannot merge (that's a reception/admin action) — doctor can only flag it for reception review.
5. Opening a patient goes to **Patient 360**: summary, timeline, documents/photos, encounters, treatments, prescriptions — tabs, not everything on one page (§17.4).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| PL-01 | Happy path | Search "Meera" → Meera Patel (MRN AUR-00123) appears with last visit date | Opens her 360 profile in <1.5s (§NFR-006) |
| PL-02 | Edge | Search returns two "Meera Patel" with different mobile numbers | Both shown distinctly with masked mobile suffix to disambiguate, no auto-merge |
| PL-03 | Edge | Doctor searches a patient not assigned to them / different branch, no relationship | Either blocked or shown with limited read (per organization's cross-branch access policy, §3 "access follows branch/relationship") |
| PL-04 | Must NOT allow | — | Search must NOT expose the entire patient database indiscriminately or leak full identity of unrelated patients in autocomplete (§NFR-006 "without exposing whole database") |

---

## A5. Consultation (workspace)

### Scenario
11:00 AM. Nurse Priya has already roomed Meera Patel: confirmed chief complaint ("6th LHR session, underarms + upper lip, no new reactions"), checked no new medication, and flagged in the system "patient reports mild tanning last week — flag for doctor before laser." Dr. Shah taps "Call in" from Today's Patients.

### Ideal flow
1. **Sticky patient header** (persists while scrolling): preferred name, MRN, age, allergy/high-risk badges, branch, visit reason, consent state, and the nurse's tanning flag prominently visible (§17.2, §8.2 "Patient strip").
2. **Left panel — Timeline**: prior visits, diagnoses, prescriptions, treatments, photos, reports, filterable by type/date, so Dr. Shah can scroll to session 5's before photo instantly (§8.2).
3. **Center panel — Current note**: structured SOAP sections pre-populated with nurse's intake (complaint, duration, vitals) which she reviews and edits, not retypes (§8.1, §8.2).
4. **Right panel — AI assist + quick actions**: suggested questions ("Ask about sun exposure/tanning given laser today"), copy-previous button (shows source date, requires active review before signing — §16.10), favorite templates, "Add photo," "Order treatment," "Set follow-up," "Prescribe."
5. **Status rail** at top/bottom: Waiting → Consultation → Treatment/Billing → Complete, with "next responsible team" indicator (e.g., "Nurse: prep LHR device" once she signs the order).
6. She reviews the tanning flag, examines the underarm/upper-lip area, decides: tanning is mild, defer laser 1 week rather than proceed — this becomes the **Plan**.
7. She documents assessment, writes plan ("defer LHR by 7 days, reschedule, apply sunscreen"), and does NOT order treatment today.
8. She sets a follow-up (7 days) and signs the note. Signing locks it; the visit moves to **Awaiting Billing** (consultation fee only) then **Completed**.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| CON-01 | Happy path | Dr. Shah completes consultation, defers laser, signs note | Note locked, follow-up created, visit routes to billing, nurse queue does NOT get a treatment order |
| CON-02 | Edge | Doctor closes the tab mid-note without saving | Autosave draft preserved with visible "draft saved 12:03 PM" indicator; reopening restores it (§8.3, §17.5 "Autosave is allowed for drafts, never for final clinical signature") |
| CON-03 | Edge | Two browser tabs open with the same patient (doctor forgot she had Meera open elsewhere) | System shows a "this patient is already open in another session" warning to prevent conflicting edits (§18.3) |
| CON-04 | Edge | Doctor tries to sign the note but a mandatory field (assessment) is empty | Blocked with inline validation, not a generic error (§17.5, §17.8) |
| CON-05 | Must NOT allow | — | Doctor must NOT be able to silently edit and re-save an already-signed note from a previous visit without triggering the addendum/amendment workflow (§8.3, §16.10) |
| CON-06 | Must NOT allow | AI provider is down mid-consult | Consultation must continue fully manually; AI panel shows "unavailable" state, never blocks Save/Sign (§2.2, §9.2, §18.3) |

### Cross-role handoff
Nurse's intake (vitals, chief complaint, tanning flag) flows directly into the doctor's SOAP draft. Doctor's decision to defer treatment flows back to nurse as "no session today — reschedule in 7 days," preventing the nurse from prepping the laser device unnecessarily.

---

## A6. SOAP Notes

### Scenario
For Kabir Joshi (new acne patient), Dr. Shah uses the acne-specific structured template instead of freeform text.

### Ideal flow
1. Template picker offers clinic-approved, versioned templates: "New Dermatology Patient," "Acne," "Pigmentation," "Hair Loss," "PRP," "LHR," "Scar," "Procedure Follow-up" (§8.1).
2. Structured fields: Subjective (complaint, duration, triggers), Objective (examination findings, photos linked inline), Assessment (diagnosis, favorites + optional ICD-style code while preserving free text — §8.3), Plan (prescription, investigation, treatment plan, follow-up).
3. Each section shows a completion indicator; doctor can jump between sections via a stepper, not one endless scroll (§17.5).
4. Quick phrases/favorites available per section (e.g., "Comedonal acne, mild-moderate, face" as one tap).
5. Voice dictation optional: doctor dictates objective findings; transcript appears for review — raw audio not retained, transcript must be reviewed before it's part of the record (§8.4, §9 image/voice AI policy).
6. Comments can be tagged staff-only / internal clinical / patient-facing at the point of typing (§8.3).
7. Sign & Lock button is disabled until mandatory sections (Assessment + Plan) are filled.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| SOAP-01 | Happy path | Dr. Shah picks "Acne" template, fills S/O/A/P, signs | Locked note stored, versioned template reference retained even if template is later updated (§16.10 "Historical encounters retain the version used") |
| SOAP-02 | Edge | Doctor uses voice dictation, transcript has a clear error ("comedonal" mis-transcribed) | Doctor must review/edit transcript before it can be signed; nothing auto-signs from voice (§8.4) |
| SOAP-03 | Edge | Doctor copies-forward last visit's SOAP for a returning patient with stale data (e.g., old medication list) | Copied content is visibly marked "from [date] — review required"; doctor must actively touch/confirm before signing (§16.10 "stale values cannot be signed invisibly") |
| SOAP-04 | Edge | Doctor tries to sign with Assessment filled but Plan empty | Blocked, inline message: "Plan is required before signing" |
| SOAP-05 | Must NOT allow | — | A signed SOAP note must NOT be directly editable in place after signing — any change requires a dated, authored addendum (§8.3, §16.10, §NFR-005) |

---

## A7. Medical History

### Scenario
Dr. Shah opens Kabir Joshi's Medical History tab before deciding on isotretinoin for his acne.

### Ideal flow
1. Structured, chronological view: past conditions, past treatments/procedures, current medicines, allergies (pulled live from Allergies module, shared with nurse), family history if relevant, skin/hair-specific history (skin type, tanning/photosensitivity, keloid tendency, isotretinoin history, pregnancy/lactation status where relevant) — §8.1.
3. Each entry shows source (self-reported at registration, nurse intake, prior doctor note) and date, never presented as unverified fact if it's OCR-extracted from an uploaded old report (§7.1, §13.2).
4. Doctor can add/correct an item; correction is versioned, not overwritten silently.
5. A "contraindication check" strip surfaces automatically: e.g., "Patient history: keloid tendency — flag before any ablative procedure."

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| MH-01 | Happy path | Doctor reviews Kabir's history, confirms no isotretinoin history, no keloid tendency | Clean history displayed with source/date tags |
| MH-02 | Edge | An old report was OCR-scanned by reception and a value hasn't been human-verified yet | Value is shown labeled "unverified — pending review," never presented as confirmed clinical fact (§7.1 "OCR/AI may propose... a human must verify") |
| MH-03 | Edge | Doctor edits an incorrect allergy entry that a nurse had entered | Change is versioned with author/timestamp; old value retrievable in audit, not deleted |
| MH-04 | Must NOT allow | — | Medical history must NOT silently merge two different patients' history even if names are similar — every entry stays scoped to one MRN (§16.2, §NFR-006) |

---

## A8. Diagnosis

### Scenario
Dr. Shah finalizes Kabir's diagnosis: "Moderate inflammatory acne with early post-inflammatory hyperpigmentation."

### Ideal flow
1. Searchable diagnosis field with clinic/doctor favorites first, optional code mapping (e.g., ICD-style) shown alongside — but free text is always preserved, never forced into a rigid code-only field (§8.3 "Diagnosis uses favorites and optional code mapping while preserving free text").
2. Multiple diagnoses supported (primary + secondary) with a simple add-row pattern, not a cramped single line.
3. Diagnosis is tagged for visibility: internal clinical (default) vs patient-facing summary language (simplified, e.g., "Acne with mild dark spots" for the app-facing text) — §8.3, §13.2.
4. Diagnosis becomes part of the signed note — cannot be changed post-signature without amendment.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| DX-01 | Happy path | Doctor selects "Acne vulgaris, moderate" as primary + "Post-inflammatory hyperpigmentation" as secondary | Both saved, linked to the encounter, code + free text both retained |
| DX-02 | Edge | Doctor types a diagnosis not in the favorites/code list | Free text accepted; system does not force-fit an incorrect code match |
| DX-03 | Edge | Doctor needs to revise diagnosis after signing (lab result came back later confirming something else) | Must use addendum — original diagnosis preserved, new diagnosis appended with reason/date/author (§8.3, §16.10) |
| DX-04 | Must NOT allow | — | Diagnosis must NOT be inferred or auto-filled by AI and silently saved — AI may only *suggest* in the AI panel; doctor must explicitly accept (§9.1, §16.11 "Human review... never auto-diagnosed") |

---

## A9. Prescription

### Scenario
Dr. Shah prescribes topical retinoid + oral antibiotic for Kabir, checking his allergy badge first.

### Ideal flow
1. Allergy/warning badge is visible in the prescription screen itself (repeated from patient header) — doctor cannot prescribe without seeing it (§8.2, §8.3).
2. Medicine autocomplete: brand/generic, form, strength, route, common instructions pre-filled from clinic/doctor favorites, reducing typing (§8.4, §11.1).
3. Duplicate/near-duplicate entries flagged (e.g., accidentally adding the same molecule twice under different brand names).
4. Any medicine interaction/contraindication alert (e.g., isotretinoin + doxycycline interaction) uses a validated data source; doctor can override but override is auditable with reason (§8.4).
5. Each line: medicine, form/strength, dose, route, frequency, duration, instructions, substitution note (allowed/not allowed) — §8.3.
6. Prescription is generated as a structured clinical order; it does not directly touch pharmacy stock — pharmacy fulfillment records actual batch/quantity/substitution separately (§11.1 "Prescription is a clinical order").
7. Doctor signs; prescription becomes part of the locked note and simultaneously appears in the Pharmacy's Prescription Queue (cross-role handoff).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| RX-01 | Happy path | Doctor prescribes topical adapalene + doxycycline, signs | Prescription locked, routed to Pharmacy Prescription Queue instantly |
| RX-02 | Edge — allergy conflict | Patient allergy list shows "Sulfa allergy" and doctor tries to prescribe a sulfa-based drug | Hard warning shown inline at the moment of selection: "Patient has documented Sulfa allergy — confirm override" with mandatory reason field before it can be added; override is audited (§8.4, §16.10 "hard-stop or authorized override according to approved protocol") |
| RX-03 | Edge | Doctor prescribes isotretinoin for a female patient without documented pregnancy/contraception status | System should hard-stop or strongly flag: "Pregnancy/lactation status not confirmed — required before isotretinoin" (§8.1 pregnancy/lactation relevance) |
| RX-04 | Edge | Doctor needs to change a signed prescription (patient calls back with a reaction) | Cannot edit signed prescription directly; must issue an addendum or a new prescription order with a note referencing the original (§8.3, §16.10) |
| RX-05 | Must NOT allow | — | Pharmacy/medical staff must NOT be able to alter what the doctor prescribed; only substitution is separately authorized and logged, never silent substitution (§3 role restrictions, §11.1) |

### Cross-role handoff
Signed prescription flows to Pharmacy's Prescription Queue (Pharmacy role) for dispensing; batch/substitution recorded separately and visible back on the patient timeline.

---

## A10. Investigation (Lab/Report Orders)

### Scenario
Dr. Shah orders a hormonal panel for a hair-loss patient suspected of PCOS-related hair thinning.

### Ideal flow
1. Doctor selects test(s) from a searchable master (or free text if not in master, flagged for admin to add later), specifies reason for test, due date, and preferred provider/lab if external.
2. Order enters a trackable state: **Ordered → Sample/Report Pending → Result Received → Doctor Reviewed** (§8.3 "Lab/report order includes test, reason, due date, provider, result-received and doctor-review states").
3. When result arrives (uploaded by reception/patient via Documents), doctor gets a "Report Review" queue item, not a silent file drop.
4. Doctor reviews, can request AI-assisted summary of the report (flagged, verification required, §9.1) before committing an interpretation to the note.
5. Doctor marks reviewed, adds interpretation to Assessment/Plan, and decides whether to release the raw report to the patient app (separate release control, §7.1, §13.2).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| INV-01 | Happy path | Doctor orders hormonal panel, report uploaded 5 days later, doctor reviews and interprets | Order state moves Ordered→Result Received→Doctor Reviewed; interpretation added to next visit's note |
| INV-02 | Edge | Report uploaded but doctor hasn't reviewed it in 10 days | Report Review backlog surfaces on Doctor Dashboard (§14.1) as an outstanding item |
| INV-03 | Edge | AI is used to summarize a 12-page lab report | AI output is clearly labeled "AI-generated summary — verify before use," with source page references; doctor must verify before saving interpretation (§9.1 "verification required") |
| INV-04 | Must NOT allow | — | An AI-generated report summary must NOT be shown to the patient app as a "verified report result" — only doctor-reviewed content can be released (§13.2 "Unverified OCR/AI extraction never appears as a verified report result") |

---

## A11. Treatment Plan

### Scenario
Dr. Shah creates a treatment plan for Meera Patel's LHR package continuation (once tanning clears).

### Ideal flow
1. Doctor selects service/protocol (LHR — underarms + upper lip), indication, body area(s), number of sessions remaining in her package, urgency, special instructions (e.g., "lower fluence given recent tanning") — §10.1.
2. System automatically checks: required consent on file? patch test valid and not expired? any contraindication flags? package balance sufficient? room/device/staff available? (§10.1 step 2, §10.3).
3. If any prerequisite is missing (e.g., patch test not on file for a new device setting), the plan cannot be finalized as "Ready" — it's created as **Ordered** but blocked from **Ready** until the missing item is resolved, visible to both doctor and nurse/technician queue.
4. Doctor specifies whether this is a same-day treatment (routes to nurse/technician queue immediately) or a future session (creates an appointment + reminder plan) — §10.3 "Same-day treatment routes from consultation; future session creates appointment/task and reminders."
5. Doctor signs the treatment order — it becomes uneditable by staff; only doctor can amend it.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| TRT-01 | Happy path | Doctor orders LHR session 6 for Meera, all prerequisites met, same-day | Order status "Ready," appears instantly in Nurse's Prepare Treatment / Technician's queue |
| TRT-02 | Edge — hard stop | Doctor orders LHR but no patch test on file for this device/setting | System blocks moving the order to "Ready": "Patch test required before this protocol can proceed" — doctor can order "Patch Test" as the actual next step instead (§10.3 "Blocked/maintenance device or expired staff credential prevents normal reservation"; §16.10 hard-stop) |
| TRT-03 | Edge | Doctor orders a treatment for a restricted body area not currently permitted by clinic policy | Order creation requires the same restricted-area exception path as photos — explicit consent + reason + heightened audit, or is blocked entirely if clinic policy disallows (§7.2, §16.4) |
| TRT-04 | Edge | Package balance shows 0 sessions remaining but doctor tries to order anyway | System flags: "Package exhausted — requires new package sale or exception approval," routes to billing/reception rather than silently proceeding |
| TRT-05 | Must NOT allow | — | Nurse/technician must NOT be able to edit a signed doctor treatment order (change body area, sessions, or instructions) — they can only execute against it and record outcomes (§10.3 "staff cannot edit signed doctor order") |
| TRT-06 | Must NOT allow | — | System must NOT allow a treatment to reach "Completed" status while an adverse event on that same session is unresolved/hidden (§10.3 "Adverse event... cannot be hidden by completing billing") |

### Cross-role handoff
This is the central doctor→nurse/technician handoff: the signed order populates the branch staff queue (Nurse's "Prepare Treatment," Technician's "Treatment Queue") with protocol, parameters template, and prerequisites baked in.

---

## A12. Follow-up

### Scenario
Before Meera leaves, Dr. Shah sets a follow-up for 7 days ("reassess tanning, resume LHR if clear").

### Ideal flow
1. Follow-up is a structured order, not free text: recommended date/window (e.g., "in 7 days" or a specific date), purpose ("reassess tanning before resuming LHR"), priority (routine/soon/urgent), preferred doctor (herself) and branch (Adajan) — §8.3, §12.1.
2. On signing, system creates a tracked follow-up task + reminder schedule automatically (§12.1 "System creates follow-up task and reminder schedule; follow-up is not just free-text advice").
3. Doctor sees confirmation: "Follow-up created — reminder will be sent 1 day before due date via WhatsApp/SMS with a secure booking link" (§12.2).
4. If patient already has a future appointment matching, system links to it instead of creating a duplicate ("reminder confirms it rather than asking to book again," §12.1).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| FU-01 | Happy path | Doctor sets 7-day follow-up for Meera | Task + reminder created; visible on Reception's recall list and CRM if missed |
| FU-02 | Edge | Patient misses the follow-up window entirely | Enters Recall worklist for CRM/Call Desk with outcome tracking (Booked/Call Later/Not Interested/Unreachable) — §12.1 |
| FU-03 | Edge | Doctor reschedules her own leave, affecting the day she set for follow-up | System should surface impacted follow-up tasks for reassignment, not silently orphan them |
| FU-04 | Must NOT allow | — | Clinical urgency/diagnosis must NOT appear in the external reminder text sent via WhatsApp/SMS — only generic "your follow-up is due" language with a secure link (§7.2 "High-risk rule," §12.1 "not exposed in external message text") |

### Cross-role handoff
Doctor's follow-up order → Reception's recall/booking list → CRM's missed-follow-up worklist if unresolved. This is explicitly named in the task brief as a required cross-role handoff.

---

## A13. Reports (Doctor's report review screen)

### Scenario
Dr. Shah has 2 pending lab reports to review before her next patient.

### Ideal flow
1. A dedicated "Report Review" queue (also surfaced on dashboard): list of uploaded documents/reports awaiting doctor review, sorted by clinical date and patient urgency.
2. Each entry: patient name/MRN, report type, upload source (external lab, patient self-upload, reception scan), clinical date vs upload date shown distinctly (§7.1).
3. Doctor opens report via short-lived signed URL preview (no public path, §7.1), can annotate/mark abnormal values, and transitions state: Unreviewed → Reviewed / Clarification Needed / Superseded.
4. "Clarification Needed" routes back to reception/nurse to re-contact patient or lab.
5. Doctor decides whether to release the report to the patient app (explicit release toggle, hidden by default).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| REP-01 | Happy path | Doctor reviews hormonal panel, marks reviewed, adds note, releases to patient app | Report state "Reviewed," patient sees it in their app timeline |
| REP-02 | Edge | Uploaded file fails malware scan | File cannot be opened; shown as "Quarantined," doctor is not shown the content, reception is prompted to re-scan/re-upload (§7.1 "unclean files cannot be opened") |
| REP-03 | Edge | Report date field was left as upload date instead of actual report date by reception | Doctor sees a discrepancy warning if report date looks implausible; can send back for correction with an auditable metadata version, original file remains immutable (§7.1) |
| REP-04 | Must NOT allow | — | An unreviewed report must NOT be auto-released to the patient app under any circumstance — release requires explicit doctor action (§13.2) |

---

## A14. Photos

### Scenario
Nurse Priya has already taken standardized consented photos of Meera's underarm area before today's visit (per protocol pre-step). Dr. Shah reviews them during consultation.

### Ideal flow
1. Photos tab shows chronological thumbnails grouped by body region/visit, each tagged with date, body region, laterality, angle/pose, lighting, photographer (§7.2).
2. Doctor can zoom, annotate (non-destructively — annotation creates a derivative, original preserved, §7.2/§16.4), and compare against a prior visit photo directly in this view.
3. Doctor can request additional photos mid-consult by tapping "Request Photo" which creates a task for the nurse (if the nurse is available in-room) or flags it for next visit.
4. Restricted/privacy-sensitive body areas remain blocked unless a doctor-authorized exception with explicit specific consent and heightened audit is invoked (§7.2, §16.4).
5. Consent status for photography is visible right on this tab — if a patient withdrew photo consent, new capture is blocked and existing photos remain per retention policy (§7.2, §18.3).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| PHO-01 | Happy path | Doctor reviews consented underarm photos from today and session-1 photo from 3 months ago | Side-by-side available, both tagged with metadata, no quality loss |
| PHO-02 | Edge — restricted area | Doctor wants a photo of a privacy-sensitive area for a rare clinical reason | Must go through explicit exception flow: specific consent captured, reason logged, restricted-visibility gallery, heightened audit entry created (§16.4) |
| PHO-03 | Edge | Patient withdrew photography consent last week | "Request Photo" action is disabled for new capture; historical photos still viewable per retention policy, with a visible "consent withdrawn on [date]" marker (§7.2) |
| PHO-04 | Must NOT allow | — | Doctor must NOT be able to overwrite or delete the original photo file when annotating — annotation must always produce a separate derivative (§7.2, §16.4 "original file is retained and edited derivative is labeled") |
| PHO-05 | Must NOT allow | — | Photos must NOT be exportable/downloadable by the doctor without a separate download/export permission distinct from view permission (§7.2 "Access: view and download/export permissions separate") |

---

## A15. Before/After

### Scenario
Dr. Shah wants to show Meera her progress across 5 LHR sessions to motivate continued compliance.

### Ideal flow
1. Dedicated before/after comparison view: pick two (or more) time points for the same body region; side-by-side or slider view (§7.2 "Comparison: Before/after pairing, side-by-side/slider and chronology").
2. Clinical meaning is never silently altered — no auto-beautify/crop; any enhancement or overlay is visually disclosed (§16.4 "must not silently crop, beautify or alter clinical meaning... visually disclosed").
3. Doctor can show this to the patient directly on the tablet in the room to build trust — but sharing a copy externally (printing/exporting for patient to take home or for marketing) requires a separate release/marketing consent check, distinct from the internal clinical comparison consent (§16.3 "Before/after internal comparison... is not permission for social media/advertising").
4. If Meera consents specifically for marketing use ("can we use your before/after anonymized for our Instagram?"), that is a completely separate, explicit, granular, revocable consent flow — never bundled with the clinical consent (§16.3).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| BA-01 | Happy path | Doctor shows Meera her session 1 vs session 5 underarm photos in-app | Slider comparison shown, no alteration, both images timestamped |
| BA-02 | Edge | Doctor wants to export the before/after pair for a case-study presentation to peers | Requires separate export permission and, since it involves identifiable patient images, either de-identification or explicit consent for that specific secondary use — logged in audit |
| BA-03 | Edge | Marketing team wants to use Meera's before/after on social media | Requires a distinct marketing/public-image consent captured separately from clinical consent, default OFF, revocable, with an approved-asset workflow before publishing (§16.3, §16.4) |
| BA-04 | Must NOT allow | — | System must NOT allow before/after images to be used for marketing based on the clinical photography consent alone (§16.3 "internal clinical comparison is not permission for social media/advertising") |

---

## A16. AI Assistant (panel overview)

### Scenario
During Kabir's acne consultation, Dr. Shah wants quick AI help without breaking her flow or risking privacy exposure.

### Ideal flow
1. AI Assistant lives as a right-hand panel inside the Consultation workspace (not a separate chat app) — always visible but never blocking (§8.2, §17.4).
2. It offers four sub-functions accessible via tabs/buttons: **AI Summary**, **AI Questions**, **AI Draft Notes**, and (during treatment ordering) **Treatment checklist assist**.
3. Every AI output carries a visible "AI Suggestion" label and a timestamp/model version footer; nothing from this panel is ever auto-saved into the clinical record (§8.2 "AI panel: ...never auto-saved," §9.1, §16.11).
4. Before any AI call, the system's context builder assembles only current-patient, current-visit, de-identified data (no name/phone/email/address/government ID/exact MRN) using a short-lived pseudonymous token (§9.2, §16.11).
5. If the AI provider times out or is unreachable, the panel shows "AI unavailable right now — continue manually" and the rest of the consultation is entirely unaffected (§9.2, §18.3).
6. Every suggestion has three explicit actions: **Accept** (inserts as-is into the note, still requires doctor's own save/sign), **Edit & Accept** (opens it in an editable field first), **Reject** (dismissed, optionally with a quick reason for AI-quality feedback). The accept/edit/reject decision is recorded in the AI audit trail (§9.2, §16.11).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| AIA-01 | Happy path | Doctor opens AI panel, gets a suggested question list, accepts 2, edits 1, rejects 1 | Each decision recorded with model/prompt version in AI audit; only accepted/edited items appear in the note after doctor explicitly inserts them |
| AIA-02 | Edge | Doctor tries to close consultation with an AI suggestion still sitting unresolved (not accepted or rejected) in the panel | Fine — unresolved suggestions do not block signing; they simply are not part of the record (since nothing is auto-saved) |
| AIA-03 | Edge | AI provider returns malformed/unsafe content | Structured output validation catches this; panel shows a safe fallback error, not the raw broken output (§9.1, §16.11 "Structured output validation, unsupported-claim warning") |
| AIA-04 | Must NOT allow | — | The AI panel must NOT retain memory/context from a different patient's earlier session in the same login — each request is isolated per current-patient-context token (§9.2 "No global cross-patient chat memory," §AI-008) |
| AIA-05 | Must NOT allow | — | Raw AI prompts/responses containing clinical data must NOT appear in ordinary application logs, analytics, or crash reports (§9.2, §16.11 "Monitoring... no raw restricted data in telemetry") |

---

## A17. AI Summary

### Scenario
Meera has 6 prior visits; Dr. Shah wants a 10-second refresher before the consult rather than scrolling the whole timeline.

### Ideal flow
1. Doctor taps "AI Summary" — system builds a de-identified manifest of Meera's current-patient timeline (visits, prior LHR sessions, reactions, medicines) and requests a structured JSON summary (§9.1 "Timeline summary," §9.4 AI-003).
2. Output renders as a short structured card: "5 prior LHR sessions (underarm, upper lip), last session 3 weeks ago, no adverse reactions reported, current package: 2 sessions remaining," with a source-reference link back to each underlying record so the doctor can verify with one tap.
3. Doctor reads it, cross-checks against the actual timeline panel (still visible on the left), and proceeds — the AI summary is a reading aid, never a substitute for the actual record.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| AIS-01 | Happy path | Doctor requests summary, gets accurate structured recap with source links | Summary displayed with "AI Suggestion — verify" label; clicking a claim jumps to the underlying visit record |
| AIS-02 | Edge | AI summary omits a documented adverse event from session 3 | Since doctor is expected to cross-check against the real timeline (not solely rely on AI), and evaluation processes track omission rate (§16.11 "Evaluation... omission... metrics"), the omission should be a caught/tracked model-quality issue, but the doctor is never absolved of checking the real record |
| AIS-03 | Must NOT allow | — | The AI summary must NOT include another patient's data even if they share a similar name/condition — isolation is per-patient-context token (§9.2) |

---

## A18. AI Questions

### Scenario
For Kabir's first visit, Dr. Shah wants to make sure she doesn't miss standard acne-workup questions.

### Ideal flow
1. Based on the complaint/history entered so far ("acne, 8 months, jawline+cheeks, worsens before periods... wait, Kabir is male" — AI reads actual entered data), AI proposes a list of suggested follow-up questions and missing fields: "Ask about family history of acne," "Ask about current skincare/steroid cream use," "Confirm no isotretinoin history" (§9.1 "Suggested questions").
2. Doctor can tap any question to auto-insert a corresponding field/prompt into the SOAP Subjective section, ask it verbally to Kabir, then type the answer herself.
3. Nothing here diagnoses — it only prompts for more complete data collection.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| AIQ-01 | Happy path | AI suggests 5 relevant questions, doctor accepts 3 | Accepted questions' answers get typed by doctor into the note; AI never fills the answer itself |
| AIQ-02 | Edge | AI suggests a question already answered (redundant) | Harmless — doctor simply rejects/ignores it; feedback loop can be used to tune future suggestions |
| AIQ-03 | Must NOT allow | — | AI Questions must NOT pre-fill assumed answers on the doctor's behalf (e.g., assuming "no allergies") — it only asks, doctor/patient provides the actual answer (§9.1, §16.11) |

---

## A19. AI Draft Notes

### Scenario
Dr. Shah dictates her findings for Kabir out loud; she wants AI to structure it into a SOAP draft so she isn't typing during the exam.

### Ideal flow
1. Doctor selects facts/dictation to feed the draft (explicit selection, not blanket "read everything") — §9.1 "Draft note: Doctor's selected facts/dictation."
2. AI proposes a structured SOAP draft in the note editor, visually distinguished (e.g., a light highlight/border) as "AI-drafted — unreviewed."
3. Doctor reads through, edits freely inline (AI-drafted text becomes normal editable text the moment she touches it), and only signing converts it into the permanent record.
4. If she rejects the whole draft, the editor reverts to blank/manual entry — no partial ghost content lingers.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| AID-01 | Happy path | Doctor dictates exam findings, accepts AI's SOAP structuring, edits two lines, signs | Final signed note reflects doctor's edits; AI-drafted vs doctor-edited provenance recorded in AI audit (§9.2 "doctor accept/edit/reject result") |
| AID-02 | Edge | AI draft contains an unsupported clinical claim (e.g., states a diagnosis not actually discussed) | Structured output validation / unsupported-claim warning should flag it before insertion; doctor must not sign it unexamined (§16.11 "unsupported-claim warning") |
| AID-03 | Must NOT allow | — | An AI draft note must NOT be sign-able with a single click without the doctor having had the draft rendered as editable/reviewable text first — no "auto-sign AI draft" shortcut can exist (§9.1, §16.11 "never auto-signed") |

---

## A20. Approve Treatment

### Scenario
Nurse Priya has finished prepping Meera for the deferred LHR session next week and flags "patch test refreshed, tanning cleared — ready for doctor approval to proceed."

### Ideal flow
1. Doctor gets a queue item: "Meera Patel — LHR session 6 — awaiting your approval to proceed" with the nurse's readiness checklist attached (tanning resolved: yes, patch test valid: yes, consent current: yes, package balance: 2 sessions left).
2. Doctor reviews the checklist, examines the area quickly (or via photo if remote-review is acceptable per clinic policy — but typically in person), and taps **Approve** — this transitions the treatment order from "Ordered/Waiting Resource" to "Ready," releasing it into the technician's active queue.
3. Alternatively, doctor can **Modify & Approve** (e.g., reduce fluence given recent tanning) or **Hold** (still not resolved, needs another week) or **Escalate** (concerning finding, converts to a full consultation instead of straight-to-treatment).
4. This is a genuine clinical checkpoint — treatment never starts on staff's own initiative without this doctor gate for anything beyond the originally signed parameters.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| APT-01 | Happy path | All prerequisites green, doctor approves | Order moves to "Ready," technician queue is unblocked, timestamp/approver recorded |
| APT-02 | Edge | Nurse's checklist shows patch test expired (validity window passed) | Approve button disabled/hard-stopped until a fresh patch test is recorded — cannot be approved around it (§10.3, §16.10 "hard-stop... according to approved protocol") |
| APT-03 | Edge | Doctor wants to reduce fluence from the originally signed parameters | "Modify & Approve" creates a parameter amendment linked to the original order with reason, rather than silently changing the signed order's history |
| APT-04 | Must NOT allow | — | A treatment technician/nurse must NOT be able to self-approve a treatment that requires doctor sign-off — the Approve action is restricted to the doctor role only (§3, §10.3) |
| APT-05 | Must NOT allow | — | System must NOT allow approval when there is an unresolved adverse event flag from a prior session for this same protocol/patient (§10.3 "Adverse event... cannot be hidden by completing billing") |

### Cross-role handoff
This screen is the direct doctor-side mirror of the nurse's "Prepare Treatment" screen — nurse readies and flags, doctor approves, technician executes.

---

## A21. Treatment History

### Scenario
Before approving Meera's session 6, Dr. Shah quickly checks her full LHR treatment history for any prior adverse reactions.

### Ideal flow
1. Chronological list of all treatment sessions for this patient: date, protocol + version used, operator, parameters, consumables, outcome notes, any adverse events, linked before/after photos (§10.2 "Versioning: Completed sessions keep the used protocol version").
2. Adverse events are never hidden or minimized — they appear with severity, escalation status, and closure state even if the session's billing was completed (§10.3, §16.10 "Adverse event workflow captures severity, onset, treatment, escalation, responsible clinician, follow-up, attachments and closure").
3. Package usage visible: sessions used vs remaining, without exposing internal cost/margin (§10.4 "Patient app shows package progress... without internal cost/margin" — same principle applies to doctor's clinical view, which sees usage not internal financials).
4. Doctor can drill into any single session to see exact protocol parameters that were used (important for consistency across sessions).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| TH-01 | Happy path | Doctor reviews Meera's 5 completed LHR sessions, all clean | History displayed with protocol version per session, no adverse events |
| TH-02 | Edge | Session 3 had a mild adverse event (redness lasting 48h) that was resolved | Event is visible in history with full detail (onset, treatment given, closure date) — cannot be filtered out or hidden by a "completed" filter |
| TH-03 | Edge | Protocol was updated (new version) between session 4 and 5 | Session 4 still displays the old protocol version's exact parameters; session 5 shows the new version — no retroactive rewriting of historical parameters (§10.2 "Versioning") |
| TH-04 | Must NOT allow | — | Treatment history must NOT allow retroactive editing of a completed session's recorded outcome/parameters by anyone, including the doctor, without an auditable correction/addendum mechanism (§NFR-005, §16.10) |

---

# PART B — NURSE / CLINICAL ASSISTANT ROLE

## B1. Dashboard

### Scenario
8:45 AM, Nurse Priya Solanki logs in at Adajan branch to prep for the day before doctors arrive.

### Ideal flow
1. Landing screen scoped to her branch only: today's patient count, how many need intake before their appointment, pending treatment prep tasks, and any doctor-flagged items requiring her follow-through (e.g., "Doctor Shah requested patch test redo for Meera before next LHR session") — §14.1 "Treatment staff: Ordered/ready/in-progress sessions, missing consent/patch test."
2. "Needs prep now" card: patients arriving in the next hour who haven't had vitals/history/photos taken yet.
3. "Treatment prep queue" card: signed treatment orders from doctors awaiting her checklist work.
4. One primary action: **Start Queue → Patient Queue.**

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| ND-01 | Happy path | Priya logs in, sees 6 patients today, 2 need intake in next 30 min | Dashboard accurate and branch-scoped |
| ND-02 | Edge | A doctor's treatment order was just signed while Priya's dashboard is open | New item appears in her prep queue without requiring manual refresh (event-driven, §2.2 "Event-driven automation") |
| ND-03 | Must NOT allow | — | Nurse dashboard must NOT show billing/revenue figures or other branches' data — scope limited to her clinical prep role (§3, §14.1) |

---

## B2. Patient Queue

### Scenario
Priya needs to know who to bring in next and in what order.

### Ideal flow
1. Queue list mirrors the walk-in/waiting queue (§6.5): token number, arrival time, scheduled time, doctor, room, current stage (Waiting/Intake-in-progress/Ready-for-doctor).
2. Sorted by appointment time/arrival by default; manual reordering (e.g., an anxious walk-in) requires a reason, which is audited (§6.5 "manual jump requires reason").
3. Each row shows a simple "Needs: Vitals, History, Allergies check, Photo" checklist chip so Priya knows exactly what's outstanding for that patient before the doctor calls them.
4. Tapping a patient opens a guided intake flow rather than a blank record — the same guided pattern for every patient, so an 11th-pass-support-staff-level user can complete it without a manual (§NFR-019, §17.8).
5. Optional public-facing waiting display shows only token/initials, never full name or diagnosis (§6.5).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| PQ-01 | Happy path | Priya works through the queue in appointment order, completing intake for each | Each patient's "Needs" chip clears as she completes items; doctor sees "Ready" status appear on their Today's Patients |
| PQ-02 | Edge | A walk-in patient with visible distress needs to jump the queue | Priya manually reorders with a mandatory reason ("patient in visible discomfort"), logged and visible to admin/doctor |
| PQ-03 | Edge | Public waiting-room display is on in the lobby | Only token number/initials shown — no name, no diagnosis, no photo (§6.5) |
| PQ-04 | Must NOT allow | — | Nurse must NOT be able to mark a patient "Ready for doctor" while a mandatory intake item (e.g., allergy check) is still unconfirmed — the guided flow blocks completion until required steps are done |

---

## B3. Patient Vitals

### Scenario
Priya takes Meera's vitals before her LHR follow-up (not always required for LHR, but standard for new patients / any patient on isotretinoin-adjacent care).

### Ideal flow
1. Simple, large-touch-target form: height/weight (if relevant), BP, pulse, temperature, SpO2 as configured per visit type/protocol — not a one-size-fits-all form for every visit (some services skip vitals entirely by protocol config, §10.2 "Pre-steps... vitals").
2. Values entered once become part of the patient's current visit record and are visible to the doctor in the Consultation's patient strip/timeline immediately (§8.2).
3. Abnormal values trigger an inline flag (e.g., BP unusually high) that both stays with the record and surfaces on the doctor's "needs attention" queue — not a silent data point buried in a table.
4. Autosave as she enters, but final "Confirm vitals" action locks the entry as part of that visit — later correction requires a note/reason (parity with clinical record integrity principles, §NFR-005).

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| VIT-01 | Happy path | Priya records BP 118/76, pulse 72, confirms | Values appear instantly in doctor's consultation view |
| VIT-02 | Edge | BP reads 168/100 (significantly high) for a patient about to get a laser procedure | System flags this prominently to both nurse and doctor before treatment prep continues — not just stored quietly |
| VIT-03 | Edge | Priya mis-enters a value and needs to correct it 2 minutes later, before doctor has seen it | Edit allowed with a lightweight correction (since not yet doctor-reviewed/signed), but still timestamped; once the encounter is signed by doctor, any further correction needs a proper amendment note |
| VIT-04 | Must NOT allow | — | Nurse must NOT be able to alter vitals values silently after the doctor has already reviewed/signed the encounter referencing them — must go through correction/addendum with audit (§NFR-005) |

### Cross-role handoff
Vitals feed directly into the doctor's Consultation patient strip — explicitly named in the task brief as a required handoff.

---

## B4. Medical History (nurse intake)

### Scenario
Priya conducts structured intake for Kabir Joshi, a brand-new patient, before Dr. Shah sees him.

### Ideal flow
1. Nurse works through the specialty-appropriate template (e.g., "New Dermatology Patient" intake) confirming chief complaint, duration, body area, current medicines, past conditions, and skin/hair-specific history fields (skin type, tanning tendency, keloid tendency, isotretinoin history, pregnancy/lactation where relevant) — §8.1.
2. This is intake/confirmation, not diagnosis — nurse records what the patient reports; she cannot finalize any clinical interpretation (§3 "Cannot finalize diagnosis/prescription").
3. Any missing mandatory item is visibly flagged as incomplete and surfaces to the doctor before consultation starts ("2 missing items" badge) — §8.1 "Missing mandatory items... are visible before consultation."
4. Once complete, she marks intake "Complete" and the patient's queue chip updates to "Ready" for that section.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| MHI-01 | Happy path | Priya completes Kabir's full intake template | Doctor sees complete pre-consult data pre-loaded into the SOAP subjective section |
| MHI-02 | Edge | Patient can't clearly answer a history question (language barrier, minor patient) | Nurse can mark "unable to confirm — verify with doctor" rather than guessing/fabricating an answer |
| MHI-03 | Edge | Ishaan (7-year-old) is the patient; his mother is answering on his behalf | System requires guardian relationship/authority to be recorded before intake proceeds (§5.1 "Guardian/dependent," §PAT-005) |
| MHI-04 | Must NOT allow | — | Nurse must NOT be able to enter a diagnosis or finalize an assessment field — those fields are doctor-only and not exposed as editable to the nurse role (§3) |

---

## B5. Allergies

### Scenario
Priya double-checks Kabir's allergy status, since this feeds directly into what Dr. Shah can safely prescribe later.

### Ideal flow
1. Dedicated Allergies module (not just a text field buried in history) — structured entries: allergen, reaction type, severity, source (patient-reported/documented), date recorded.
2. Nurse actively asks and records "No known drug allergies" as a positive confirmed entry, not just leaves it blank (blank ≠ confirmed-none; this distinction matters clinically).
3. Any allergy entered here immediately populates the allergy badge visible everywhere downstream: doctor's patient header, prescription screen, treatment order screen (§8.2, §8.3).
4. Severe/anaphylaxis-level allergies get a distinct high-visibility marker, not styled the same as a mild rash note.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| ALG-01 | Happy path | Priya records "Sulfa drugs — moderate rash reaction, patient-reported, 2019" | Allergy badge appears on Kabir's record everywhere immediately |
| ALG-02 | Edge — allergy conflict | Later, Dr. Shah tries to prescribe a sulfa-based drug for Kabir | Prescription screen surfaces the allergy warning inline at the moment of drug selection, requiring override+reason if she proceeds (cross-reference to A9/RX-02) |
| ALG-03 | Edge | Patient says "no known allergies" | Nurse explicitly records "No Known Drug Allergies — confirmed [date]" rather than leaving the field empty, so it's clear the absence was checked, not skipped |
| ALG-04 | Must NOT allow | — | An allergy entry, once recorded and relied upon in a signed clinical decision, must NOT be silently deleted — correction requires a dated update with reason, old value remains in audit trail (§NFR-005, §16.8) |

### Cross-role handoff
Nurse's allergy entry is the safety-critical feed into the doctor's Prescription and Treatment Plan screens (RX-02, TRT-02 style hard stops depend on this data being accurate and current).

---

## B6. Clinical Photos

### Scenario
Per the LHR protocol's pre-step, Priya takes today's standardized underarm photo of Meera before the doctor's review (protocol requires photo before every 3rd session).

### Ideal flow
1. Before the camera opens, screen confirms: patient identity, visit, body area, purpose, and current consent status (§16.4 "Capture screen must show patient, visit, side/body area, purpose and consent status before camera opens").
2. If consent isn't on file or has expired/been withdrawn, the capture button is disabled with a clear reason and a prompt to route to reception/doctor to re-obtain consent — capture cannot proceed around this (§7.2 IMG-001, §16.4).
3. If the requested body area is on the clinic's restricted list, standard capture is blocked entirely; only a doctor-authorized exception flow (separate, heightened-audit path) can proceed (§7.2 IMG-003, §16.4).
4. For allowed areas, a standardized pose/angle overlay guide appears (distance marker, lighting check, left/right labeling) so photos are comparable session-to-session (§7.2 "Standardization").
5. Nurse captures, reviews quality (retake if blurry/poorly lit), and the system auto-attaches metadata: date/time, region, laterality, angle, photographer (her), device.
6. Original file is immutable from this point; nothing else in the app can overwrite it later (§7.2 "Original preservation").

### Test cases

| ID | Type | Scenario | Edge case | Expected result |
|---|---|---|---|---|
| CP-01 | Happy path | Priya photographs Meera's underarm with consent on file, standard area | — | Photo captured with full metadata, added to timeline, visible in doctor's Photos tab |
| CP-02 | Edge — missing consent | Priya tries to photograph a new patient who hasn't signed photo consent yet | — | Capture button disabled; system shows "Photo consent required — route to reception" |
| CP-03 | Edge — restricted area attempt | A doctor's order calls for documentation of a groin-area treatment response | — | Standard capture blocked server-side (not just hidden in UI); only the explicit doctor-authorized exception workflow (specific consent + reason + restricted gallery + heightened audit) can proceed, and that authorization step is not available to the nurse alone — requires doctor sign-off (§16.4, §7.2 IMG-003) |
| CP-04 | Edge | Photo comes out blurry | — | Nurse retakes; blurry version can be discarded before it's committed as the visit's official photo (pre-commit quality check, not a permanent immutable record yet) |
| CP-05 | Must NOT allow | — | — | Nurse must NOT be able to bypass the restricted-area block via API/UI trick — enforcement is server-side, not just a disabled button (§7.2 IMG-003 "enforced server-side") |
| CP-06 | Must NOT allow | — | — | Once a photo is committed to the record, nurse must NOT be able to delete or replace the original file — only doctor/authorized correction workflow with audit can supersede it, and even then original is retained (§7.2 "Original preservation") |

---

## B7. Compare Photos

### Scenario
Priya prepares a before/after comparison for Dr. Shah to review at the start of Meera's consultation, saving the doctor time.

### Ideal flow
1. Nurse selects two (or more) time points for the same body region/angle and generates a side-by-side or slider comparison — the same underlying comparison engine used in the doctor's Before/After screen (§7.2 "Comparison").
2. This is preparation only — the nurse's role is to have the comparison ready and queued for the doctor's review; she cannot use this to draw or record a clinical conclusion herself (§3 "Cannot finalize diagnosis").
3. Any enhancement/overlay applied for clarity (e.g., brightness-matching for fair comparison) is visually disclosed as an adjustment, never presented as the untouched original (§16.4).
4. The prepared comparison surfaces directly inside the doctor's consultation workspace/timeline when she opens Meera's chart — no separate email/screenshot workaround.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| CMP-01 | Happy path | Priya compares session-1 vs today's photo, flags it ready for doctor | Doctor sees it pre-loaded in Meera's Photos/Before-After tab when consultation opens |
| CMP-02 | Edge | The two photos being compared were taken at different distances/lighting | System should support/encourage brightness or scale normalization for fair comparison but must visually disclose that an adjustment was applied (§16.4) |
| CMP-03 | Must NOT allow | — | Nurse must NOT annotate a clinical interpretation onto the comparison (e.g., writing "no improvement seen") as if it were a doctor's assessment — any nurse note stays clearly attributed as a staff observation, not a diagnosis (§3, §8.3 comment classification) |

---

## B8. Upload Reports

### Scenario
Kabir brought a printed dermatology report from his previous clinic; Priya scans it into his file before the consultation.

### Ideal flow
1. Nurse uses camera/scanner: multi-page capture, auto-crop/rotate, compression, batch upload with progress and retry (§7.1 "Multi-page camera scan, crop, rotate, compression, batch upload and progress/retry").
2. Mandatory metadata entry before it's saved: document name, actual clinical/report date (not today's upload date), category (external consultation report, in this case), source (external doctor), and any related visit link (§7.1 metadata table).
3. File goes through a malware scan state (Pending→Clean/Quarantined/Rejected); if not Clean, it cannot be opened even by the doctor (§7.1).
4. Nurse cannot mark it "Reviewed" — only "Unreviewed," ready for doctor; the review-state transition to Reviewed belongs to the doctor.
5. Original file remains immutable; if she mis-typed the report date, a correction creates a version, not an overwrite.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| UR-01 | Happy path | Priya scans a 3-page report, tags date/category/source, uploads | File appears in Kabir's Documents tab, state "Unreviewed," awaiting doctor |
| UR-02 | Edge | Nurse forgets to set the clinical date, leaving it defaulted to today | System should require the field as mandatory before save completes — cannot save with a blank/assumed clinical date (§7.1 "Clinical/report date: Mandatory; original date, not upload date") |
| UR-03 | Edge | File fails the malware scan | File shown as "Quarantined"; neither nurse nor doctor can open it; reception/IT notified to obtain a clean copy |
| UR-04 | Must NOT allow | — | Nurse must NOT be able to mark an uploaded external report as "Reviewed" (clinically endorsed) — that determination is doctor-only (§3, §7.1 review states) |

### Cross-role handoff
This mirrors Reception's own "Upload Reports" capability — either role can capture documents, but only the doctor reviews/releases them.

---

## B9. Prepare Treatment

### Scenario
Dr. Shah's signed order for Meera's LHR session 6 ("Ordered," pending prerequisites) lands in Priya's Prepare Treatment queue.

### Ideal flow
1. Priya sees the order with the doctor's exact instructions (body area, protocol, any special notes like reduced fluence) — she can see but not edit the signed parameters (§10.3 "staff cannot edit signed doctor order").
2. A guided checklist appears, generated from the versioned protocol config (§10.2): confirm consent on file, confirm patch test valid, confirm no new contraindications since last visit (asks the tanning/sun-exposure/medication-change questions), confirm room/device availability, prepare consumables.
3. Any mandatory checklist step cannot be skipped without a documented reason and appropriate permission — e.g., if patch test is expired, she cannot just tick past it; she can only escalate to doctor to order a fresh patch test (§10.1 step 4, §16.10 hard-stop).
4. Once all pre-steps are green, she marks the order "Ready — awaiting doctor approval" (feeding into the doctor's Approve Treatment screen, A20) or, depending on clinic role config, directly into the technician's active queue if doctor pre-approved the whole protocol category.
5. If something is off (patient mentions a new skin reaction), she raises an escalation flag rather than silently proceeding or silently cancelling.

### Test cases

| ID | Type | Scenario | Expected result |
|---|---|---|---|
| PT-01 | Happy path | Priya works through the checklist for Meera's session 6, everything green | Order status updates to "Ready," visible on doctor's Approve Treatment and technician's queue |
| PT-02 | Edge — patch test missing | Checklist step "Patch test valid" fails because it's expired | Step is hard-blocked; nurse cannot mark it complete; system suggests "Order new patch test" action, which routes back through doctor (§10.3, §16.10) |
| PT-03 | Edge — new contraindication surfaces | While asking prep questions, patient mentions she started a new photosensitizing medication last week | Nurse flags this immediately as a blocking item for doctor review — cannot self-clear it and proceed to "Ready" |
| PT-04 | Edge — device/room unavailable | The LHR device is in a "Maintenance" blocked state | System prevents reservation; checklist shows "Device unavailable," and reschedule/alternate-device workflow is suggested rather than forcing through (§10.3 "Blocked/maintenance device... prevents normal reservation") |
| PT-05 | Must NOT allow | — | Nurse must NOT be able to change the doctor's signed treatment parameters (e.g., changing body area or session count) while preparing — she can only report readiness/blockers against the existing order (§10.3) |
| PT-06 | Must NOT allow | — | Nurse must NOT be able to mark a treatment "Ready" while a mandatory pre-step (consent, patch test, contraindication check) is unresolved — no shortcut/override available to her role; only doctor can authorize an override, and even that is reasoned and audited (§10.1, §16.10) |

### Cross-role handoff
This is the nurse-side mirror of the doctor's Approve Treatment (A20) and directly feeds the Treatment Technician's queue (out of scope of this document but named in the PRD workflow, §10.1) once approved.

---

# Consolidated Cross-Role Handoff Map

| From | To | What flows | Screens involved |
|---|---|---|---|
| Reception | Nurse | Front Desk Handoff Note, new patient basic registration | Nurse Dashboard, Patient Queue |
| Nurse | Doctor | Vitals, confirmed history, allergies, standardized consented photos, before/after comparison prep | Vitals→Consultation, Allergies→Prescription/Treatment Plan, Photos/Compare→Photos/Before-After |
| Doctor | Nurse/Technician | Signed treatment order (protocol, parameters, prerequisites) | Treatment Plan → Prepare Treatment → (Technician queue) |
| Nurse | Doctor | Readiness checklist / blockers (patch test, contraindication, resource) | Prepare Treatment → Approve Treatment |
| Doctor | Pharmacy | Signed prescription | Prescription → Pharmacy Prescription Queue |
| Doctor | Reception/CRM | Follow-up order | Follow-up → Recall list / booking |
| Doctor | Patient App | Explicit release of reports, summaries, before/after | Reports, Photos, Before/After (release toggle) |
| Nurse | Doctor | Uploaded external reports (unreviewed) | Upload Reports → Doctor's Reports queue |

---

# Key Hard-Stop / Safety Rules Referenced Throughout (PRD cross-reference index)

| Rule | PRD reference | Where it applies above |
|---|---|---|
| No treatment without valid consent + patch test + no active contraindication | §10.1, §10.3, §16.10 | A11 TRT-02, A20 APT-02, B9 PT-02 |
| Restricted body-area photos blocked server-side; exception needs doctor + heightened audit | §7.2 IMG-003, §16.4 | A14 PHO-02, B6 CP-03/CP-05 |
| Signed note/prescription/diagnosis cannot be silently overwritten — addendum only | §8.3, §16.10, §NFR-005 | A5 CON-05, A6 SOAP-05, A8 DX-03, A9 RX-04 |
| AI suggestions never auto-saved/auto-signed/auto-diagnosed; accept/edit/reject always explicit | §9.1, §9.2, §16.11 | A16–A19 all |
| AI payload must be de-identified, current-patient-only, no cross-patient memory | §9.2, §16.11, §AI-008 | A16 AIA-04, A17 AIS-03 |
| Adverse events cannot be hidden by completing billing/session | §10.3, §16.10 | A11 TRT-06, A20 APT-05, A21 TH-02 |
| Allergy/contraindication conflicts require explicit override + reason, audited | §8.4, §16.10 | A9 RX-02, B5 ALG-02 |
| Clinical/diagnosis/report detail never in external WhatsApp/SMS/push text | §7.2, §12.1 | A12 FU-04 |
| Marketing/public image use requires separate, explicit, revocable consent, distinct from clinical photo consent | §16.3, §16.4 | A15 BA-03/BA-04 |
| Vendor/AI outage must never block registration, consultation, treatment, or billing | §2.2, §9.2, §18.3 | A5 CON-06, A16 AIA-03 |


---

# Treatment Technician & Pharmacy

# Aurah 360 ClinicOS — Ideal-State Flow & Test-Case Reference
## Treatment Technician & Pharmacy Roles

> **Purpose of this document**: This is a from-scratch, redesign-oriented reference for the **Treatment Technician** and **Pharmacy** role screens listed in the Aurah 360 ClinicOS screen inventory. Every flow below is designed as the *most intuitive, safest, real-world* way a busy Surat skin/hair/laser clinic technician or pharmacy staffer would want to work during a shift — it is **not** a description of the current web app's existing structure. It is grounded in the PRD's business rules (Section 10 — Treatment/Protocols, Section 11 — Prescription/Pharmacy/Inventory/Billing, Section 3 — RBAC, Section 6 — Appointment states) so a future engineering team can build directly against it.
>
> **Reading guide**: Each screen section has (1) a real scenario, (2) an ideal click-by-click flow, (3) a test-case table (happy path / edge cases / negative cases), (4) cross-role handoffs, (5) PRD rule cross-references.

---

# PART A — TREATMENT TECHNICIAN

## Persona snapshot

**Rohan** — 24, treatment technician (laser + facial procedures), Aurah 360 Surat (Ring Road branch). 11th-pass education, comfortable with smartphones but not with dense enterprise software. Works on a wall-mounted tablet next to each procedure room. Handles 12–18 sessions/day across 2 laser rooms. Cannot read English fluently — prefers Gujarati/Hindi labels, icons, and large touch targets (PRD 1.1, 2.2 "Mobile/tablet first").

RBAC baseline (PRD Section 3): Treatment Technician sees only *assigned* treatment queue, checklist, parameters, and consumables for **allowed protocols/skills** per supervision rules. He cannot edit a signed doctor order, cannot override a hard-stop without an authorized approver, and cannot see unrelated patients' full identity on shared queue boards (PRD 3.1, 6.5).

---

## A1. Dashboard

### Scenario
Rohan clocks in at 9:50 AM for a 10:00 AM shift start at the Laser Room. Before touching any patient, he wants one glance to know: how many sessions are queued today, which room/device is his, any pending device maintenance, and if any patient flagged urgent/overdue.

### Ideal flow
1. Rohan logs in with his PIN/biometric on the shared room tablet (fast staff login, not full password every time).
2. Landing screen shows **"Good morning, Rohan"** with today's date and his assigned room(s)/device(s) badge (e.g., "Laser Room 1 — Candela GentleMax Pro").
3. Four big tiles: **Today's Sessions (count)**, **Waiting Now**, **In Progress**, **Completed**. Tapping any tile jumps straight to the filtered Treatment Queue.
4. A **Device Status strip** along the top shows his assigned device's live state (Available / In Use / Maintenance Due / Blocked) with a colored dot — no need to dig into a separate menu to notice a blocked device.
5. An **Alerts panel** below surfaces only what needs his action right now: "Patch test pending for 11:30 slot," "Room 2 cleaning buffer active — ready in 6 min," "Your laser-safety credential expires in 9 days."
6. A single **Start Next Session** button (big, thumb-friendly) takes him directly into the queue's next ready patient — because most of the time he just wants to keep moving, not browse.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A1-1 | Happy path | Rohan logs in at shift start, no alerts pending | Dashboard loads in <2s, shows correct session counts for his branch/room only |
| A1-2 | Happy path | Taps "Waiting Now" tile | Navigates to Treatment Queue pre-filtered to Waiting status |
| A1-3 | Edge case | Device assigned to Rohan enters "Maintenance Due" mid-shift | Device Status strip updates in near-real-time (event-driven per PRD 2.2) without manual refresh; new bookings against that device blocked |
| A1-4 | Edge case | Rohan's laser-safety credential has expired (not just expiring) | Dashboard shows a hard red banner: "Your credential has expired — you cannot start new sessions until renewed by Branch Admin"; Start Next Session button disabled |
| A1-5 | Edge case | Two rooms assigned to Rohan (covering colleague's leave) | Dashboard shows session counts split by room, room switcher visible |
| A1-6 | Negative/should-not-allow | Rohan tries to view a patient's full profile/contact info from the dashboard tile | Only token/initials + procedure name shown; full identity requires opening the actual session (least-data-necessary principle, PRD 3.1, 6.5) |

### Cross-role handoff
Doctor's treatment order (from Consultation → Treatment Plan, PRD 10.1) is what populates the counts here — Rohan sees nothing that a doctor hasn't already approved into the queue.

### PRD cross-reference
- 2.2 Mobile/tablet first, event-driven automation
- 3.1 Least data on shared/queue boards
- 10.3 Blocked/maintenance device, expired credential prevents reservation

---

## A2. Treatment Queue

### Scenario
It's 10:05 AM. Rohan has three patients: (1) Priya — laser hair reduction, session 3 of 6, patch test already cleared; (2) Meera — new patient, laser session ordered today by Dr. Shah, but patch test not yet done; (3) Aarav — PRP session, waiting on room cleaning buffer to finish.

### Ideal flow
1. Queue screen is a vertical list of cards (not a dense spreadsheet table) — one card per patient-session, sorted by scheduled time by default with a manual "priority" flag doctors/reception can raise (with reason logged, per PRD 6.5).
2. Each card shows: token/initials (not full name on shared view), procedure name + protocol version, scheduled time, current status pill (**Ordered / Ready / Waiting Consent / Waiting Resource / In Progress / Paused / Completed / Cancelled / Escalated** — PRD 10.3), and a colored dot for "resource ready" (room+device+staff skill match).
3. Priya's card shows a green **"Ready"** pill — tapping it opens Start Session directly.
4. Meera's card shows an amber **"Waiting Consent/Patch Test"** pill with a small icon explaining why — tapping it shows exactly what's missing rather than a generic locked button.
5. Aarav's card shows a grey **"Waiting Resource"** pill with a live countdown ("Room ready in 4 min") so Rohan isn't confused about why he can't start.
6. A filter/segment control at top: All / Ready / Waiting / In Progress / Completed — plus a room/device toggle if he's covering multiple rooms.
7. Tapping a card long-press (or a kebab menu) offers only permitted quick actions: "View doctor order," "View patch test," "Escalate" — never "Edit order."

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A2-1 | Happy path | Priya's session is Ready | Card tappable, opens Start Session screen pre-filled with her protocol |
| A2-2 | Edge case — hard stop | Meera's patch test not done/not reviewed | Status = "Waiting Consent," Start action blocked; card shows "Patch test required before session" with a link to log a patch test (if Rohan is authorized) or a note to route to nurse |
| A2-3 | Edge case — hard stop | Room/device not yet available (cleaning buffer, or booked by another session) | Status = "Waiting Resource"; countdown shown; Start button disabled until resource frees |
| A2-4 | Edge case | Doctor order for a session gets cancelled by doctor mid-shift | Card disappears from queue instantly (or moves to Cancelled filter) with a toast notification so Rohan doesn't walk into the room for nothing |
| A2-5 | Edge case | Adverse event was logged on Priya's session 2 (previous visit) | Queue card shows a red clinical-flag icon "Review before proceeding" — tapping shows the adverse event summary read-only |
| A2-6 | Negative/should-not-allow | Rohan tries to reorder the queue purely to skip a harder patient without reason | Manual reorder requires a reason field and is audit-logged (PRD 6.5 "manual jump requires reason"); reordering without reason is rejected by UI |
| A2-7 | Negative/should-not-allow | Rohan tries to start a session for a patient not assigned to his skill level (e.g., an advanced laser protocol he isn't credentialed for) | Card is either hidden from his queue or shown but Start is disabled with "Requires senior technician / supervision" (PRD 10.3 "Only allowed protocols/skills and supervision rules") |
| A2-8 | Cross-branch edge | Same protocol name exists at both branches with different parameter versions | Queue only ever shows the branch-scoped, currently-active protocol version for his branch (PRD 10.2 versioning) |

### Cross-role handoff
Queue entries are created the instant a doctor signs a treatment order in Consultation (PRD 6.3 "Awaiting Treatment" state, 10.1 step 3). If reception/nurse hasn't completed a pre-step (e.g., patch test), the card blocks here rather than technician discovering it mid-procedure.

### PRD cross-reference
- 6.3 Appointment/visit state machine — Awaiting Treatment → In Treatment
- 10.1 Doctor order to staff completion (steps 1–4)
- 10.3 Treatment queue statuses and safety
- 6.5 Manual jump requires reason

---

## A3. Start Session

### Scenario
Rohan taps Priya's Ready card. Before the laser ever touches skin, the system must force a **pre-flight safety check** — this is the single most safety-critical screen in the technician's workflow.

### Ideal flow
1. **Patient Safety Header** (always pinned at top, non-scrollable): token/initials, age, known allergies, active warnings (e.g., "Isotretinoin use in last 6 months — laser caution," from PRD 8.1), doctor's specific instruction text for this order.
2. **Pre-flight checklist** appears as a series of checkmarks that must ALL be green before "Begin Procedure" activates:
   - ✅ Consent on file for this protocol
   - ✅ Patch test valid (shows date, area, result, reviewer, and validity window — PRD 10.3)
   - ✅ Required photos captured (before-photo for this session)
   - ✅ Room reserved & clean
   - ✅ Device available & within calibration/maintenance window
   - ✅ Technician skill/credential matches protocol requirement
   - ✅ Package balance has a session available (if package-based) OR standalone billing note
3. Any single ❌ blocks the "Begin Procedure" button and shows *why*, in plain language, with an icon linking to who can resolve it (e.g., "Patch test expired — ask nurse to redo" vs "Device blocked — contact branch admin").
4. If everything is green, Rohan taps **"Begin Procedure"** — this timestamps session start, changes status to **In Progress**, and locks the doctor's order fields as read-only.
5. Screen transitions directly into the Treatment Checklist (no dead-end "session started" screen — momentum matters on a busy floor).

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A3-1 | Happy path | All pre-flight items green | Begin Procedure enabled; tap starts session, timestamps recorded, status → In Progress |
| A3-2 | Hard-stop edge | Patch test missing entirely | Begin Procedure disabled; message: "Patch test required — not on file for this protocol" |
| A3-3 | Hard-stop edge | Patch test exists but expired (validity window passed) | Begin Procedure disabled; message shows expiry date and "redo patch test" action routed to nurse/doctor |
| A3-4 | Hard-stop edge | Consent not signed/expired for this specific protocol | Begin Procedure disabled; "Consent required — [protocol name]" with link to reception/patient app consent status |
| A3-5 | Hard-stop edge | Room/device unavailable (double-booked, in maintenance, or blocked) | Begin Procedure disabled; "Room 1 currently occupied — est. free 10:22 AM" or "Device under maintenance — contact admin" |
| A3-6 | Hard-stop edge | Technician's own credential expired | Begin Procedure disabled entirely for this technician; system suggests reassigning to another qualified technician |
| A3-7 | Override-with-reason flow | Senior technician / supervising doctor believes a soft-stop (e.g., photo not captured, non-safety item) can be bypassed for an operationally justified reason | An "Override" action is visible only to roles with override permission (not Rohan by default); requires selecting a predefined reason or free text + re-authentication (step-up, PRD 3.1), and is fully audited with who/when/why |
| A3-8 | **Negative — must NOT be allowed** | Rohan (a technician without override permission) attempts to bypass a hard-stop like missing patch test or missing consent by any means (retry, browser back, direct link, etc.) | System must reject at the backend regardless of UI path; there is **no** technician-level override for hard-stop clinical safety items — only an authorized approver (doctor/branch admin with step-up auth) can override, and even then it is logged, never silent (PRD 10.3, 3.1 "break-glass requires reason, recent MFA, short expiry, prominent audit") |
| A3-9 | Edge case | Package-based session but package has zero sessions remaining or expired | Begin Procedure blocked with "No sessions remaining in package — route to billing for renewal/standalone payment"; does not silently consume a session that doesn't exist |
| A3-10 | Edge case | Adverse event flagged on a prior session for same patient/protocol | A mandatory acknowledgment step appears: "Prior adverse reaction recorded — review before proceeding" with checkbox; cannot proceed without ticking read-and-acknowledged |

### Cross-role handoff
- Consent, patch test, and photo pre-steps are typically nurse/reception responsibilities (PRD 8.1, Nurse "Prepare Treatment" screen) — if missing, Rohan's screen should offer a one-tap "notify nurse" rather than forcing him to walk over physically.
- Package balance check ties directly to Billing/Package Management (PRD 10.4).

### PRD cross-reference
- 10.1 step 2 "System checks required consent, patch test, photos, contraindications, room/device/staff and package balance"
- 10.3 "Patch test records setting/product, area, date/time, reaction, reviewer and validity"
- 3.1 Break-glass/override controls
- 10.4 Package session consumption only after completed treatment

---

## A4. Treatment Checklist

### Scenario
Session started. Rohan now needs to follow the exact protocol steps for Priya's laser hair reduction — not from memory, but from a versioned, doctor-approved protocol so nothing is missed or done differently than last time.

### Ideal flow
1. Checklist is protocol-driven (PRD 10.2), rendered from the **exact protocol version** used to create this session's order — even if the master protocol has since been updated, this session stays consistent (versioning integrity).
2. Steps appear as a vertical, sequential (but not blindly forced linear) checklist grouped into: **Pre-procedure** (area cleaning, numbing if applicable, device setup, cooling check), **During procedure** (pass count, area coverage, patient comfort check-ins), **Post-procedure** (immediate skin reaction check, aftercare product applied, aftercare instructions given).
3. Each mandatory step has a checkbox + optional note field; some steps require a photo (e.g., "capture immediate post-treatment redness photo") — camera opens inline.
4. Mandatory steps **cannot be skipped** without an explicit "Skip with reason" action, which requires a reason and — if it's a clinically material step — supervisor authorization (PRD 10.1 step 4: "mandatory steps cannot be skipped without permission and reason").
5. Non-mandatory/optional steps (e.g., "played calming music") can be freely skipped, no friction.
6. A progress bar at top ("6 of 9 steps complete") gives Rohan a sense of pace without forcing rigid order for steps that are naturally parallel (e.g., aftercare product selection can happen anytime before session close).
7. Any adverse reaction noticed mid-procedure has a prominent, always-visible **"Report Reaction"** button (not buried in the checklist) — tapping it pauses the session, opens a structured adverse-event form, and creates a high-priority clinical task that cannot be dismissed by finishing the checklist (PRD 10.3 "Adverse event creates high-priority clinical task and cannot be hidden by completing billing").

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A4-1 | Happy path | All mandatory steps completed in order with notes/photos where required | Checklist shows 100% complete; "Proceed to Parameters/Complete Session" unlocked |
| A4-2 | Happy path | Optional step skipped without friction | No reason required, no audit noise, step marked "skipped" |
| A4-3 | Edge case — skip with reason | Mandatory step (e.g., "aftercare product applied") skipped because patient refused | Skip requires reason selection ("patient declined") + free text optional; logged with technician, timestamp |
| A4-4 | Edge case — supervised skip | Mandatory *clinically material* step (e.g., a required cooling pass) technician wants to skip due to device malfunction | Skip requires supervisor/doctor authorization code or in-app approval request; audit trail records approver identity |
| A4-5 | Hard-stop mid-session | Technician taps "Report Reaction" mid-procedure | Session pauses (status → Paused/Escalated), structured adverse-event form opens (setting/product, area, reaction description, severity, action taken), and a task is created for doctor review; cannot proceed to Complete Session until doctor/nurse reviews or explicitly permits continuation |
| A4-6 | Negative/should-not-allow | Technician attempts to mark the entire checklist "complete" via a bulk action without individually confirming mandatory clinical steps | Bulk-complete is disallowed for mandatory steps; only optional/administrative steps may be bulk-dismissed |
| A4-7 | Edge case | Photo-required step where camera/upload fails (poor connectivity) | Step stays incomplete, offline-queued photo capture retried automatically when connectivity resumes; technician warned it hasn't synced yet |
| A4-8 | Versioning edge | Protocol master updated by medical lead mid-day (new pulse-width guidance) while Priya's session is already In Progress | Priya's active session keeps rendering the protocol version that was active when her order was created; the new version applies only to new sessions ordered after (PRD 10.2 "Completed sessions keep the used protocol version; new version applies prospectively") |

### Cross-role handoff
Adverse event escalation routes to the doctor's "Treatment History"/"Approve Treatment" and to Branch Admin dashboards for visibility — it is never resolved purely by the technician closing the session.

### PRD cross-reference
- 10.1 step 4–5; 10.2 protocol config (Pre-steps, Post-steps, Versioning); 10.3 Adverse event handling

---

## A5. Parameters

### Scenario
For Priya's laser session, Rohan must enter the actual device settings used (wavelength, fluence, pulse width, spot size, cooling, passes) — these come from the protocol's configured defaults but can be fine-tuned by the technician within doctor-approved bounds (e.g., skin type/tolerance adjustment) and must be recorded exactly for medico-legal and repeat-session consistency.

### Ideal flow
1. Screen opens pre-filled with the protocol's **default parameter set** for this exact protocol version (PRD 10.2 "Parameters: configurable fields such as wavelength, fluence, pulse width, spot size, cooling, passes or clinic-defined values").
2. Each parameter field shows: default value, allowed safe range (min–max, doctor/protocol-configured), and an input to record the actual value used. Fields outside the safe range are visually flagged red and require a reason + possibly doctor sign-off before saving (this protects against a fat-finger fluence entry that could injure the patient).
3. A **"Copy from last session"** quick action pulls Priya's own previous session's parameters (useful for progressive dose escalation protocols) — shown side-by-side for comparison, never auto-applied blindly.
4. Body area/zone selector (if protocol covers multiple areas — e.g., upper lip + chin) lets Rohan log parameters per area rather than one global blob.
5. Save is incremental (auto-saved as he goes) so a tablet crash or interruption doesn't lose data — draft state visible ("Saved 2 sec ago").

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A5-1 | Happy path | Technician enters parameters within protocol's safe range | Saves cleanly, session parameters logged against protocol version + session ID |
| A5-2 | Edge case | Technician enters a fluence value above the protocol's configured safe max | Field flags red immediately; save blocked until value corrected OR a supervisor override with reason is applied |
| A5-3 | Edge case | "Copy from last session" used, but last session's parameters were themselves an override/exception | UI clearly labels the copied values as "from session on [date], includes override — review before reuse" so it isn't blindly repeated |
| A5-4 | Edge case | Multi-area protocol (upper lip + chin), technician forgets to log parameters for second area | Complete Session step blocks with "Parameters missing for: Chin" |
| A5-5 | Negative/should-not-allow | Technician tries to change the protocol's *default/master* parameter values from this screen (rather than just the actual-used values for this session) | Editing master protocol defaults is not available here at all — that requires Protocol Management (Admin/medical-lead role), fully separate from session-level actual-value entry |
| A5-6 | Data integrity | Device reports telemetry (if integrated) that conflicts with manually entered value | System shows both device-reported and technician-entered values side by side rather than silently overwriting either |

### Cross-role handoff
Recorded parameters become part of the permanent patient timeline/treatment history the doctor reviews (Doctor's "Treatment History" screen) and feed protocol-effectiveness analytics for the medical lead.

### PRD cross-reference
- 10.2 Protocol Parameters configuration
- 10.1 step 5 "Procedure parameters and consumables come from versioned protocol configuration, not hard-coded form"

---

## A6. Consumables

### Scenario
During Priya's session, Rohan uses a numbing gel, a specific cooling gel batch, and a single-use applicator tip. These must be logged against her session both for clinical record and so pharmacy/inventory stock decrements correctly and package cost accounting stays accurate.

### Ideal flow
1. Screen pre-populates the protocol's **default consumables list** with default quantities (PRD 10.2 "Consumables: default products/quantities, batch capture and wastage rules") — Rohan just confirms or adjusts quantity used, he doesn't have to search/select from scratch every time.
2. Each consumable line shows: product name, default qty, actual qty used (editable), batch/lot auto-suggested via **FEFO** (first-expiring-first-out) from current branch stock, and a wastage field (e.g., "used 8ml, wasted 2ml due to applicator issue").
3. Adding an off-protocol consumable (something used but not in the default list) is a simple "+ Add consumable" search-and-add, logged with a note on why it deviated from protocol.
4. Real-time stock check: if the suggested batch has insufficient quantity, system auto-suggests the next FEFO batch rather than blocking Rohan — inventory complexity is hidden from him.
5. If a product is genuinely out of stock at this branch, a clear alert ("Cooling Gel X — out of stock, notify pharmacy") appears rather than a cryptic error, with a one-tap "notify pharmacy" action.
6. On session close, this consumables log atomically decrements branch stock (handled system-side per PRD 10.1 step 7 / 10.5 TRT-005) — Rohan never manually visits an inventory screen.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A6-1 | Happy path | Default consumables confirmed as-used, adequate stock available | Logged against session; stock decrement queued for session close |
| A6-2 | Edge case — FEFO | Two batches of same product exist, one expiring sooner | System suggests the sooner-expiring batch automatically (FEFO, PRD 11.2) |
| A6-3 | Edge case — expired batch | The FEFO-suggested batch has technically passed its expiry date (data entry lag) | Batch is blocked from selection entirely — expired stock cannot be consumed even if it's the "oldest"; next valid batch is suggested instead (PRD 11.2 "expired-batch block") |
| A6-4 | Edge case — low stock | Selected product's remaining branch stock is below reorder level after this consumption | Session logging still proceeds (clinical care not blocked), but a low-stock alert is queued to Pharmacy dashboard |
| A6-5 | Edge case — out of stock | Zero stock of a mandatory protocol consumable at this branch | Rohan is warned before starting/continuing that a substitute or a stock transfer is needed; if it's a hard-required consumable with no substitute, session cannot proceed to completion without it (escalates to Pharmacy/Branch Admin) |
| A6-6 | Negative/should-not-allow | Technician tries to log a negative or zero-cost adjustment to "correct" a mismatched stock count directly from this screen | Not permitted — stock corrections/adjustments require Pharmacy/Inventory role with approval workflow (PRD 11.2 "unusual adjustment approval"); technician can only log actual clinical usage and wastage, not arbitrary stock adjustments |
| A6-7 | Off-protocol addition | Technician adds a consumable not in the default protocol list | Allowed, but requires a short reason note; flagged distinctly in the session record as "off-protocol addition" for audit/cost review |

### Cross-role handoff
This is the direct technician → Pharmacy/Inventory linkage: stock ledger entry type "treatment consumption" (PRD 11.2 stock movement table) is created here, and cost feeds into billing if consumables carry a chargeable line item.

### PRD cross-reference
- 10.2 Consumables config; 11.2 FEFO, negative-stock prevention, expired-batch block, low-stock alerts; 10.5 TRT-005 atomic close updates stock

---

## A7. Complete Session

### Scenario
Priya's laser session is done. Rohan needs to close it out cleanly: record outcome, any variation from plan, aftercare given, and next-session scheduling — and have the system atomically update her package balance, timeline, and billing so nothing falls through cracks.

### Ideal flow
1. **Summary review screen** — auto-compiled from everything already entered (checklist, parameters, consumables): a one-screen "here's what happened" recap so Rohan can sanity-check before finalizing, not re-enter data.
2. **Outcome fields**: overall tolerance (patient comfort scale), visible immediate result/reaction (dropdown + free text), any variation from planned protocol (auto-flagged if parameters were outside default range or steps were skipped-with-reason earlier).
3. **Aftercare given**: pre-filled from protocol's aftercare template (PRD 10.2 Post-steps); Rohan confirms delivery and can attach the patient-facing aftercare handout that will also appear in the patient's app (localized Gujarati/Hindi/English per PRD 8.4/13).
4. **Next session**: if this is part of a multi-session package/plan, system shows "Session 3 of 6 complete — recommend next session in 21 days" auto-computed from protocol's follow-up interval; Rohan taps **"Schedule next session"** which hands off to the appointment/queue system rather than him manually booking.
5. **Final confirmation button: "Complete Session"** — tapping this triggers the atomic close described in PRD 10.1 step 7 / 10.5 TRT-005:
   - Patient timeline updated with full session record
   - Package session balance decremented by exactly 1 (only now, post-completion — PRD 10.4 "Session is consumed only after completed treatment")
   - Stock ledger finalized (consumables decremented)
   - Billing line item(s) created/queued for cashier (session fee, any non-package chargeable consumables)
   - Room/device released back to Available, cleaning-buffer timer started
   - Notification/automation events fired (e.g., aftercare reminder to patient app)
6. Screen returns to the Treatment Queue with Priya's card now shown as Completed (or removed from active view), ready for Rohan to tap into his next patient.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A7-1 | Happy path | Standard session, no deviations, package-based | Complete Session succeeds; package balance -1, timeline updated, room released, billing item queued, next session suggested |
| A7-2 | Edge case | Standalone (non-package) session | No package decrement; standalone invoice line item created for cashier instead |
| A7-3 | Edge case | Session had a documented protocol variation (skipped-with-reason step, out-of-range parameter with override) | Completion summary clearly surfaces the variation(s) in the permanent record; cannot be silently hidden — doctor's Treatment History will show a variation flag |
| A7-4 | Edge case | Adverse event was logged mid-session (A4-5) and not yet resolved by doctor | **Complete Session is blocked** ("cannot be hidden by completing billing" — PRD 10.3) until the adverse event task is reviewed/resolved by doctor/nurse, OR the session can be closed as "Escalated" status without going to normal Completed until review finishes |
| A7-5 | Edge case | Package balance would go negative if decremented (data race — e.g., two sessions closing near-simultaneously) | System-level lock prevents negative package balance; second closer sees "Package balance already exhausted — route to billing for renewal/standalone payment" rather than allowing an invalid negative count |
| A7-6 | Negative/should-not-allow | Technician tries to mark session Completed while a mandatory checklist step is still incomplete (not skipped-with-reason, just genuinely undone) | Complete Session button stays disabled with a direct link back to the incomplete step; cannot force-complete |
| A7-7 | Reversal edge | Doctor/branch admin later needs to reverse a completed session (e.g., wrongly closed, wrong patient) | Reversal requires explicit approval workflow + audit (PRD 10.4 "reversal requires approval/audit") — no silent delete/edit; a compensating entry is created, package balance/stock/billing all reversed together, not partially |
| A7-8 | Cross-device edge | Room/device fails to release automatically due to a system hiccup | Branch Admin/Room Status screen shows a stuck "In Use" state with an explicit manual-release action (with reason) rather than leaving the room permanently blocked |

### Cross-role handoff
- **→ Billing/Cashier**: session fee + chargeable consumables appear on Cashier's Invoice/Due Payments queue immediately.
- **→ Doctor**: session outcome appears in Doctor's Treatment History for the next consult.
- **→ Patient App**: aftercare instructions and package-progress update appear in patient's Treatments/Packages screen (PRD 13.1) — cost/margin never shown to patient.
- **→ CRM/Notifications**: next-session reminder scheduling triggers the reminder engine (PRD 12.2).

### PRD cross-reference
- 10.1 step 6–7; 10.4 Package consumption/reversal; 10.5 TRT-005; 12.2 follow-up/treatment reminders; 13.1 patient app treatments/packages

---

## A8. Device Status

### Scenario
Midway through the day, Rohan's Candela laser starts showing an inconsistent cooling reading. He needs a fast, unambiguous way to flag it and see what else is affected — without hunting through an admin-only inventory screen.

### Ideal flow
1. Simple list/grid of all devices assigned to his branch (or just his room, depending on permission scope), each card showing: device name/serial, current state (**Available / In Use / Maintenance Due / Blocked / Under Repair**), the current patient/session using it if In Use, and next scheduled maintenance date.
2. Tapping a device shows: capability tags (which protocols it's certified for), maintenance history (read-only for technician), and a big **"Report Issue"** button.
3. Report Issue opens a short structured form: issue description, severity (Minor / Needs Attention / Stop Use Immediately), photo attach option. Submitting a "Stop Use Immediately" severity **instantly flips the device to Blocked** for all technicians/rooms — no admin approval needed to *block* (safety-first: blocking should be low-friction; only *unblocking* needs authorization).
4. Once blocked, any queue card requiring that device automatically shows "Waiting Resource — device blocked" so nobody unknowingly attempts a session on faulty equipment.
5. Branch Admin/maintenance team gets notified immediately; only they (or authorized maintenance role) can transition the device back to Available, typically after a resolution note.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A8-1 | Happy path | Rohan checks device status before starting his shift, all Available | Correct real-time state shown |
| A8-2 | Happy path | Rohan reports a minor issue (not stop-use) | Device stays Available but flagged with "Reported Issue — under review"; maintenance notified, no blocking |
| A8-3 | Safety-critical | Rohan reports "Stop Use Immediately" | Device instantly transitions to Blocked; all pending/future sessions on that device auto-flagged Waiting Resource; cannot be started until admin/maintenance clears it |
| A8-4 | Negative/should-not-allow | Rohan (technician) tries to manually set a device back to Available after reporting it Blocked | Not permitted — unblocking requires Branch Admin/maintenance role sign-off with resolution note; technician can only block, not unblock |
| A8-5 | Edge case | Device's scheduled maintenance date arrives while it's mid-session | Device does not get force-blocked mid-procedure; it becomes Blocked automatically only once the current session completes, and no new session can be started on it after that point until maintenance is done |
| A8-6 | Edge case | Device certified for Protocol X but not Protocol Y | Queue prevents scheduling Protocol Y sessions on that device entirely; Device Status screen clearly lists capability tags so Rohan understands why some sessions never appear against it |

### Cross-role handoff
Blocked-device events surface on Branch Admin/Owner dashboards ("Inventory risk," PRD 14.1) and on the Treatment queue for any other technician who might have been about to use the same device.

### PRD cross-reference
- 4.3 Device master (branch, serial, capability, maintenance, block state)
- 10.3 "Blocked/maintenance device... prevents normal reservation"

---

## A9. Room Status

### Scenario
Rohan needs to know, at a glance, which procedure rooms are free, occupied, or in a mandatory cleaning buffer between patients — critical in a busy multi-room laser floor where rooms get shared across technicians.

### Ideal flow
1. Visual floor-plan-style or simple card list of rooms in his branch: room name, current state (**Available / Occupied / Cleaning Buffer / Blocked**), current patient/session if occupied, and a countdown timer if in cleaning buffer.
2. Occupied room card shows which technician and which protocol is running, so if Rohan needs the room next he can gauge timing without walking over physically.
3. Cleaning buffer is **automatic** — the moment a session completes (A7), that room flips to Cleaning Buffer with a pre-configured countdown (per Service config, PRD 4.3 "cleaning buffer"); it can't be skipped by a technician, only marked "cleaning done early" by whoever actually cleans it, with a timestamp logged.
4. Tapping a room he's about to use shows a **"Mark room ready"** confirmation once the buffer naturally elapses or is manually confirmed done — this then unlocks that room for the next Start Session pre-flight check (A3) to pass.
5. Room can be flagged Blocked (e.g., AC broken, wiring issue) similarly to Device Status — same instant-block, admin-only-unblock pattern.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| A9-1 | Happy path | Room free, no buffer pending | Shows Available; usable immediately in Start Session pre-flight |
| A9-2 | Happy path | Session just completed | Room auto-transitions to Cleaning Buffer with correct countdown from service config |
| A9-3 | Edge case | Cleaning finished early (staff physically confirms) | Manual "Mark room ready" action available, timestamp + user logged, room flips to Available immediately instead of waiting out full timer |
| A9-4 | Edge case | Buffer timer elapses but nobody confirms cleaning done | Room does NOT auto-flip to Available without at least an elapsed-timer confirmation step — prevents unclean room being used based on clock alone (configurable: some clinics may want auto-elapse; default should require confirmation for safety) |
| A9-5 | Negative/should-not-allow | Technician tries to start a session in a room still in active Cleaning Buffer by directly navigating past the Room Status block | Start Session pre-flight (A3) independently re-validates room state server-side; even a stale/cached "Available" on the client cannot bypass a still-buffering room |
| A9-6 | Edge case | Room double-booked due to a scheduling race (two sessions assigned same room/time) | System-level lock/idempotency (PRD 6.2) prevents two In-Progress sessions occupying the same room simultaneously; second attempt sees "Room occupied" immediately |

### Cross-role handoff
Room availability feeds the central availability engine used by Reception/Doctor scheduling (PRD 6.2) — a technician marking a room ready or blocked directly affects what Reception can book next.

### PRD cross-reference
- 4.3 Room master (branch, capacity, availability, cleaning buffer, status)
- 6.2 Availability engine (room as one of the required elements)

---

# PART B — PHARMACY

## Persona snapshot

**Sneha** — 29, pharmacy/medical staff, Aurah 360 Surat (main branch). Handles prescription dispensing, direct OTC/cosmetic product sales, stock receiving, and vendor coordination. Works at a small counter with a barcode scanner and a card/cash drawer. RBAC baseline: Pharmacy/Medical Staff can manage product, purchase, batch, stock, dispensing, and sale — but **cannot change a signed doctor prescription**; substitution requires separate authorization (PRD 3, 11.1).

---

## B1. Dashboard

### Scenario
Sneha starts her shift and wants a single screen answering: how many prescriptions are waiting to be dispensed, what's low on stock, what's expiring soon, and what needs urgent purchase/GRN action.

### Ideal flow
1. Landing tiles: **Prescription Queue (count)**, **Pending Direct Sales**, **Low Stock Alerts**, **Near-Expiry Alerts**, **Pending GRN/Transfer**.
2. A **Today's Sales** mini-summary (count + value) gives her a running sense of the day without opening full reports.
3. Alerts panel prioritizes actionable, time-sensitive items: "3 items expiring within 30 days," "Product X below reorder level," "Vendor invoice pending GRN confirmation for 2 days."
4. One-tap "Start Dispensing" jumps to the next prescription in queue — same "keep moving" philosophy as the technician dashboard.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B1-1 | Happy path | Normal shift start | Dashboard loads counts scoped to her branch only |
| B1-2 | Edge case | Multiple near-expiry batches across many products | Near-Expiry tile shows aggregate count; tapping opens the Expiry screen pre-filtered |
| B1-3 | Edge case | A vendor GRN has been sitting unconfirmed for several days | Alert surfaces with age ("pending 3 days") so it doesn't silently rot |
| B1-4 | Negative/should-not-allow | Sneha tries to view another branch's stock/sales numbers from her dashboard | Branch-scoped only; cross-branch view requires elevated role (Branch Admin/Owner, PRD 3) |

### Cross-role handoff
Prescription Queue count is driven directly by doctors signing prescriptions during Consultation (PRD 8.3, 11.1).

### PRD cross-reference
- 14.1 Pharmacy dashboard widgets; 11.2 alerts (low stock, near expiry, expired, pending transfer/GRN)

---

## B2. Prescription Queue

### Scenario
Dr. Shah just signed a prescription for patient Kavita: a topical retinoid cream and an oral antibiotic. Sneha needs to see it appear instantly, clearly, and unambiguously — with zero ability to alter what the doctor actually prescribed.

### Ideal flow
1. Queue is a list of prescriptions awaiting dispensing, each card showing: patient token/initials, prescribing doctor, time prescribed, medicine count, and status (**New / In Progress / Partially Dispensed / Fully Dispensed / On Hold**).
2. Tapping a card opens the **read-only prescription detail**: medicine, form/strength, dose, route, frequency, duration, instructions, and any substitution note the doctor explicitly allowed (PRD 11.1, 8.3) — rendered exactly as signed, no pharmacy edit access to these clinical fields.
3. A clear visual distinction between "doctor-permitted substitution allowed" items (small icon) vs strictly-as-prescribed items.
4. Tapping "Dispense" on a card moves into the Dispense Medicines flow (B3) pre-loaded with this exact prescription.
5. If a prescription can't be fulfilled immediately (e.g., patient stepped out, one item out of stock), Sneha can mark it **On Hold** with a reason, keeping it visible but out of the urgent queue.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B2-1 | Happy path | New prescription appears the moment doctor signs it | Appears in queue within seconds, correct medicine list, doctor-signed lock state visible |
| B2-2 | Edge case | Doctor later amends the prescription (adds addendum per PRD 8.3) | Queue card reflects the amendment with a visible "updated" indicator and amendment history — never silently replaces without trace |
| B2-3 | Edge case | Prescription is partially dispensed (one item now, one item later due to stock) | Status shows Partially Dispensed; remaining item still trackable and doesn't get lost |
| B2-4 | Negative/should-not-allow | Sneha attempts to edit a medicine name/dose/frequency directly on this screen | Not permitted — clinical prescription fields are strictly read-only to pharmacy; any correction must come from the doctor via amendment (PRD 8.3 "no silent overwrite"; 11.1 "Pharmacy fulfillment records actual batch, quantity and authorized substitution separately") |
| B2-5 | Edge case — duplicate/near-duplicate | Same patient has two active prescriptions from different visits containing overlapping/interacting medicines | System surfaces a duplicate/interaction warning banner on the queue card (not just at dispense time) so Sneha is pre-alerted before she even opens it |

### Cross-role handoff
This is the direct Doctor → Pharmacy handoff. Every prescription entering this queue is traceable back to a specific signed encounter (PRD 8.3 EMR-004).

### PRD cross-reference
- 11.1 "Prescription is a clinical order. Pharmacy fulfillment records actual batch, quantity and authorized substitution separately."
- 8.3 sign/lock/amend

---

## B3. Dispense Medicines

### Scenario
Sneha opens Kavita's prescription: topical retinoid cream (1 tube) and oral antibiotic (10-day course, 20 tablets). She must select actual batches (FEFO), confirm quantities, catch any duplicate/interaction issue, and hand over with clear counselling — all while the system prevents expired or negative stock.

### Ideal flow
1. Screen shows each prescribed medicine as a line item with: prescribed qty, **FEFO-suggested batch** (soonest-expiring valid batch) pre-selected automatically, current available stock of that batch, and expiry date visibly displayed next to the batch.
2. Sneha can accept the FEFO suggestion with one tap, or manually pick a different valid (non-expired) batch if there's a clinical reason (e.g., patient specifically needs a different pack size) — but she can never select an expired batch; those are excluded from the picker entirely, not just warned about (PRD 11.2 "expired-batch block").
3. Quantity field defaults to prescribed amount; if she adjusts it down (partial dispense), the remainder stays visibly tracked as pending.
4. Real-time **duplicate-medicine warning**: if this patient already has another active/recent dispensed record of the same or interacting medicine, a clear banner appears before she can finalize: "Kavita was dispensed Doxycycline 5 days ago (10-day course, days remaining: 5) — confirm this is intended," requiring an explicit acknowledgment tap to proceed (not a silent block, since doctor may have valid reasons, but it must never be missable).
5. **Substitution flow**: if the doctor's prescription explicitly allowed substitution and the exact brand isn't in stock, Sneha can select a substitute from the allowed generic/therapeutic-equivalent list — this substitution is logged distinctly (brand prescribed vs brand dispensed) and never silently changes what's shown as "prescribed" in the patient record.
6. Counselling notes/instructions from the prescription are shown clearly so Sneha can repeat them to the patient (e.g., "apply at night only, avoid sun exposure").
7. Final **"Confirm Dispense"** button: this atomically decrements the selected batch's stock, creates a stock-movement ledger entry (type: sale/dispense), marks the prescription line item Fully/Partially Dispensed, and queues a billing line item to Cashier.
8. Optional: generate/print a dispensing label with medicine, dose, frequency, duration for the patient to take home.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B3-1 | Happy path | Standard dispense, adequate valid stock, FEFO batch accepted | Confirms cleanly, stock decremented, billing item queued, prescription marked Fully Dispensed |
| B3-2 | FEFO edge case | Multiple batches exist with different expiry dates | System auto-suggests the batch expiring soonest; manually picking a later-expiring batch is allowed but flagged as a deviation from FEFO default with a quick reason note |
| B3-3 | **Hard-stop — expired stock** | The only physically remaining stock of a medicine is an expired batch | That batch is excluded from selection entirely; system shows "No valid stock available — expired batch excluded" and routes to a stock-request/purchase alert rather than allowing dispense of expired medicine under any circumstance |
| B3-4 | Hard-stop — negative stock | Requested quantity exceeds all valid batches' combined available stock | Dispense blocked at exactly the available quantity; cannot go negative (PRD 11.2 "negative-stock prevention"); partial dispense of available qty offered instead |
| B3-5 | Low-stock alert | Dispensing this item drops branch stock below reorder level | Dispense still proceeds (patient care not blocked), but triggers a low-stock alert to the Pharmacy dashboard and Purchase workflow |
| B3-6 | Duplicate-medicine warning | Patient already has an active, overlapping course of the same/interacting medicine | Explicit warning banner shown, requires acknowledgment before Confirm Dispense is enabled; acknowledgment is logged with reason if provided |
| B3-7 | Substitution flow | Doctor allowed substitution, exact brand out of stock | Sneha selects an approved substitute; system records both "prescribed brand" and "dispensed brand/batch" distinctly; patient-facing record still shows the doctor's original prescription with a substitution note |
| B3-8 | Negative/should-not-allow | Sneha attempts to dispense a medicine that was never on the prescription at all (self-added, no doctor order) under the Dispense flow | Not permitted through Dispense Medicines — an item not on any prescription must go through Direct Sale (B4) instead, which is a distinctly tracked, non-prescription sale type; the two flows are never merged so audit trails stay clean |
| B3-9 | Negative/should-not-allow | Sneha attempts to substitute a medicine when the doctor's prescription did NOT mark it as substitution-allowed | Substitution option is simply unavailable/hidden for that line item; only doctor-permitted substitutable items expose the substitute picker |
| B3-10 | Partial dispense edge | Only half the prescribed quantity is available; rest expected via pending purchase in 2 days | Sneha dispenses partial qty now, prescription line stays "Partially Dispensed," remainder reappears in queue for follow-up dispensing once new stock (GRN) arrives |
| B3-11 | Concurrency edge | Two staff attempt to dispense from the same near-empty batch simultaneously | System-level lock ensures only one succeeds fully; second sees updated (lower) available quantity in real time, preventing an accidental negative-stock race |

### Cross-role handoff
- **→ Billing/Cashier**: dispensed items generate an invoice line item automatically (medicine cost + any dispensing fee); cashier collects payment separately (PRD 11.3).
- **→ Doctor**: dispensing record (actual batch/brand/substitution) is visible in the patient's Treatment/Prescription history for future reference, without altering the original signed prescription.
- **→ Patient App**: released prescription/dispensing summary appears under Prescriptions/Health Timeline (PRD 13.1), without internal cost/margin.

### PRD cross-reference
- 11.1 prescription vs fulfillment separation, substitution authorization
- 11.2 FEFO, negative-stock prevention, expired-batch block, low-stock alerts
- 8.5 EMR-004 structured prescription objects

---

## B4. Direct Sale

### Scenario
A walk-in customer (not necessarily a registered patient, or a registered patient buying an over-the-counter sunscreen without a prescription) wants to buy a cosmetic sunscreen and a hair-fall shampoo directly from the pharmacy counter.

### Ideal flow
1. Sneha searches/selects the buyer: existing patient (search by mobile/MRN/name) or a **quick walk-in/guest** entry (name + mobile only, no full registration friction) — direct sale should never force a full patient-registration flow just to sell a shampoo.
2. Product search (barcode scan or name search) adds items to a cart-like list, each showing available stock, FEFO-suggested batch, unit price, and any active discount.
3. Quantity adjustable per line; system prevents adding quantity beyond valid (non-expired) available stock — same expired-batch exclusion and negative-stock prevention as B3.
4. If the product is something normally prescription-linked but being sold without a prescription (e.g., a medicated product that policy requires a prescription for), the system flags this clearly: "This item is normally prescription-required — confirm authorized direct sale" requiring either a supervisor note or a policy-compliant reason, rather than allowing silent sale of a controlled item.
5. Running total shown live; taxes (GST/HSN per PRD 11.1) auto-calculated per configured product tax mapping.
6. **"Proceed to Payment"** hands off to Billing/Cashier flow (or, if pharmacy staff also collects payment at a combined counter, an integrated payment step) — either way this creates a proper invoice, not an untracked cash transaction.
7. Stock is decremented atomically on sale confirmation, exactly like B3, with its own stock-movement ledger entry type ("direct sale," distinct from "prescription dispense" for reporting clarity).

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B4-1 | Happy path | Walk-in buys OTC sunscreen + shampoo, pays cash | Sale recorded, stock decremented, invoice generated, no prescription linkage required |
| B4-2 | Edge case | Existing registered patient buys OTC item without a prescription | Sale links to patient record for history/reporting, but does NOT require or create a prescription |
| B4-3 | Edge case — guest buyer | Non-patient walk-in, no interest in registering | Quick guest capture (name + mobile) sufficient; full registration not forced |
| B4-4 | Hard-stop-ish | Attempted direct sale of an item normally restricted to prescription-only (e.g., certain scheduled medicines) | Blocked or requires explicit supervisor-authorized override with reason — cannot be sold as an ordinary direct sale by default |
| B4-5 | Hard-stop | Only expired batches remain for a requested product | Excluded from sale entirely, same as B3-3 |
| B4-6 | Hard-stop | Requested quantity exceeds available valid stock | Blocked at available quantity; negative stock prevented |
| B4-7 | Negative/should-not-allow | Sneha attempts to process a direct sale without generating any invoice record (cash under the counter) | Not possible in the ideal flow — Proceed to Payment always creates a system invoice/receipt before cash drawer interaction is considered complete; there is no "skip invoice" path |
| B4-8 | Low-stock edge | Sale drops item below reorder level | Low-stock alert queued, sale still completes |

### Cross-role handoff
- **→ Billing/Cashier**: every direct sale becomes a proper invoice, feeding daily revenue and cash-close reconciliation (PRD 11.3).
- **→ CRM**: if buyer is an existing patient, purchase history contributes to their profile (e.g., useful for future offers) without exposing clinical detail to marketing views (PRD 3, 12.5).

### PRD cross-reference
- 11.2 dispensing/sale controls, FEFO, negative-stock prevention
- 11.3 Invoice items, payment modes
- 11.1 GST/HSN, tax configuration

---

## B5. Products

### Scenario
A new sunscreen SKU needs to be added to the branch's sellable catalogue before Sneha can stock or sell it — she needs a fast, guided way to do this without needing IT support, but within approval limits (pricing changes may need sign-off).

### Ideal flow
1. Product list with search/filter (category, active/inactive, low-stock flag) — big, scannable table or card list depending on device.
2. "Add Product" form: brand/generic name, category, unit of measure, barcode (scan-to-fill supported), reorder level, purchase/sale price, GST/HSN code, active status.
3. Duplicate/near-duplicate name detection on save (similar to medicine master, PRD 11.1) — warns Sneha if a very similarly named product already exists, preventing catalogue clutter and confused stock counts.
4. Price changes beyond a configured threshold may require Branch Admin/Owner approval before taking effect (kept configurable per PRD 3/11.3 approval patterns) — Sneha can submit the change, sees "Pending approval" status, rather than being blocked from working entirely.
5. Deactivating a product (discontinued) doesn't delete historical stock/sale records — just hides it from active sale/purchase pickers going forward.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B5-1 | Happy path | New product added with complete required fields | Saved, immediately available in Purchase/Dispense/Direct Sale pickers |
| B5-2 | Edge case | Near-duplicate name entered (e.g., "Sunscreen SPF50" vs existing "Sun Screen SPF 50") | Warning shown with the existing match; Sneha can confirm it's genuinely different or cancel |
| B5-3 | Edge case | Price change exceeds approval threshold | Change saved as "Pending Approval," old price remains active until approved, visible status shown |
| B5-4 | Negative/should-not-allow | Sneha tries to permanently delete a product that has historical stock/sale transactions | Deletion blocked; only deactivation allowed, preserving audit/history integrity |
| B5-5 | Edge case | Barcode scanned matches an existing product exactly | Auto-fills existing product for edit rather than creating an accidental duplicate entry |

### Cross-role handoff
Product master here is shared with Purchase, Stock, Dispense, and Direct Sale — a single source of truth so Owner/Admin's "Product Master" in Masters section stays consistent branch-to-branch (per organization-level inheritance rules, PRD 4.1 ORG-006).

### PRD cross-reference
- 11.1 product/medicine masters, duplicate flagging; 11.2 Product/SKU fields

---

## B6. Stock

### Scenario
Sneha needs a real-time view of exactly what's on the shelf at her branch — by product, batch, and quantity — to answer "do we have X" questions fast and to spot discrepancies during a routine shelf check.

### Ideal flow
1. Stock list grouped by product, expandable to show individual batches (batch/lot number, received date, expiry, quantity remaining, cost).
2. Search/filter by product name, category, or "below reorder level only."
3. Quick visual indicators: green (healthy stock), amber (near reorder level), red (below reorder level or near-expiry batch present).
4. Tapping a batch shows its full movement history (received via which GRN, consumed via which sales/dispenses/treatment sessions) — the **immutable stock ledger** (PRD 11.2 INV-002) presented in a readable timeline, not a raw log dump.
5. If Sneha finds a physical-count mismatch during a shelf check, she can raise a **"Stock Adjustment Request"** with reason and counted quantity — this doesn't silently change the number; it queues for Branch Admin/authorized approval (PRD 11.2 "unusual adjustment approval") and only applies once approved, with the discrepancy and approver logged.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B6-1 | Happy path | Sneha checks stock of a specific product | Shows accurate real-time batch-level quantities |
| B6-2 | Edge case | Physical count during shelf check differs from system count | Adjustment Request submitted with reason; stays pending until Branch Admin approves; system count doesn't change silently |
| B6-3 | Edge case | A batch has zero quantity remaining | Batch shown as depleted but historical record retained (not deleted) for audit/ledger completeness |
| B6-4 | Negative/should-not-allow | Sneha tries to directly overwrite a batch's quantity field to "fix" a discrepancy without going through the adjustment approval flow | Direct overwrite is not exposed in the UI; only the Adjustment Request path exists, ensuring every quantity change is auditable (PRD 11.2 "Immutable stock movement ledger") |
| B6-5 | Edge case | Stock transfer in progress from another branch (Requested → Approved → Dispatched → In Transit) | Stock screen shows an "Incoming (in transit)" indicator separate from on-hand stock, so Sneha doesn't mistakenly believe it's already available to sell |

### Cross-role handoff
Stock levels here directly gate what technicians can select in Consumables (A6) and what appears in Dispense/Direct Sale pickers — a single real-time source, not a separately-synced number.

### PRD cross-reference
- 11.2 Stock movement ledger, transfer workflow, controls (negative-stock prevention, unusual adjustment approval)

---

## B7. Expiry

### Scenario
Sneha runs a weekly expiry check: some batches are expiring in 15 days, some already expired last week and sitting on the shelf unnoticed. She needs to act on both — clear/quarantine the expired stock and decide on discounting/using-up the near-expiry stock before it's wasted.

### Ideal flow
1. Two clear sections: **Expired** (already past expiry — must be pulled from sellable/dispensable pool immediately) and **Near-Expiry** (within a configurable window, e.g., 30/60/90 days — actionable warning).
2. Expired batches show product, batch, expiry date, quantity, and a mandatory action: **"Quarantine/Write-off"** — this removes the batch from any sale/dispense/consumption picker instantly (it should already have been excluded per B3-3/B4-5, but this screen is where the formal write-off/disposal record is created) with reason (e.g., "expired, disposed per SOP") and links to a stock-movement ledger entry type "expiry write-off."
3. Near-expiry batches offer a **"Flag for promotion/priority use"** action — e.g., prioritizing this batch in FEFO suggestions (already automatic) or, for direct-sale-eligible products, optionally flagging for a clearance discount (subject to discount approval rules, PRD 11.3).
4. A simple date-range filter and CSV export for reporting/wastage analysis (PRD 11.2 "wastage reports").

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B7-1 | Happy path | Weekly check, a few near-expiry batches identified | Flagged, FEFO already prioritizing them, no immediate action forced |
| B7-2 | Hard-stop compliance | A batch has passed expiry and is still sitting as "available" somewhere in stock | This should be structurally impossible for sale/dispense (already blocked at B3/B4), but Expiry screen still requires an explicit Quarantine/Write-off action to formally close it out of the ledger — cannot just be ignored indefinitely |
| B7-3 | Edge case | Write-off action taken on an expired batch | Stock ledger entry created (type: expiry/wastage), quantity zeroed from any residual on-hand count, reason logged, contributes to wastage report |
| B7-4 | Negative/should-not-allow | Sneha attempts to "revive" or extend the expiry date of a batch to keep selling it | Not permitted — expiry date on a received batch is immutable once recorded from GRN; there is no edit path that changes a batch's expiry date to bypass safety controls |
| B7-5 | Edge case | Near-expiry batch flagged, but nobody uses it before it actually expires | It automatically reclassifies from Near-Expiry to Expired at the crossover date without manual action, and immediately becomes ineligible for sale/dispense/consumption |

### Cross-role handoff
Expiry write-offs feed Owner/Admin's Inventory Reports (wastage) and the branch's overall stock valuation; recurring near-expiry problems on a specific product might prompt Purchase/Vendor decisions (order smaller batches, negotiate better vendor lead time).

### PRD cross-reference
- 11.2 Alerts (near expiry, expired), Reports (expiry, wastage), Controls (expired-batch block)

---

## B8. Purchase

### Scenario
Stock of a fast-moving retinoid cream is running low (flagged by B1/B6 alerts). Sneha needs to raise a purchase order to the usual vendor, and later receive the goods (GRN) with correct batch/expiry capture.

### Ideal flow
1. **Create Purchase Order**: select vendor (from Vendor master, B9), add products with quantity, expected unit cost auto-suggested from last purchase price (editable), expected delivery date. Low-stock-flagged items can be added with one tap directly from an alert ("Reorder now" shortcut).
2. PO goes to a **Pending** state; if the clinic requires purchase approval above a value threshold, it routes for Branch Admin/Owner sign-off before being sent to vendor — Sneha still gets to draft and submit even if she can't unilaterally approve large POs.
3. Once goods arrive physically, Sneha performs **Goods Receipt (GRN)** against the PO: for each line item, she enters actual received quantity, batch/lot number, manufacture date, expiry date, and actual landed cost (may differ slightly from PO estimate) — this is where expiry dates enter the system immutably (per B7-4).
4. Partial receipt supported (e.g., vendor ships half now) — PO stays "Partially Received" until fully reconciled, remainder still trackable.
5. On GRN confirmation, stock increases atomically, becomes available in FEFO pickers immediately, and a stock-movement ledger entry (type: purchase/GRN) is created; vendor invoice reference and payment terms are captured for the accountant.
6. Discrepancy handling: if received quantity/condition doesn't match PO (damaged goods, short shipment), Sneha logs a discrepancy note attached to the GRN rather than silently adjusting numbers to match.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B8-1 | Happy path | PO created, sent, goods received in full matching PO | GRN confirms, stock increases with correct batch/expiry, PO closes as Fully Received |
| B8-2 | Edge case | Reorder shortcut used directly from a low-stock alert | PO pre-filled with that product/vendor/suggested quantity, editable before submission |
| B8-3 | Edge case | Purchase value exceeds approval threshold | PO routes to pending-approval state; cannot be sent to vendor until approved |
| B8-4 | Edge case | Partial delivery received | GRN records partial quantity; PO status "Partially Received"; remaining quantity still expected/trackable |
| B8-5 | Edge case | Received batch's expiry date is suspiciously close (e.g., only 30 days shelf life on arrival) | System doesn't block receipt, but flags it immediately into Near-Expiry once GRN confirmed, so it's on Sneha's radar from day one |
| B8-6 | Negative/should-not-allow | Sneha attempts to confirm a GRN without entering a batch/expiry date for a batch-tracked product | Not permitted — batch and expiry are mandatory fields for any batch-tracked product's GRN; cannot save incomplete receipt for such items |
| B8-7 | Discrepancy edge | Received quantity is less than invoiced/PO quantity (short shipment) | GRN records actual received quantity only; discrepancy noted and linked for vendor follow-up/accountant reconciliation, never silently "topped up" to match the PO |
| B8-8 | Negative/should-not-allow | Sneha tries to alter historical GRN records after confirmation to change previously recorded expiry/quantity | Confirmed GRN is immutable; corrections require a separate adjustment/reversal entry with reason and approval, not direct edit (consistent with PRD 11.2 immutable ledger principle) |

### Cross-role handoff
- **→ Accountant/Cashier**: vendor invoice/payment reference from Purchase feeds accounts payable tracking (PRD 11.3, though full accounting ledger is a stated MVP non-goal — payment reference capture still applies).
- **→ Branch Admin/Owner**: PO approval and inventory valuation reporting (PRD 14.1, 14.2).

### PRD cross-reference
- 11.2 Vendor/purchase, GRN/batch fields; INV-001 requirement
- 11.3 payment reference (manual tracking, no gateway in MVP)

---

## B9. Vendors

### Scenario
Aurah 360 works with 3–4 regular pharmaceutical/cosmetic distributors. Sneha needs a clean master list to pick from during Purchase, plus contact/GST details for compliance and reordering efficiency.

### Ideal flow
1. Vendor list: name, contact person, phone, GST number, product categories supplied, active status, and a quick "last order date" / "average lead time" indicator to help decide who to reorder from fastest.
2. Add/Edit Vendor form: legal name, contact details, GST/PAN, payment terms, address, and notes (e.g., "delivers Surat orders within 2 days").
3. Vendor performance view (read-only summary): on-time delivery rate, recent PO history, any recurring discrepancy flags from GRN (B8) — helps decide who to trust for urgent low-stock reorders.
4. Deactivating a vendor (e.g., relationship ended) doesn't delete historical PO/GRN records tied to them.

### Test cases

| # | Type | Scenario | Expected result |
|---|---|---|---|
| B9-1 | Happy path | New vendor added with complete details | Immediately selectable in Purchase (B8) |
| B9-2 | Edge case | Vendor GST number entered incorrectly (format validation) | Inline validation catches malformed GST before save |
| B9-3 | Negative/should-not-allow | Sneha tries to delete a vendor that has historical purchase/GRN records | Deletion blocked; only deactivation allowed, preserving purchase history integrity |
| B9-4 | Edge case | Duplicate vendor entry attempted (same GST number as existing vendor) | Warned/blocked as likely duplicate |
| B9-5 | Edge case | Vendor deactivated mid-way through an open/pending PO | Existing open PO with that vendor remains valid and completable (received against); only new POs are prevented from selecting the deactivated vendor |

### Cross-role handoff
Vendor performance data feeds Owner/Admin's Inventory Reports and can inform CRM/Branch Admin negotiations; payment terms feed the accountant's due-payment tracking.

### PRD cross-reference
- 11.2 Vendor/purchase master fields

---

# Appendix — Consolidated "Hard-Stop vs Override vs Soft-Stop" Rulebook

This table consolidates the safety-critical gating logic referenced across the Treatment Technician flows, since it is the single most safety-relevant mechanism in this document.

| Condition | Who can act | Mechanism | Overridable? |
|---|---|---|---|
| Missing/expired patch test | Nurse/Doctor to resolve | Hard-stop on Start Session | Only by authorized clinical role with step-up auth + reason (audited) |
| Missing/expired consent | Reception/Doctor to resolve | Hard-stop on Start Session | Only by authorized role, never by technician alone |
| Room/device unavailable, blocked, or under maintenance | Branch Admin/Maintenance to resolve | Hard-stop on Start Session / Room-Device Status | No technician override; only admin can unblock |
| Technician credential expired | Branch Admin to renew/reassign | Hard-stop, disables Start Session entirely for that technician | No override — reassignment to a valid technician is the only path |
| Adverse event mid-session | Doctor/Nurse to review | Pauses session, blocks Complete Session | Session resumes/closes only after clinical review, fully audited |
| Package balance exhausted/expired | Billing/Cashier to resolve (renew/standalone pay) | Hard-stop on session close consuming a session | No override to "borrow" a session; must renew or pay standalone |
| Non-mandatory checklist step | Technician | Free skip | Yes, no reason required |
| Mandatory but non-safety-critical checklist step | Technician (+ supervisor for clinically material items) | Skip-with-reason | Yes, with reason; clinically material items need supervisor auth |
| Parameter outside protocol safe range | Technician + Supervisor/Doctor | Soft-stop with override | Yes, with reason and (for major deviations) doctor sign-off |
| Expired stock batch (consumables, dispense, or sale) | Nobody | Hard-stop, batch excluded from selection | **Never overridable** — expired stock cannot be used/sold/dispensed under any role |
| Negative stock request | Nobody | Hard-stop, capped at available quantity | **Never overridable** — partial fulfillment offered instead |
| Prescription clinical fields (dose/medicine/frequency) | Doctor only | Hard-stop for Pharmacy edit access | Pharmacy has zero edit access; only doctor amendment changes these |

---

*End of document. This reference is intended to guide a future UX/engineering redesign of the Treatment Technician and Pharmacy modules and should be reviewed against final clinic SOPs, medical-lead sign-off, and legal/privacy adviser input before implementation, consistent with the PRD's own note that clinical/operational specifics require stakeholder confirmation prior to production (PRD Section 00, "મુખ્ય સૂચના").*


---

# Cashier / Accountant & CRM / Call Desk

# Aurah 360 ClinicOS — Ideal Flow & Test-Case Reference
## Cashier/Accountant and CRM/Call Desk Roles

**Purpose of this document.** This is a forward-looking design reference for the future redesign of Aurah 360 ClinicOS. It ignores how the current web app happens to be structured today and instead defines the *ideal, most user-friendly, real-clinic* flow for every screen owned by the **Cashier/Accountant** and **CRM/Call Desk** roles, grounded in the PRD's business rules (branch scoping, approval thresholds, mandatory reasons, audit, consent gating) and the Role-Based UI Screen inventory.

**Setting used throughout:** Aurah 360, a skin/hair/laser clinic with 2+ branches in Surat. Cashiers named in scenarios: **Meera** (Adajan branch cashier). CRM staff: **Priya** (call desk executive) and **Rakesh** (CRM team lead). All amounts in INR.

**Conventions used in every section:**
- **Scenario** — a concrete, time-stamped real situation.
- **Ideal step-by-step flow** — screen-by-screen, click-by-click, in plain language.
- **Test cases** — happy path, edge cases, and "must NOT be allowed" cases, in tables.
- **Cross-role handoffs** — where this screen's data comes from or feeds into another role.
- **PRD cross-reference** — the business rule(s) from the PRD this flow must obey.

---

# PART A — CASHIER / ACCOUNTANT

## A.0 Design principles specific to billing screens

Before the screens, the non-negotiable rules that every Cashier screen below must respect (from PRD §11.3, §16.2, §16.8, §3.1):

1. **Branch scope**: a cashier only ever sees and acts on their own branch's drawer, invoices and reports unless explicitly granted multi-branch access (Branch Admin/Owner level).
2. **No unnecessary clinical detail**: invoices show service/package names and prices, never diagnosis, photos, or clinical notes.
3. **Mandatory reason + audit** on every discount above threshold, every refund, every void, and every cash-close variance.
4. **Append/reversal, never silent overwrite**: a wrong invoice is voided and a fresh one created, not edited in place after signing/finalizing.
5. **Approval workflow**: discount/refund/void above a configured threshold routes to Branch Admin/Owner for sign-off before it takes effect.
6. **Everything ties back to the patient timeline**: every invoice, payment, refund and discount is visible on the patient's unified record for whoever needs it (doctor sees treatment-linked billing status, owner sees consolidated finance).

---

## A.1 Dashboard

### Scenario
It's 9:05 AM. Meera has just unlocked the till at the Adajan branch. Before she does anything else, she wants one screen that tells her: how much cash/UPI/card came in yesterday, whether yesterday's cash-close matched, who has outstanding dues today, and if any refund or discount is waiting on the branch admin's approval.

### Ideal step-by-step flow
1. Meera logs in; landing page is her **Cashier Dashboard**, scoped to Adajan branch only.
2. Top strip: **"Cash drawer status: Not yet opened today"** with a single prominent button **Open Cash Drawer** (this blocks invoice creation until she opens it — see A.6).
3. Below that, four KPI tiles for **today so far**: Total Collected, Pending Dues (count + amount), Refunds Pending Approval, Discounts Pending Approval.
4. A "Yesterday's close" card shows: expected vs counted cash, variance (if any), and its approval status (Approved / Flagged / Pending Owner Review).
5. A worklist titled **"Needs your action today"**: patients checked out by doctor/treatment staff but not yet billed (from "Awaiting Billing" appointment state), due-payment follow-ups due today, any refund/discount request kicked back by the approver with a query.
6. A payment-mode mini chart for the last 7 days (cash vs UPI vs card vs bank transfer) so Meera can flag if card machine has been down.
7. One-click shortcuts: **New Invoice**, **Record Payment**, **Cash Closing**, **Today's Revenue Report**.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| CD-01 | Happy path | Meera opens dashboard at shift start | Branch-scoped KPIs load in <2s; cash drawer shows "Not opened" |
| CD-02 | Edge | Patient completed treatment but has no invoice after 30 minutes | Appears in "Needs your action" worklist automatically (event-driven from Awaiting Billing state) |
| CD-03 | Edge | Yesterday's cash close had a ₹500 unresolved variance | Dashboard shows a red "Flagged" badge on yesterday's close card until Owner reviews |
| CD-04 | Must NOT allow | Meera tries to view Vesu branch's dashboard by changing the branch selector | Selector is absent/disabled for cashier role scoped to one branch; server rejects any direct API call for another branch with 403, and the attempt is audited |
| CD-05 | Must NOT allow | Cashier dashboard widget attempts to show a patient's diagnosis or photos | Not present in data contract for this role; only billing-relevant fields ever populate the widgets |

### Cross-role handoff
- "Awaiting Billing" patients originate from the doctor/treatment-technician closing a consultation or treatment session (PRD §10.1, §10.3) — the invoice line items (consultation fee, treatment/protocol charge, package deduction) are pre-populated from that clinical/treatment record so Meera never re-types service names or prices.
- Cash-close variance flagged for Owner review surfaces on the **Owner/Branch Admin dashboard** (PRD §14.1).

### PRD cross-reference
§14.1 (Branch Admin dashboard: collection, cash close, pending approvals), §11.3 (billing controls), §3 (branch scope), §16.8 (audit).

---

## A.2 Invoice

### Scenario
11:40 AM — Riya Shah, a returning patient, has finished her laser hair-reduction session (session 3 of a 6-session package) and a follow-up bottle of sunscreen dispensed by pharmacy. The treatment technician has marked the session "Completed." Meera needs to bill her: package session deduction (no charge), sunscreen product charge, and collect payment.

### Ideal step-by-step flow
1. Meera clicks **New Invoice** or opens it directly from the "Needs your action" worklist card for Riya — this pre-attaches the correct patient, visit, and branch context (no manual search needed, avoiding wrong-patient billing).
2. Invoice screen opens with a **read-only patient strip** at top: name, MRN, branch, visit date/doctor — matching PRD's "always visible identity strip" pattern, so Meera can eyeball she has the right person before billing.
3. **Line items panel** is pre-populated from the clinical/treatment/pharmacy record:
   - Laser session 3/6 — pulled from active package; shows "Package: Laser Hair Reduction – Full Body (6 sessions)", this session marked **Used from package, ₹0 additional charge**, with package balance auto-decremented (3 sessions remaining) only once invoice is finalized.
   - Sunscreen SPF50 (from pharmacy dispensing record) — ₹850, tax auto-applied per configured GST/HSN rule.
4. Meera can **add manual items** (e.g., a walk-in product sale) via a searchable combobox of services/products — never free-typed prices; price comes from the active fee schedule for that branch/doctor/service, with only permitted overrides.
5. If any override or manual discount is needed, the **Discount** action opens inline (see A.5) rather than a separate disconnected screen.
6. Invoice preview shows subtotal, discount, tax, total — always with tax breakup visible, no rounding surprises.
7. Meera clicks **Proceed to Payment**, which takes her straight into the Payments flow (A.3) with the invoice total pre-filled — she never has to re-enter the amount.
8. Once payment is recorded, invoice status flips to **Paid** (or **Partially Paid** / **Due**) and a receipt is auto-generated, printable and/or sendable to the patient's app as a "released" document (never containing clinical detail — PRD §7.2 high-risk rule).
9. Invoice becomes **read-only/signed**; any later correction requires a **Void** (A.2.1) and reissue, never in-place editing.

### A.2.1 Void (not listed separately in the inventory but essential to "Invoice")
If Meera made a genuine entry error (wrong item, wrong patient) before payment was collected, she needs **Void Invoice**, which:
- Requires a mandatory reason from a controlled list (Wrong patient, Wrong item, Duplicate entry, Other + text) — free-text-only reasons for "Other" only.
- If the invoice is already paid, void is blocked; she must instead initiate a Refund (A.4).
- Voiding above ₹0 impact requires no threshold (it's a data-entry correction, not a financial loss) but is still fully audited with actor/time/reason, and reverses any package/stock deduction that had already been applied.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| INV-01 | Happy path | Bill a package session + product sale, single payment | Correct package decrement, correct tax, receipt generated, package balance shows 3/6 remaining |
| INV-02 | Happy path | Bill a plain consultation fee with no treatment | Single line item, straightforward payment |
| INV-03 | Edge | Add manual discount of ₹300 on a ₹2,000 invoice (within cashier's own approval limit, e.g. ≤10%) | Applied instantly with reason captured, no escalation needed |
| INV-04 | Edge | Add discount of ₹800 on a ₹2,000 invoice (40%, above threshold) | Invoice held in "Pending Discount Approval" state; cannot collect payment until Branch Admin/Owner approves (see A.5) |
| INV-05 | Edge | Package balance is already 0 sessions remaining, technician marks session used anyway | Invoice generation blocks silent free session; system requires an explicit "extra session – convert to paid" or "package renewal" decision, both audited |
| INV-06 | Edge | Network drops mid-invoice-save after payment was already captured on card machine | Idempotency key on invoice creation prevents duplicate invoice from being generated on retry; Meera sees "already recorded" instead of a duplicate |
| INV-07 | Edge | Two cashiers at two till stations try to bill the same "Awaiting Billing" visit simultaneously | Optimistic lock: the second cashier gets "This visit is already being billed by Meera" instead of creating a duplicate invoice |
| INV-08 | Must NOT allow | Cashier edits a finalized/paid invoice's line items directly | Blocked; only Void + Reissue or Refund path is available, both audited |
| INV-09 | Must NOT allow | Cashier manually types a price different from the fee schedule without going through the Discount approval flow | Manual price field is not editable outside the discount/override control; any override always logs as a discount event with reason |
| INV-10 | Must NOT allow | Invoice line items expose the doctor's diagnosis or treatment protocol parameters | Only service/package name and price ever render on invoice; clinical fields are not part of the billing data contract |

### Cross-role handoff
- Line items are populated from: Doctor's treatment plan/order (service, package) and Pharmacy's dispensing record (products) — Meera never re-keys these (PRD §10.1 step 7: "closing a session atomically updates... billing items").
- The finalized invoice appears in the patient's app as a released receipt (PRD §13.1 Bills/receipts) and in the Doctor's patient-360 Billing History tab, and in Owner's consolidated Revenue Dashboard.

### PRD cross-reference
§11.3 (invoice items, fee schedule, controls), §10.1/§10.5 (atomic close updates billing), §16.2 (confidential financial data class), NFR-004 (concurrency/idempotency), §18.3 (negative-case tests: last package session race condition, network drop dedup).

---

## A.3 Payments

### Scenario
Same visit — Riya wants to pay ₹850 for sunscreen: ₹500 by UPI, ₹350 cash (split payment, a very common real-world request in Indian clinics).

### Ideal step-by-step flow
1. From the invoice, Meera taps **Record Payment**. The invoice's outstanding balance (₹850) is shown large and unmissable.
2. A simple **mode picker** with big touch targets: Cash / UPI / Card / Bank Transfer / Other.
3. Meera selects **UPI**, enters ₹500, and enters/scans the UPI reference/transaction ID (mandatory for non-cash modes — no gateway integration in MVP, PRD §11.3, this is a manual entry with reference capture for reconciliation).
4. Remaining balance auto-recalculates to ₹350; she adds a second payment line, mode **Cash**, ₹350.
5. Total collected (₹850) auto-matches invoice total; **Confirm Payment** becomes active only when full or intentionally partial.
6. If she confirms with less than the full amount, the system asks her to confirm this is a **partial payment**, and the balance becomes a **Due** (feeds directly into A.4 Due Payments) rather than silently leaving the invoice ambiguous.
7. Receipt auto-prints/sends showing the mode-wise breakup (UPI ref + cash) so the patient has a clear record.
8. Every payment line is timestamped, attributed to Meera, and tagged to the cash drawer session that's currently open (for reconciliation in Cash Closing).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| PAY-01 | Happy path | Split payment UPI + Cash matching invoice total exactly | Invoice marked Paid, both payment lines recorded with mode/ref/actor/time |
| PAY-02 | Happy path | Full cash payment for a small invoice | Fast one-tap "Cash — Full amount" shortcut, no reference number required for cash |
| PAY-03 | Edge | Patient pays ₹200 against a ₹850 invoice | Balance ₹650 becomes a tracked Due; invoice shows "Partially Paid"; due appears in Due Payments list |
| PAY-04 | Edge | UPI/card reference number left blank | Save is blocked with inline message "Reference number required for UPI/Card payments" |
| PAY-05 | Edge | Cashier tries to record payment before opening the cash drawer for the day | Blocked with message "Open your cash drawer before recording payments" and a direct link to Cash Opening |
| PAY-06 | Edge | Overpayment — patient hands ₹1,000 for a ₹850 bill and wants ₹150 back in cash | System supports recording ₹1,000 received then issuing ₹150 change; change is NOT treated as a refund event (refund only applies to money returned against a previously finalized/paid invoice, not same-transaction change) |
| PAY-07 | Must NOT allow | Cashier records a payment against another branch's invoice | Invoice list is branch-scoped; cross-branch invoice IDs are rejected server-side even via direct URL/API |
| PAY-08 | Must NOT allow | Cashier deletes a recorded payment line to "start over" | No delete; only reversal via Void/Refund workflow, fully audited |

### Cross-role handoff
- Payment record instantly reflects in the patient's app (Bills/receipts) and in the branch's live Revenue/Payment reports (A.9/A.10) used by Owner/Branch Admin dashboards.

### PRD cross-reference
§11.3 (payment modes, split/partial, no gateway in MVP), NFR-004 (transactional integrity), §16.8 (finance audit family).

---

## A.4 Due Payments

### Scenario
Rohit Patel took a ₹15,000 package 2 weeks ago, paid ₹10,000, and has a ₹5,000 due. He's coming in today for his next session. Meera needs to see this the moment he checks in, not discover it awkwardly mid-visit.

### Ideal step-by-step flow
1. **Due Payments** screen lists all patients with an outstanding balance at Meera's branch, sorted by oldest-due-first by default, with columns: Patient, Invoice #, Service/Package, Amount Due, Days Overdue, Last Reminder Sent.
2. Search/filter by patient name, MRN, or "due today's checked-in patients" (a one-click filter tied to today's queue — so Meera instantly knows which of today's arrivals owe money, ideal for collecting at checkout).
3. Rohit's row shows a badge because he's checked in today (linked live to the queue/appointment module) — this is the single most useful real-world feature: due collection happens naturally at today's visit, not via an awkward separate phone call.
4. Meera clicks his row → sees due breakdown (original invoice, amount paid, amount due, due since date) and a **Collect Due Payment** button that opens the same Payments flow as A.3, pre-filled with the due amount.
5. If Rohit only pays part of the due again, remaining balance stays tracked; if he pays in full, the invoice moves to Paid and disappears from the active Due list (but remains in history).
6. For patients NOT visiting today, a **Send Reminder** action (WhatsApp/SMS) triggers a generic payment-due notice (no amount/clinical detail in the message text per PRD's high-risk communication rule — just "You have a pending balance, please visit the reception or call us").
7. Aging buckets (0–7 / 8–30 / 31+ days) are visible for the branch admin/owner's collections oversight, but Meera's own view stays action-first.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| DUE-01 | Happy path | Collect full remaining due from a checked-in patient | Due cleared, invoice moves to Paid, disappears from active Due list |
| DUE-02 | Happy path | Partial due collection on a due-of-a-due | Remaining due recalculates correctly, aging timer continues from original invoice date, not from today's partial payment |
| DUE-03 | Edge | Due patient never returns for 90+ days | Appears in "31+ days" aging bucket; CRM's Recall/Follow-up worklist can independently pick this up for a collections call (cross-role) |
| DUE-04 | Edge | Send reminder to a patient who has opted out of marketing but not service messages | Payment-due reminder is a transactional/service message, not marketing, so it is still permitted to send (per PRD §12.4 channel/consent policy) — but must use the approved transactional template only |
| DUE-05 | Must NOT allow | Due list shows a patient's clinical complaint/diagnosis next to the amount | Only invoice/service/amount fields are shown; no clinical linkage in this view |
| DUE-06 | Must NOT allow | Cashier waives a due amount to zero without going through Discount/Write-off approval | "Write off due" requires the same threshold+reason+approval path as a discount; cannot be silently zeroed |

### Cross-role handoff
- Due status is visible (amount only, no clinical detail) on the Doctor's patient strip as a soft "Pending Due" badge so the doctor's front-desk staff can gently prompt collection, and is visible to CRM as a collections/recall signal.
- Feeds Owner's Financial dues report (PRD §14.2).

### PRD cross-reference
§11.3 (due balance, credit note), §12.2 (transactional vs marketing message separation), §14.2 (dues reporting).

---

## A.5 Discounts

### Scenario
A loyal patient, Kajal, negotiates a discount on a ₹20,000 laser package. The clinic's policy: cashiers can approve discounts up to 10% on the spot; anything above that needs Branch Admin/Owner sign-off before the invoice can be paid.

### Ideal step-by-step flow
1. From the Invoice screen, Meera clicks **Apply Discount**.
2. A clear form: Discount type (Flat ₹ / Percentage), Amount/Percentage, **mandatory Reason** (dropdown: Loyalty/Returning Patient, Referral Bonus, Promotional Offer, Financial Hardship, Staff/Family, Other + text), and it shows the resulting new total live as she types — no mental math.
3. System checks the amount against the **configured approval threshold** for this branch/role (e.g., 10% or ₹2,000, whichever the clinic has configured as master data — never hard-coded).
4. **If within threshold**: applied instantly, logged with actor/time/reason, invoice proceeds to payment normally.
5. **If above threshold**: invoice locks into **"Pending Discount Approval"** state. Meera sees a clear banner: "This discount needs Branch Admin/Owner approval before payment can be collected." A request is pushed to the Branch Admin/Owner's approval queue (visible on their dashboard, PRD §14.1) with full context: patient, amount, requested discount %, reason, requesting cashier.
6. Branch Admin/Owner reviews on their own device (could be remote — owner running two branches) and either **Approves**, **Rejects**, or **Sends back with a query** (e.g., "confirm with patient reason").
7. Meera gets a real-time notification the moment it's actioned; if approved, she can now proceed to collect payment; if rejected, the discount is removed and she's told why, so she can renegotiate with the patient right there instead of the patient waiting confused at the counter.
8. Every discount — approved instantly or after escalation — appears in the Discounts register/report with full audit trail (who requested, who approved, when, reason).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| DISC-01 | Happy path | 5% discount, reason "Loyalty", within threshold | Instant apply, audited, no escalation |
| DISC-02 | Edge (the required "above threshold" case) | 40% discount request on ₹20,000 package | Blocked pending Owner approval; payment cannot be collected until resolved |
| DISC-03 | Edge | Owner rejects the discount request | Cashier notified with rejection reason; invoice reverts to original price; patient informed at counter, not after they've left |
| DISC-04 | Edge | Cashier tries to apply two separate small discounts sequentially to stay under threshold each time (structuring) | System evaluates cumulative discount on the invoice against the threshold, not each action in isolation, so this cannot bypass approval |
| DISC-05 | Edge | Discount requested with reason "Other" but no free-text explanation entered | Save blocked — "Other" reason mandates free text |
| DISC-06 | Must NOT allow | Cashier applies a discount without selecting any reason | Reason field is mandatory; cannot submit blank |
| DISC-07 | Must NOT allow | Cashier self-approves an above-threshold discount by editing their own permission or invoice state | Approval authority is a separate server-side permission tied to role (Branch Admin/Owner), not something the requesting cashier account can grant itself; any attempt is blocked and audited |
| DISC-08 | Must NOT allow | Discount applied retroactively to an already-paid, closed invoice | Must go through Refund (partial refund of the discounted amount), not a retroactive discount edit |

### Cross-role handoff
- Discount requests appear on Branch Admin/Owner's dashboard "Pending Approvals" widget (PRD §14.1) in real time — this is the core cross-role handoff for this screen.
- Discount register feeds Owner's Revenue/Discount reports (PRD §14.2 Financial: "discounts/refunds").

### PRD cross-reference
§11.3 ("Discount/void/refund approval threshold, mandatory reason and audit"), §16.8 (Finance/stock audit family explicitly lists "discount"), §3.1 (approve is a separate permission from view/edit).

---

## A.6 Cash Opening

### Scenario
8:45 AM, before any invoice can be created, Meera must open the till with a declared starting cash float.

### Ideal step-by-step flow
1. Meera clicks **Open Cash Drawer** from her dashboard (or is redirected here automatically if she tries any billing action first).
2. Screen shows: Branch, Date, Cashier name (auto-filled), and a single input **Opening Cash Amount**, with the previous day's closing cash shown alongside for a natural sanity check ("Yesterday's close was ₹4,200 — does that match what's in the drawer?").
3. Optional denomination breakdown (₹500 × n, ₹200 × n, etc.) for clinics that want that level of detail — configurable per clinic policy, not hard-coded.
4. Meera confirms; the drawer session officially opens, stamped with time/actor, and only now do New Invoice/Payment actions unlock for her for the day.
5. If a different cashier already opened the drawer today (e.g., a shift handover), the system shows that clearly rather than allowing two "opening" events to silently coexist — Meera would instead see "Drawer already opened today by Sana at 8:30 AM, current balance ₹4,200" and can do a **shift handover** acknowledgment instead.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| CO-01 | Happy path | Open drawer with ₹4,200 matching yesterday's close | Session opens instantly, invoicing unlocked |
| CO-02 | Edge | Opening amount doesn't match yesterday's closing amount | Not blocked (cash can legitimately be added/removed by owner overnight), but a visible variance note is required so it's flagged for the day's close reconciliation, not silently ignored |
| CO-03 | Edge | Two cashiers on the same branch on the same day (shift change) | Second cashier gets a "handover" flow, not a duplicate opening — one open drawer session per branch per day, with named custody handover events inside it |
| CO-04 | Must NOT allow | A cashier opens the drawer for a branch they are not assigned to | Branch-scoped permission blocks it |
| CO-05 | Must NOT allow | Billing actions proceed without an open drawer | Hard block, as tested in PAY-05 |

### Cross-role handoff
- Opens the reconciliation baseline consumed by Cash Closing (A.7) and visible to Branch Admin/Owner as part of the day's operational status (PRD §14.1 Branch Admin dashboard: "cash close").

### PRD cross-reference
§11.3 ("Cash close: opening cash..."), NFR-004 (single valid transaction per resource — prevents duplicate opening).

---

## A.7 Cash Closing

### Scenario — the client's own example
8:00 PM. Meera needs to close the day's drawer. System expects ₹18,400 (opening float + cash collections − cash refunds), but she counts ₹17,900 in the drawer — a ₹500 shortfall.

### Ideal step-by-step flow
1. Meera clicks **Close Cash Drawer** from the dashboard.
2. Screen auto-computes **Expected Cash** = Opening float + all cash payments recorded today − all cash refunds recorded today (fully derived, not manually re-typed by her — removing a huge source of end-of-day error).
3. She enters **Counted Cash** (with the optional denomination breakdown again, for clinics that want it).
4. System shows the **Variance** live: ₹17,900 − ₹18,400 = **−₹500**, clearly labeled Shortfall (in red) vs Surplus (in a neutral/positive color) vs Balanced.
5. If variance is exactly ₹0: one-click **Confirm Close**, done in seconds — this is the common happy path and must be fast.
6. If variance is non-zero (like Meera's ₹500 shortfall): a **mandatory reason** field appears before she can submit — dropdown (Change given incorrectly, Counting error, Suspected shortage, Petty cash used, Other + text) plus free-text notes.
7. Submitting a variance close routes it to **Branch Admin/Owner for review** (visible as "Flagged" on their dashboard, as seen in CD-03). It does not block Meera's day from ending — she can still finish her shift — but the discrepancy stays open and visible until reviewed/resolved, never silently absorbed.
8. Also shown alongside cash: a same-day summary of UPI/Card/Bank Transfer totals, so the full day's revenue reconciliation (not just cash) is visible on one screen before she leaves.
9. Once submitted, the drawer session for the day is locked; no further cash payments can post against today's session (any late correction is a new dated adjustment, not a reopen).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| CC-01 | Happy path | Counted cash exactly matches expected | Instant close, no extra fields needed |
| CC-02 | Edge (client's exact example) | ₹500 shortfall | Reason mandatory before submit; flagged for Owner review; close still completes for the day |
| CC-03 | Edge | ₹500 surplus (overage) | Same mandatory-reason path applies to overages too — not just shortfalls, since unexplained surplus is equally an audit concern |
| CC-04 | Edge | Cashier tries to close before the last patient's payment for the day is recorded | System warns "There are still N unbilled 'Awaiting Billing' visits today — close anyway?" so nothing is missed by accident, with an explicit acknowledgment required to proceed |
| CC-05 | Edge | Refund processed after cash was already closed for the day | Blocked from posting against the closed session; must be dated/reconciled into the next open session with a clear cross-day note |
| CC-06 | Must NOT allow | Cashier submits a non-zero variance with no reason | Submit button stays disabled until reason is filled |
| CC-07 | Must NOT allow | Cashier edits/deletes a previously submitted cash-close record to "fix" the variance quietly | Closed sessions are append-only; correction requires a new adjustment entry referencing the original, with its own actor/time/reason, visible to Owner |
| CC-08 | Must NOT allow | Cashier views/closes another branch's drawer | Branch-scoped; blocked server-side |

### Cross-role handoff
- Flagged variances surface immediately on Branch Admin/Owner dashboard ("Pending approvals"/"cash close" widget, PRD §14.1) and in the Financial/variance report (PRD §14.2: "cash variance").

### PRD cross-reference
§11.3 ("Cash close: opening cash, collection, refund, expected vs counted, variance and approver" — matches this flow exactly), §16.8 (finance audit family explicitly includes "cash close").

---

## A.8 Refunds

### Scenario
A patient, Nisha, paid ₹5,000 in advance for a package but decides after one session she wants to discontinue and get a refund for the 5 unused sessions (pro-rated ₹4,000).

### Ideal step-by-step flow
1. Meera opens Nisha's invoice/package record and clicks **Initiate Refund**.
2. Screen shows what's refundable: original amount paid, sessions used vs remaining, and a suggested pro-rated refund amount (system-calculated from package pricing/config, not guessed) — Meera can adjust within policy limits.
3. **Mandatory reason** (dropdown: Patient discontinued treatment, Duplicate payment, Billing error, Dissatisfaction, Package cancellation, Other + text) — no refund can be submitted without one.
4. Refund mode selection: which payment mode to refund into (cash, or "reversal to original payment method" note for UPI/card since MVP has no gateway — refund would be a manual bank transfer/UPI-out recorded with reference).
5. Same as discounts: **approval threshold** applies. Small refunds (e.g. under ₹1,000) may be cashier-actionable; anything larger routes to Branch Admin/Owner approval before it's finalized and before cash physically leaves the drawer.
6. Once approved, refund posts: package balance reversed/cancelled, invoice shows "Refunded" or "Partially Refunded" status, a refund receipt is generated, and cash-close (A.7) will pick this up as a same-day cash refund reducing expected cash.
7. Refund is fully reflected in patient's app billing history and in the patient's package screen (no ambiguity about remaining sessions).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| REF-01 | Happy path | Small refund under threshold, clear reason | Instant process, audited, cash-close impacted correctly |
| REF-02 | Edge | Large refund above threshold | Held pending Owner approval, same pattern as Discounts (DISC-02) |
| REF-03 | Edge | Refund requested against an invoice that was paid via UPI, refund needs to go out as cash | Allowed but requires an explicit "cross-mode refund" acknowledgment, since it affects cash-close reconciliation differently than a same-mode refund |
| REF-04 | Edge | Refund requested on a package where 4 of 6 sessions already used | Pro-ration is auto-calculated from sessions actually consumed on the treatment record — the cashier cannot type an arbitrary "sessions used" number that contradicts the treatment history |
| REF-05 | Edge | Duplicate payment discovered (patient accidentally charged twice for same invoice) | Fast-tracked reason type; still requires approval per normal threshold rules — "obviously our error" does not bypass audit |
| REF-06 | Must NOT allow | Refund submitted with no reason | Blocked, same as discounts |
| REF-07 | Must NOT allow | Refund amount exceeds the amount actually paid on that invoice | Hard validation error; cannot refund more than was collected |
| REF-08 | Must NOT allow | Cashier processes refund and manually adjusts package session count separately (double-dipping the reversal) | Package balance reversal is automatically tied to the approved refund transaction, not a separate manual edit path |
| REF-09 | Must NOT allow | Refund on another branch's invoice | Branch-scoped, blocked |

### Cross-role handoff
- Reverses package balance visible on the Doctor's treatment plan and the patient's app package screen.
- Refund events appear in Owner's Financial report ("discounts/refunds") and in the audit trail (§16.8 finance/stock family explicitly lists "refund").
- If refund reason is "Dissatisfaction," this is a useful signal CRM should see for a possible service-recovery/NPS follow-up call (cross-role handoff to CRM's Reviews/NPS worklist).

### PRD cross-reference
§11.3 (refund, credit note), §10.4 ("Session is consumed only after completed treatment; reversal requires approval/audit"), §16.8.

---

## A.9 Revenue Reports

### Scenario
End of week, Meera (or Branch Admin) wants to see how the Adajan branch performed: total revenue, by service, by doctor, by payment mode, and how much is still due.

### Ideal step-by-step flow
1. **Revenue Reports** opens with a sensible default: "This branch, this month," so Meera isn't staring at an empty filter builder.
2. Filter bar: Date range (with quick presets: Today, This Week, This Month, Custom), Branch (locked to her own branch unless she has multi-branch access), Doctor, Service/Category, Payment Mode.
3. Headline cards: Total Revenue, Total Discounts Given, Total Refunds, Net Revenue, Total Dues Outstanding.
4. A revenue-by-day trend chart, plus breakdown tables: by Service, by Doctor, by Payment Mode — each drillable (click a bar to filter the whole report to that slice).
5. Every report screen shows filter state, generation timestamp and branch scope plainly at the top (so no one downstream misreads what the numbers represent), per the PRD's reporting-integrity rule.
6. **Export** (CSV/PDF) is a separate, audited permission — if Meera has it, exporting logs an audit event; if she doesn't, the button is simply not shown (not shown-then-blocked, to avoid confusion).
7. Large date ranges generate asynchronously with a "Report is being prepared, we'll notify you" pattern rather than freezing the screen.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| REV-01 | Happy path | View this month's branch revenue | Correct totals matching sum of invoices minus refunds/discounts |
| REV-02 | Edge | Filter by a doctor who works across two branches | Report still respects Meera's own branch scope — she sees only that doctor's Adajan-branch numbers, not the doctor's other branch |
| REV-03 | Edge | Date range spans a period with a flagged cash-close variance | Variance is called out distinctly (not silently netted into "revenue") so it's clear cash-in-drawer vs recorded-revenue are two different numbers |
| REV-04 | Edge | Export requested for a very large date range (e.g. full year) | Runs asynchronously; download link is time-limited/signed, not a permanent public URL |
| REV-05 | Must NOT allow | Cashier views consolidated multi-branch revenue without being granted that scope | Branch selector/consolidated toggle simply isn't available to a single-branch cashier role |
| REV-06 | Must NOT allow | Report reveals purchase cost/margin on treatments (a stock/COGS concept, not this role's concern) | Revenue report shows revenue-side figures only; cost/margin visibility is a separate, higher-privilege report |

### Cross-role handoff
- Rolls up into Owner's consolidated Revenue Dashboard and Branch Comparison (PRD §14.1 Owner dashboard).

### PRD cross-reference
§14.2 (Financial report dimensions), §14.3 (reporting rules: filter state/branch scope visible, export permission separate, async large reports, shared metric dictionary), §16.2 (confidential financial class — no clinical detail in finance export).

---

## A.10 Payment Reports

### Scenario
Meera's Branch Admin wants a reconciliation-focused view for the week: how much came in by each mode (cash/UPI/card/bank), any payments still marked "reference pending," and any patterns of failed card transactions.

### Ideal step-by-step flow
1. **Payment Reports** screen, distinct from Revenue Reports in that it's about *how money was collected* rather than *what was billed for*.
2. Default view: today's/this week's payments grouped by mode, with sub-totals and transaction counts.
3. Each payment mode section is drillable to the list of individual transactions (patient, invoice #, amount, reference number, time, cashier who recorded it).
4. A dedicated **"Missing/blank reference"** filter surfaces any UPI/card payment that was somehow recorded without a proper reference — useful for daily reconciliation against the bank/UPI settlement statement.
5. Cross-check widget: **Payments recorded today vs Cash-close expected cash** — if these ever diverge outside of the known variance-flow, it's surfaced here as a reconciliation alert rather than discovered a month later.
6. Same export/audit rules as Revenue Reports (A.9).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| PR-01 | Happy path | View today's payment-mode breakdown | Totals match Cash Closing's own totals exactly (single source of truth) |
| PR-02 | Edge | A UPI payment recorded with a reference that turns out to be a duplicate of another transaction's reference | Flagged as a possible duplicate-reference warning for manual review, not silently accepted |
| PR-03 | Edge | Filter to "cashier: Meera" to see her own recorded transactions for the shift | Works correctly and matches her own cash-close session |
| PR-04 | Must NOT allow | Payment report list exposes another patient's contact number in bulk export without an export permission | Export requires its own audited permission separate from view, per PRD §14.3 |
| PR-05 | Must NOT allow | Cross-branch payment data bleeds into a single-branch cashier's report | Branch-scoped, same as Revenue Reports |

### Cross-role handoff
- Reconciliation alerts and mode totals feed the Branch Admin's daily collection oversight and the Owner's mode-wise revenue analytics (PRD §14.2 "Financial: mode").

### PRD cross-reference
§11.3 ("Reports: branch/day/doctor/service/mode revenue... variance"), §14.2, §14.3.

---

# PART B — CRM / CALL DESK

## B.0 Design principles specific to CRM/Call Desk screens

Non-negotiable rules for every screen below (PRD §3, §12, §16.2, §16.3):

1. **No clinical detail in marketing view**: CRM sees complaint category/service interest at most, never diagnosis, treatment notes, or photos.
2. **Consent gates everything outbound**: marketing/offer messages require separate marketing consent; service/transactional messages (appointment, follow-up, receipt) don't need marketing consent but do need the relevant channel preference.
3. **Every outbound message uses an approved template** (WhatsApp business-initiated template, DLT-registered SMS header/template) — no free-text blasts.
4. **Opt-out is honored instantly and across all campaign tools** (suppression list is global, not per-campaign).
5. **Duplicate detection** happens before a "New Lead" becomes a duplicate patient/lead record.
6. **Every call outcome is logged** with a controlled disposition, not just a free-text note, so pipelines and reports stay usable.

---

## B.1 Dashboard

### Scenario
9:00 AM. Priya, the call-desk executive, starts her shift and needs one screen to know: how many new leads came in overnight (from Google/Instagram ads, website, walk-in), how many follow-up calls are due today, how many appointments were missed yesterday needing a recall call, and any pending review/NPS follow-ups.

### Ideal step-by-step flow
1. Priya's **CRM Dashboard** opens with KPI tiles: New Leads (today/this week), Leads Requiring Contact Today, Missed Appointments Needing Recall, Campaigns Sent This Week (delivery %), Pending Review/NPS Follow-ups.
2. A **lead-source mini funnel**: New Lead → Contacted → Appointment Requested → Booked → Visited → Treatment Converted, with counts at each stage this week, so Priya can see where leads are getting stuck.
3. A prioritized **"Call Now"** worklist combining: leads not yet contacted within SLA (e.g., 2 hours of enquiry), missed follow-up recalls, and missed-appointment recalls — sorted by urgency/age, so Priya doesn't have to jump between three separate screens.
4. Campaign delivery health strip: any WhatsApp/SMS campaign with unusually low delivery rate flagged (possible template/provider issue), so she can escalate rather than assume it's a person problem.
5. Quick actions: **New Lead**, **Start Calling Queue**, **New Campaign**.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| CRMD-01 | Happy path | Dashboard loads with today's real counts | KPIs match underlying Lead List/Missed Appointments/Campaign data exactly |
| CRMD-02 | Edge | A lead has been sitting "New" for over the SLA window with no contact attempt | Surfaces at the top of "Call Now" worklist automatically |
| CRMD-03 | Edge | A campaign shows 10% delivery vs usual 95% | Flagged as a delivery-health alert, distinct from normal KPI noise |
| CRMD-04 | Must NOT allow | Dashboard shows a lead's underlying clinical complaint detail (e.g., "suspected fungal infection") instead of a generic service interest (e.g., "Skin — Acne enquiry") | CRM data contract only carries service-interest category, not clinical wording, even if the enquiry text originally contained more |
| CRMD-05 | Must NOT allow | CRM dashboard exposes patients who have opted out of marketing as targets in a "call now" list that's actually a promotional push | Missed-appointment/follow-up recalls are service-related and allowed regardless of marketing opt-out; a promotional recall must be filtered against the opt-out list before appearing as callable in a marketing context |

### Cross-role handoff
- "Visited"/"Treatment Converted" pipeline stages update automatically the moment Reception checks a patient in and a doctor/cashier completes their visit — CRM doesn't manually chase this status.

### PRD cross-reference
§14.1 (CRM dashboard widgets: "lead pipeline, source conversion, recall list, campaign delivery and feedback"), §12.5 (pipeline stages).

---

## B.2 Lead List

### Scenario
Priya needs to work through this morning's 14 new leads: 6 from an Instagram laser-hair-reduction ad, 4 walk-in enquiries logged by reception, 3 website form submissions, 1 patient referral.

### Ideal step-by-step flow
1. **Lead List** shows a table/card list: Name, Phone (masked appropriately per role), Source, Service Interest, Date Received, Status (pipeline stage), Owner (which CRM staff it's assigned to), Next Action Due.
2. Filters: Source, Status, Date range, Assigned to, Branch (if leads are branch-specific), "Unassigned only," "Needs contact today."
3. **New Lead** button lets Priya (or reception) manually log a lead that came in by phone call directly, capturing: name, phone, source (dropdown incl. Google/Website/Facebook Ad/Instagram Ad/WhatsApp/Walk-in/Referral/Event/Other), service interest, notes (marketing-safe, no clinical wording), and campaign/ad-set field if available.
4. The moment a phone number is entered, the system runs a **duplicate check** against existing patients and existing leads — if a match is found, Priya sees "This number matches an existing patient: Kajal Mehta (MRN xxxx) — continue as new enquiry for existing patient?" instead of silently creating a confusing duplicate record.
5. Clicking a lead opens **Lead Details** (B.3).
6. Bulk actions (for authorized use): assign a batch of leads to a CRM staff member, or bulk-tag a source campaign — but never bulk-message directly from this list (that always routes through the proper Campaign screen with template/consent checks).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| LL-01 | Happy path | View today's new leads, filter by source "Instagram Ad" | Correct filtered subset with campaign/ad-set field populated |
| LL-02 | Happy path | Manually add a phone-in lead | Lead created with mandatory source field, appears in list immediately |
| LL-03 | Edge (required duplicate case) | New lead's phone number matches an existing patient's mobile | System shows the duplicate-candidate match and requires Priya to either link the enquiry to the existing patient record or explicitly confirm it's genuinely a different person (e.g. family member sharing a number) before saving | 
| LL-04 | Edge | New lead's phone number matches another *lead* (not yet a patient) already in pipeline from last week | Same-lead duplicate flag; prevents two CRM staff working the same lead in parallel unknowingly |
| LL-05 | Edge | Lead source is "Other" | Mandatory free-text sub-field required, per PRD's controlled-Other-text rule |
| LL-06 | Edge | Bulk-assign 6 leads to a CRM staff member who has left/is deactivated | Blocked with a clear "This user is inactive" message, not a silent failed assignment |
| LL-07 | Must NOT allow | Lead list shows full patient clinical history for leads that are actually existing patients enquiring about a new service | Only marketing-relevant fields (service interest, source, pipeline stage) are shown here, even for existing patients — clinical timeline stays in the patient 360 view, not CRM's lead view |
| LL-08 | Must NOT allow | CRM staff bulk-messages the entire lead list directly from this screen bypassing consent/template checks | No direct-send action exists on Lead List; messaging always routes through Campaigns (B.6/B.7) or Follow-up Calls (B.4), which enforce consent/template rules |

### Cross-role handoff
- A lead that books and shows up converts into linked Reception/Doctor records — "Visited"/"Treatment Converted" stage updates automatically once Reception check-in and billing/treatment completion occur (cross-role with Cashier's Invoice and Doctor's encounter-close).
- If a lead is actually an existing patient (per LL-03), the enquiry note appends to that patient's CRM/communication history tab (visible to Owner, PRD "Communication History" under Patient Management) without exposing clinical detail.

### PRD cross-reference
§12.5 (lead source, referral, CRM pipeline), §5.4 PAT-001 (duplicate detection principle applied here to leads too), §16.2 (restricted identity handling — masked display where possible).

---

## B.3 Lead Details

### Scenario
Priya opens the lead for Sneha, who enquired 3 days ago via the website about laser hair reduction, to make her first outreach call.

### Ideal step-by-step flow
1. **Lead Details** page: header with name, phone (click-to-call if telephony integration exists), source, first-tourne date, current pipeline stage as a clear stepper (New Lead → Contacted → Appointment Requested → Booked → Visited → Treatment Converted / Lost).
2. **Service interest & notes** section: what she enquired about, any notes from reception/website form — marketing-safe wording only.
3. **Call/task history timeline**: every past call attempt with date, staff, outcome, and next-action note — visible chronologically so Priya doesn't repeat questions Sneha already answered.
4. **Log this call** primary action: opens a simple outcome picker (see B.4 for the full disposition list) plus free-text notes and a **next action** (schedule next call, or "book appointment now").
5. **Book Appointment** quick action right on this screen — if Sneha is ready to convert, Priya doesn't need to leave Lead Details and hunt for a separate booking screen; it opens the same central availability engine used by reception, pre-filling Sneha's details, and on save automatically creates her as a registered patient (or links to an existing MRN if she's already one) and advances the pipeline stage to "Booked."
6. **Referral/source detail** panel shows campaign/ad-set/keyword if available, and referrer name/code if it's a patient/doctor referral — so Priya can also log a referral-thank-you task where relevant.
7. Ownership/reassignment control: transfer this lead to another CRM staff member with a reason, fully audited (avoids leads silently going stale when someone's on leave).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| LD-01 | Happy path | Log a call outcome "Interested — will call back Thursday" | Timeline entry added, next action scheduled for Thursday, pipeline stays "Contacted" |
| LD-02 | Happy path | Lead converts — Priya books an appointment directly from this screen | Patient record created/linked, appointment booked via central availability engine, pipeline auto-advances to "Booked" |
| LD-03 | Edge (required cross-role handoff case) | Lead books, later actually visits and completes a laser session that day | Pipeline auto-advances "Visited" → "Treatment Converted" purely from Reception check-in + treatment/billing completion events — Priya does not have to manually update this |
| LD-04 | Edge | Lead explicitly says "not interested, don't call again" | Disposition "Not Interested/Opted Out" immediately suppresses this lead from further outbound calling AND future marketing campaigns (both, since the request was total) |
| LD-05 | Edge | Lead reassigned to another CRM staff mid-pipeline | New owner sees full call history intact; reassignment reason captured; audit trail preserved |
| LD-06 | Must NOT allow | Priya edits/deletes a past call log entry to hide that she missed a promised callback | Call history is append-only; corrections are new entries referencing the old one, not silent edits |
| LD-07 | Must NOT allow | Lead Details surfaces the patient's diagnosis once converted to a patient | Even after conversion, this CRM screen continues to show marketing/pipeline fields only; clinical record lives in the patient's 360 view accessible only to clinical roles |

### Cross-role handoff
- Booking directly creates the same Appointment/Patient records Reception uses (PRD §6.1 booking channels explicitly includes "Reception/call desk").
- Pipeline auto-progression to Visited/Treatment Converted depends on Reception check-in and Cashier/Doctor visit-completion events — the single most important cross-role wiring for CRM.

### PRD cross-reference
§12.5 (pipeline stages, call/task history, referrer), §6.1 (CRM as a booking channel), §16.3 (withdrawal is purpose/channel-specific and audited).

---

## B.4 Follow-up Calls

### Scenario
The doctor set a follow-up for a patient, Aarav, "within 7 days, to review PRP hair-treatment response." Six days have passed and no appointment has been booked yet — the recall worklist should surface this to Priya today, matching the client's exact example.

### Ideal step-by-step flow
1. **Follow-up Calls** worklist lists every doctor-created follow-up order that is due or approaching due, with: Patient, Doctor, Purpose (e.g. "PRP response review" — a short clinical purpose label, not full notes), Due date/window, Priority (Normal/Doctor Attention/Urgent — inherited from the doctor's order, never invented by CRM), and whether an automated reminder (WhatsApp/SMS) has already gone out and what its status is (Sent/Delivered/Read/Failed).
2. Default filter: "Due today or overdue," sorted by priority then by days overdue.
3. Priya clicks Aarav's row → sees the same call-outcome/logging interface as Lead Details, but tagged as a **clinical follow-up recall**, not a marketing lead.
4. She calls Aarav; disposition options specifically suited to follow-ups (matching the PRD almost verbatim): **Booked**, **Call Later**, **Not Interested**, **Unreachable**, **Wrong Number**, **Opted Out**.
5. If **Booked** — she can book right there (same central availability engine), which closes this recall item.
6. If **Call Later** — she sets a next-call date/time and it reappears in her queue then, rather than getting lost.
7. If **Unreachable** after N attempts (configurable, e.g. 3 tries over 3 days) — item auto-escalates to a supervisor view rather than quietly dying, since a missed clinical follow-up is a bigger deal than a missed marketing lead.
8. Urgent-priority follow-ups (doctor flagged "doctor attention"/"immediate") appear with a distinct visual treatment and cannot be silently deprioritized by sort/filter — they always float toward the top.
9. Clinical purpose stays a short label; if Priya needs more context she can see "doctor requested this — see patient record" but the detailed clinical reasoning stays in the EMR, accessible to clinical roles only, not duplicated into the CRM screen.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| FUC-01 | Happy path | Call patient, they book on the spot | Recall closed, appointment created, follow-up order marked fulfilled |
| FUC-02 | Edge (required "auto-recall" case) | 6 days into a 7-day follow-up window, no appointment yet, no call attempt logged | Item is already visible in the "Due today or overdue" worklist automatically (it doesn't wait for day 8) — this is the "missed-follow-up auto-recall" behavior |
| FUC-03 | Edge | Patient says "call me next week" | Disposition "Call Later" with a scheduled next-call date; item disappears from today's queue and reappears exactly then |
| FUC-04 | Edge | Patient unreachable 3 times over 3 days | Auto-escalates to CRM lead/supervisor visibility as a "stalled follow-up," rather than being marked closed or silently dropped |
| FUC-05 | Edge | Reminder WhatsApp/SMS already auto-sent and patient already booked in response to it (via secure link) before Priya calls | Item is already marked "Booked" via automation and removed from Priya's active call queue before she wastes a call — avoids annoying an already-converted patient |
| FUC-06 | Edge | An appointment already exists for this follow-up (patient rebooked independently) | Priya's screen and any reminder correctly show "Confirms existing appointment" rather than asking to book again (matches PRD §12.1 rule exactly) |
| FUC-07 | Must NOT allow | Priya marks a follow-up "Booked" without an actual appointment record existing | Disposition "Booked" can only be set if linked to a real appointment ID; cannot be manually declared true |
| FUC-08 | Must NOT allow | Urgent/doctor-attention follow-up is displayed with the same low-priority visual weight as a routine 3-month skincare check-in | Priority visual/sort hierarchy is enforced by the system, not left to individual staff discretion |
| FUC-09 | Must NOT allow | CRM screen shows the doctor's full clinical note behind the follow-up order | Only the structured purpose label and priority are exposed to this role; full note requires clinical-role access |

### Cross-role handoff
- Follow-up orders originate entirely from the Doctor's consultation workspace (PRD §8.3: "Follow-up is a structured order: recommended date/window, purpose, priority, preferred doctor/branch and reminder plan") — CRM never invents a follow-up; it only works the queue the doctor created.
- Successful booking here is visible back on the Doctor's dashboard as a resolved follow-up.

### PRD cross-reference
§12.1 (follow-up and recall engine — this section is essentially a direct implementation of that spec, including the exact disposition list "Booked, Call Later, Not Interested, Unreachable, Wrong Number, Opted Out"), §12.2 (reminder plan), §8.3 (follow-up as structured order).

---

## B.5 Missed Appointments

### Scenario
Yesterday, 3 patients were booked but didn't show up (no-show) and 2 cancelled last-minute without rebooking. Priya needs to work through these today before they're forgotten.

### Ideal step-by-step flow
1. **Missed Appointments** worklist: Patient, Doctor, Service, Scheduled date/time, Reason captured at the time (No-show / Cancelled / Rescheduled-then-missed), Branch, Days since missed.
2. Default filter: yesterday and today, sorted oldest-first, with an "already recalled" toggle to hide ones already actioned so Priya isn't reworking the same list endlessly.
3. Clicking a row opens the same call-logging interface as Follow-up Calls (consistent interaction pattern across CRM screens reduces training time, matching the PRD's UX principle of consistent status/action language).
4. Disposition options: **Rebooked**, **Will call back**, **Not interested anymore**, **Unreachable**, **Wrong number**, **Medical reason — reschedule needed** (a special case that might warrant flagging back to the doctor if it suggests a clinical concern, without CRM diagnosing anything themselves).
5. Rebooking again uses the shared availability engine directly from this screen.
6. A visible **"why did they miss it?"** field (free-text, marketing-safe) helps the clinic spot patterns (e.g., "traffic," "forgot," "double-booked personally") which rolls up into CRM Reports for the Owner to see systemic issues (e.g., a particular time slot always gets no-shows).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| MA-01 | Happy path | Call a no-show patient, they rebook | Disposition "Rebooked," linked to new appointment, item closes |
| MA-02 | Edge | Patient cancelled themselves via WhatsApp already and independently rebooked | Item shows as already resolved (auto-detected from the appointment state machine) so Priya doesn't make a redundant call |
| MA-03 | Edge | Patient says the reason for missing was they're now hospitalized/unwell | CRM logs disposition "Medical reason" and can flag doctor/clinical team for awareness — but does not attempt to record or interpret medical details itself; a simple flag/notification suffices |
| MA-04 | Edge | Same patient shows up in Missed Appointments 3 times in 2 months | Pattern surfaces automatically (repeat no-show flag) so Priya/branch can decide on a policy response (e.g., require confirmation call before next booking) |
| MA-05 | Must NOT allow | Missed-appointment recall calling proceeds for a patient who has fully opted out of all communication/contact | Even though this is a service-related recall (not marketing), a full "Opted Out" (all channels/all contact) status must still be respected; CRM should see the record but the system should flag "Patient requested no contact" prominently before Priya dials |
| MA-06 | Must NOT allow | The reason field is used to record diagnosis-like information (e.g., "patient said their laser burn got infected") without routing it to a clinical workflow | Any hint of an adverse-event/clinical concern typed here should trigger a prompt: "This sounds clinical — flag to doctor/clinical team?" rather than just sitting as a marketing note nobody clinical ever sees |

### Cross-role handoff
- Missed-appointment status originates from Reception's queue/check-in system marking a booked slot as No-show (PRD §6.3 state machine: "No-show / Cancelled / Rescheduled").
- A flagged "medical reason" or adverse-event hint routes an alert to the Doctor/clinical queue — a genuinely important safety-relevant handoff, not just a CRM courtesy.

### PRD cross-reference
§6.3 (appointment state machine — No-show/Cancelled/Rescheduled with reason, actor, time), §6.6 APT-006 (cancellation/no-show reason and waitlist), §12.1 (recall worklist disposition pattern reused here).

---

## B.6 Campaigns

### Scenario
The clinic wants to run a "Monsoon Skin Care" promotional campaign targeting all patients who visited for skin concerns in the last 6 months and who have marketing consent.

### Ideal step-by-step flow
1. **Campaigns** screen: list of past/active/scheduled campaigns with name, channel(s), audience size, send status, delivery rate, and conversion (bookings attributable to this campaign).
2. **New Campaign** wizard, step by step:
   - **Step 1 — Audience**: build a segment using filters (service history category, branch, last-visit window, gender/age band if relevant, source) — critically, the audience builder **automatically excludes anyone without active marketing consent** before Priya even sees a final count; she cannot manually override this exclusion.
   - **Step 2 — Channel**: choose WhatsApp Campaign and/or SMS Campaign (each opens its own template-selection screen, B.7/B.8).
   - **Step 3 — Content**: select from **approved templates only** — no free-text composition for marketing sends, since WhatsApp/DLT rules require pre-approved templates for business-initiated/promotional messages.
   - **Step 4 — Schedule**: send now or schedule for a specific date/time, respecting configured **quiet hours** (e.g., no promotional sends before 9 AM or after 8 PM) automatically.
   - **Step 5 — Review & Send**: final audience count, sample message preview, estimated cost (if applicable), and an explicit confirm step (this is an irreversible, external-facing send, so it deserves a deliberate confirmation, not an accidental single click).
3. After sending, the campaign's **live delivery dashboard**: Sent / Delivered / Read / Failed / Opted-out-during-send counts, and any bookings that came in with this campaign tagged as source (closing the loop back to the Lead pipeline).
4. Failed sends can be retried, or the failure reason (e.g., invalid number, provider error) is shown for cleanup.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| CAM-01 | Happy path | Build audience of consented patients, select approved template, send | Audience correctly pre-filtered to consented recipients only; send proceeds; delivery dashboard populates |
| CAM-02 | Edge (required consent-gating case) | Audience includes a patient who has service consent but explicitly opted out of marketing | This patient is automatically excluded from the promotional audience count, with no manual override control exposed |
| CAM-03 | Edge | Someone opts out via WhatsApp reply mid-campaign send | Their opt-out is honored immediately for the remainder of this campaign and is added to the global suppression list for all future campaigns (not just this one) |
| CAM-04 | Edge | Campaign scheduled to send at 10 PM | Blocked/auto-rescheduled to the next permitted quiet-hours window, not silently sent late at night |
| CAM-05 | Edge | Template gets rejected by WhatsApp/DLT provider mid-way through send | Remaining unsent messages are held, error surfaced clearly ("Template rejected by provider — campaign paused"), rather than silently failing all remaining sends without explanation |
| CAM-06 | Must NOT allow | Priya composes and sends free-text promotional content without an approved template | No free-text send path exists for marketing campaigns; only approved template selection is offered |
| CAM-07 | Must NOT allow | A campaign is built and sent that includes clinical detail (e.g., "Since you were treated for acne scarring...") in message body | Templates are pre-approved and clinic-vetted before ever appearing in the selection list; the campaign builder itself never allows inserting per-patient clinical fields into a template |
| CAM-08 | Must NOT allow | Campaign targets a patient who is a lead/enquiry-only (not yet a patient) using a "transactional" template category to bypass marketing consent requirements | Template category (transactional vs marketing) determines eligibility rules, and marketing templates always enforce the marketing-consent filter regardless of recipient type |

### Cross-role handoff
- Booking attributed to a campaign feeds back into Lead List/Lead Details' source/campaign field and the pipeline funnel on the CRM Dashboard.
- Delivery/opt-out events append to the patient's Communication History (visible to Owner under Patient Management) and to the notification audit log (PRD §16.8 Communication family).

### PRD cross-reference
§12.4 (channel/consent policy — marketing separate consent, easy opt-out, quiet hours, DLT/WhatsApp template rules), §12.5 (offer board), §16.3 (marketing consent must be separate, explicit, granular, revocable, default off).

---

## B.7 WhatsApp Campaign

### Scenario
Within the "Monsoon Skin Care" campaign, Priya specifically configures the WhatsApp leg, which supports richer content (image + interactive button) than SMS.

### Ideal step-by-step flow
1. From the Campaign wizard's channel step, **WhatsApp Campaign** opens a dedicated configuration screen.
2. Template picker shows only **WhatsApp Business-approved templates** already vetted and registered — each with a preview showing exactly how it renders (header image, body text with merge fields like {{PatientFirstName}}, footer, and buttons like "Book Now"/"Call Us").
3. Merge-field mapping is guided — Priya picks from a safe, pre-approved field list (first name, branch name, offer validity date) — she cannot inject arbitrary patient fields, especially not clinical ones.
4. "Book Now" button, if used, deep-links into the same secure booking flow used elsewhere (central availability engine), never asking the patient to share sensitive info over open chat.
5. A **test send** to Priya's own/a designated test number is available before the real send — catching template rendering issues before 2,000 patients see them.
6. Delivery/read receipts and button-click (conversion) tracking shown per recipient in the campaign's live dashboard, feeding back into the source-attribution funnel.
7. If a recipient's chat is within WhatsApp's "service window" from a recent transactional message, that's tracked separately for compliance/reporting, but doesn't change how Priya composes anything (business-initiated template rule applies uniformly for this campaign type).

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| WA-01 | Happy path | Send approved template with merge fields to consented audience | Correct personalized rendering; delivery/read tracked |
| WA-02 | Edge | Recipient has no WhatsApp / number invalid | Marked "Failed — invalid number," excluded from delivered count, visible for cleanup |
| WA-03 | Edge | Patient clicks "Book Now" and is taken to book a custom/unavailable slot | Same Pending Approval flow as any other WhatsApp booking (PRD §12.3), not a special campaign-only shortcut that bypasses approval |
| WA-04 | Edge | Patient replies to the WhatsApp message with a question instead of using buttons | Routes to a human escalation/inbox (not answered by an unmonitored bot), per PRD's "clear human escalation" requirement |
| WA-05 | Must NOT allow | Template contains an unapproved free-text field or an unapproved image not on file with WhatsApp Business | Send is blocked before dispatch; provider-side template ID mismatch is caught and surfaced clearly |
| WA-06 | Must NOT allow | Campaign attempts to send to a number that already opted out (even if freshly added to today's audience segment by a stale cached list) | Suppression check happens at send-time, not just at audience-build time, to catch opt-outs that happened in between |

### Cross-role handoff
- "Book Now" clicks that lead to bookings flow into the same appointment/availability system Reception and CRM Lead Details use.
- Delivery status/webhooks are stored and auditable (PRD §16.8 Communication family: "provider message/call ID, delivery, patient action and opt-out").

### PRD cross-reference
§12.3 (WhatsApp reschedule/booking flow via approved template and secure link), §12.4 (WhatsApp policy: approved business-initiated templates, service-window handling, human escalation, webhook audit).

---

## B.8 SMS Campaign

### Scenario
For patients without WhatsApp or with WhatsApp opted out but SMS-consented, Priya sends the same "Monsoon Skin Care" offer via DLT-registered SMS.

### Ideal step-by-step flow
1. **SMS Campaign** configuration screen shows only **DLT-registered templates** tied to the clinic's registered sender header — the template text is fixed except for approved variable slots (e.g., patient name, offer code, validity date), exactly matching the DLT-approved wording (no ad-hoc edits allowed, since altering approved SMS template text risks provider/regulatory rejection).
2. Character-count and template-ID are shown clearly so Priya knows exactly what will be billed/sent.
3. Same audience-consent filtering as any campaign (marketing consent required, opted-out numbers auto-excluded).
4. Quiet-hours scheduling applies the same as WhatsApp.
5. Delivery report per recipient (Sent/Delivered/Failed with provider status codes) in the live dashboard.
6. A visible reminder banner: "Unregistered/free-text SMS is blocked in production — use only approved DLT templates," reinforcing this isn't just a UI suggestion but an enforced control.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| SMS-01 | Happy path | Send DLT-approved template to consented audience | Correct send, delivery tracked against DLT template ID |
| SMS-02 | Edge | Priya tries to tweak template wording slightly ("just to make it friendlier") | Blocked — approved template text is locked outside of its designated variable slots |
| SMS-03 | Edge | Sender header mismatch (wrong registered header selected for this template) | Validation error before send, not a bounced/rejected send discovered after the fact |
| SMS-04 | Edge | Recipient on DND (Do Not Disturb) registry for promotional SMS | Excluded automatically from a promotional-category send; transactional-category messages remain unaffected by DND registry status |
| SMS-05 | Must NOT allow | Free-text SMS content composed and sent outside of an approved template | No such path exists in production; UI does not offer a free-text compose box for SMS campaigns |
| SMS-06 | Must NOT allow | SMS sent to a patient who withdrew SMS-channel consent specifically (even if they didn't withdraw WhatsApp consent) | Channel-specific consent/withdrawal is respected per channel, not treated as one blanket "marketing consent" flag |

### Cross-role handoff
- Same delivery/audit trail and source-attribution loop as WhatsApp Campaign.

### PRD cross-reference
§12.4 ("DLT/SMS: Store registered entity/header/template ID and approved variables; block unregistered free text in production"), §16.3 (channel-specific consent).

---

## B.9 Reviews

### Scenario
A patient completed a treatment 2 days ago. The clinic wants a public review request sent, but only to patients who are actually happy (to avoid amplifying a bad experience publicly) — and separately wants to catch dissatisfied patients early for private service recovery.

### Ideal step-by-step flow
1. **Reviews** screen lists patients eligible for a review request: completed visit within the configured window (e.g., 1–3 days post-visit), not already asked, with service-consent for this kind of contact.
2. The flow is typically two-staged (best practice, avoids "review-gating" while still protecting public reputation):
   - A private in-app/WhatsApp micro-survey first asks a simple satisfaction question ("How was your visit?" 1–5 or thumbs).
   - **High satisfaction** responses get an immediate follow-up prompt/link to post a public review (Google/Facebook, per clinic's configured platforms).
   - **Low satisfaction** responses are instead routed straight to a **private feedback capture** and flagged to CRM/Branch Admin as a service-recovery item — never pushed toward a public review link.
3. Priya's Reviews dashboard shows: Requests Sent, Responses Received, Public Reviews Posted (if trackable via link tagging), Low-Satisfaction Flags Needing Follow-up.
4. Clicking a low-satisfaction flag opens a call-logging screen (same consistent pattern as B.4/B.5) so Priya can call the patient, log the issue, and — if it's genuinely a clinical/safety issue rather than a service issue — flag it onward to the clinical team (same principle as MA-06).
5. Review requests respect marketing/communication consent and quiet hours like any other outbound message, and use approved templates.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| REV1-01 | Happy path | Happy patient gets private survey, rates 5/5, gets public review link | Correct branching; public review link sent only after high satisfaction confirmed |
| REV1-02 | Edge (service recovery) | Patient rates 2/5 | Routed to private feedback capture and flagged for CRM/Branch Admin follow-up call; no public review link ever sent to this patient for this visit |
| REV1-03 | Edge | Patient doesn't respond to the private survey at all | No public review link is sent by default (fail-safe: absence of a positive signal never defaults to "assume happy") |
| REV1-04 | Edge | Patient's complaint in the low-satisfaction feedback describes a possible adverse reaction | Flagged distinctly as a clinical-safety concern for immediate escalation to the clinical/doctor team, separate from a routine "service was slow" complaint |
| REV1-05 | Must NOT allow | A public review request is sent to a patient before checking their satisfaction score, purely because "most patients are happy" | Two-stage gating is mandatory; no skip-to-public-request path exists |
| REV1-06 | Must NOT allow | Review request sent to a patient who opted out of marketing/feedback communication | Consent check applies to review requests the same as any other outbound campaign |
| REV1-07 | Must NOT allow | Low-satisfaction feedback content is used verbatim in a public-facing testimonial without consent | Private feedback is never automatically promoted to public marketing use; that would require the same explicit "marketing/public image use" consent as photos |

### Cross-role handoff
- Low-satisfaction/adverse-event-flavored feedback routes to the clinical/doctor team and/or Branch Admin for service recovery — an important safety-and-reputation cross-role handoff.
- Feeds the NPS screen (B.10) and CRM Reports' "feedback" metrics.

### PRD cross-reference
§12.5 ("Review request/NPS/feedback after completed visit; complaint escalation is separate from public-review request" — this is stated almost exactly and is the anchor rule for this entire screen), §16.3/§16.4 (marketing consent separate and revocable; no bundled consent).

---

## B.10 NPS

### Scenario
Monthly, the clinic wants to know its Net Promoter Score trend and which branch/doctor/service is driving detractors, so leadership can act, not just admire a number.

### Ideal step-by-step flow
1. **NPS** screen: a standard "How likely are you to recommend us to a friend or family member? (0–10)" question sent post-visit (via the same consented, templated, quiet-hours-respecting channel as reviews) at a configured cadence (e.g., not more than once every N months per patient, to avoid survey fatigue).
2. Dashboard shows: current NPS score (Promoters % − Detractors %), trend over time, breakdown by branch/doctor/service where sample size is meaningful, and response rate.
3. **Detractor worklist** (scorers 0–6) is the actionable heart of this screen — routed the same way as Reviews' low-satisfaction flow: private follow-up call task for CRM, with clinical-safety-flavored responses escalated to the clinical team separately.
4. **Passive** (7–8) and **Promoter** (9–10) responses feed the aggregate score and, for promoters, optionally the same public-review-invitation flow as B.9 (shared consent/branching logic, not a separate duplicate mechanism).
5. Trend narrative for Owner: a de-identified aggregate summary ("This branch's NPS dropped 8 points this month, driven by longer wait times mentioned in verbatim comments") — matches the PRD's "Analytics narrative" AI use case, but always presented as aggregate, de-identified insight, never as a per-patient clinical judgment.
6. Verbatim comments are shown to CRM/Owner but scrubbed of any accidental clinical content before display where feasible, and definitely never forwarded as-is into marketing material.

### Test cases

| ID | Type | Case | Expected result |
|---|---|---|---|
| NPS-01 | Happy path | Patient scores 9, leaves a positive comment | Counted as Promoter; comment stored; optional public-review prompt offered |
| NPS-02 | Happy path | Monthly NPS dashboard computes correctly across branches | Score = %Promoters − %Detractors, matches manual recompute from raw scores |
| NPS-03 | Edge | Patient scores 3 with comment mentioning a scheduling issue | Detractor worklist item created for CRM callback; not clinical, so stays within CRM/Branch Admin, no clinical escalation needed |
| NPS-04 | Edge | Patient scores 2 with comment describing a burn/reaction | Detractor AND clinical-safety flag both trigger — CRM handles the relationship/service-recovery angle while the clinical team is separately alerted for the safety angle |
| NPS-05 | Edge | Same patient would be due for another NPS survey only 3 weeks after the last one (inside the configured cooldown) | Survey is not sent again until the cooldown period elapses, to respect survey fatigue and communication-preference sensibilities |
| NPS-06 | Must NOT allow | NPS breakdown by doctor is shown at a branch with only 2 respondents this month, presented as if statistically meaningful | UI should suppress or clearly caveat any breakdown segment below a minimum sample-size threshold, to avoid a single unhappy patient unfairly tanking one doctor's visible score |
| NPS-07 | Must NOT allow | NPS survey sent to a patient who has withdrawn feedback/marketing communication consent | Same consent gate as Reviews and Campaigns applies uniformly |
| NPS-08 | Must NOT allow | Raw verbatim NPS comments containing a patient's phone number or another patient's name (accidentally typed) are displayed unredacted in a branch-wide report visible to many staff | Basic PII pattern-scrub/review step before wide-visibility display, consistent with the PRD's "no restricted identity data in unnecessary exports" principle |

### Cross-role handoff
- Detractor follow-up shares infrastructure with Reviews' low-satisfaction flow (same call-logging pattern as B.4/B.5/B.9 — a consistent CRM interaction model across the whole role, which is itself a UX principle worth calling out).
- Aggregate NPS trend feeds Owner's CRM Analytics dashboard (PRD §14.1 Owner dashboard row: "CRM Analytics").

### PRD cross-reference
§12.5 (review/NPS/feedback, complaint escalation separate from public-review request), §14.1 (Owner "CRM Analytics" widget), §9.1 ("Analytics narrative" AI use case — de-identified aggregate trends only), §16.3 (consent separation and withdrawal).

---

# Appendix — Cross-cutting rules that apply across BOTH roles

| Rule | Where it applies in this document |
|---|---|
| Branch scoping — a user only sees/acts on their assigned branch(es) unless explicitly elevated | Every Cashier screen (A.1–A.10); CRM leads/campaigns can be branch-tagged too |
| Mandatory reason + audit for discount, refund, void, cash-close variance | A.2.1, A.5, A.7, A.8 |
| Approval threshold escalation to Branch Admin/Owner | A.5 (Discounts), A.8 (Refunds) |
| No clinical detail exposed to finance/marketing roles | A.1–A.10 (invoice/report screens), B.1–B.10 (CRM screens) — reinforced repeatedly since this is a compliance-critical, easy-to-violate rule |
| Consent separation: service/transactional vs marketing vs voice vs photo, each independently withdrawable | B.6, B.7, B.8, B.9, B.10; referenced from A.4 (due-payment reminders are transactional, not marketing) |
| Append-only / no silent overwrite for signed financial and communication records | A.2.1, A.7, A.8, B.3 (call log), B.5 |
| Idempotency / concurrency safety on risky writes (double booking, double billing, duplicate payment) | A.2 (INV-06/07), B.2 (duplicate lead) |
| Cross-role event-driven automation instead of manual status chasing | A.1↔Doctor/Technician, A.2↔Doctor/Pharmacy, B.1/B.2/B.3↔Reception/Doctor/Cashier |

---

*This document is intended as the working reference for the Aurah 360 ClinicOS redesign of the Cashier/Accountant and CRM/Call Desk experiences. It should be reviewed by the clinic owner, accountant and CRM lead, and validated against final approval-threshold amounts, DLT/WhatsApp template registrations and consent wording before implementation.*


---

# Patient Mobile App

# Aurah 360 ClinicOS — Patient Mobile App
## Complete Test-Case & User-Flow Reference (Redesign Target)

**Purpose of this document:** This is a from-scratch, ideal-UX specification for every screen in the Patient Mobile App, written for a future redesign. It intentionally does **not** describe how the current build works — it describes how a real patient (or a guardian managing a dependent) at Aurah 360, a skin/hair/laser clinic in Surat, would *want* the app to work, step by tap, in the most intuitive order. Every flow is cross-referenced against the PRD's binding business rules (cited as `§section`), especially:

- **§13.1** Screen inventory and expected behaviour per screen
- **§13.2** Patient visibility rules (released-only records, generic notification text, always-visible dependent context, OTP-only auth)
- **§12** Notification/consent policy (no clinical data in push/SMS/WhatsApp text)
- **§16** Privacy, security, consent, and audit rules
- **§6** Appointment/availability state machine
- **§10** Treatment/package rules
- **§11** Billing/invoice rules (no payment gateway in MVP)

Two recurring personas are used throughout:

- **Priya Shah** — 29, first-time app user, existing patient, self-managed account.
- **Aarav Mehta** — 41, guardian managing his 15-year-old son **Yash's** dependent profile alongside his own.

---

## How to read this document

Each screen section has four parts:
1. **Real-life scenario** — a concrete walkthrough, tap by tap.
2. **Ideal flow** — the redesigned, no-code-constraints step sequence.
3. **Test cases** — happy path, edge cases, and "must NOT be allowed" cases in tables.
4. **Handoffs & business-rule cross-references** — what this triggers on the staff/reception/doctor side, and which PRD rule governs it.

---

# PART A — AUTHENTICATION

## A1. Splash Screen

### Real-life scenario
Priya taps the Aurah 360 icon on her home screen right after leaving the clinic. The splash screen must load fast enough that she doesn't wonder if the tap registered, and it must silently figure out whether she's already logged in, needs biometric unlock, or needs to log in from scratch.

### Ideal flow
1. App icon tap → logo + clinic tagline animates for under 1 second while the app checks for a valid stored session token in secure storage (§16.6: short-lived access token + protected refresh token).
2. **If a valid session exists and app-lock (PIN/biometric) is enabled** → go straight to a lightweight biometric/PIN prompt (Screen A4 equivalent), not the full login form.
3. **If a valid session exists and no app-lock is set** → go directly to Home.
4. **If no session / expired refresh token** → route to Login.
5. **If this is a genuinely first install** → route to Language selection first, then Login, so the rest of onboarding is in the patient's chosen language.
6. Splash also performs a silent connectivity check; if offline, it still opens using last-cached read-only Home data with a clear "You're offline — showing saved info" banner rather than an infinite spinner.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Returning patient, valid session, no app-lock | Lands on Home in <2s |
| Happy | Returning patient, valid session, app-lock enabled | Lands on biometric/PIN prompt, then Home |
| Edge | First install, no locale set | Routes to Language screen before Login |
| Edge | Expired refresh token | Silently redirects to Login without a scary error dialog |
| Edge | App opened with no network at all | Loads cached last-known Home (appointments, offers) marked "last synced <time>", disables actions needing network |
| Edge | App update mid-session invalidated old token format | Graceful "please sign in again" message, not a crash |
| Must NOT | Splash must never surface any cached data belonging to a previously logged-in *different* phone user/account | Cache is tied to signed-in account ID; switching accounts on same device clears cache first |

### Handoffs & cross-references
No staff-side handoff. Session/device management ties to §16.6 (secure sessions, immediate revocation ability from Settings → Devices).

---

## A2. Login (Mobile Number Entry)

### Real-life scenario
Priya was given her mobile number as her patient ID at registration. She opens the app for the first time and needs to prove it's her — nothing else. No password to remember, no email.

### Ideal flow
1. Single clean screen: country code pre-filled to +91, one input field for 10-digit mobile number.
2. Helper text explains simply: "We'll send you a one-time code to confirm it's you. No password needed."
3. Below the field, a link: "Existing clinic patient? Enter the same number our reception has on file." This avoids duplicate-identity confusion (PRD §5: single MRN per patient).
4. A collapsed "Privacy Notice" summary line ("We protect your health data — tap to read") satisfies layered notice requirement (§16.3) without blocking the primary flow; full text opens in a sheet, acknowledgment recorded with version/timestamp only once, at first registration/login — not re-shown every session.
5. Tapping **Continue** validates Indian mobile format client-side, then server-side (§5.1), and requests OTP.
6. If the number is **not found** in the clinic's patient master, app does not silently create an account — it shows: "We couldn't find this number in our records. Please visit or call the clinic to register first, or continue as a guest to browse services." (No back-door self-registration that bypasses reception identity verification, per §5's registration model — though a lightweight "request a callback" lead-capture path may exist and would feed the CRM pipeline per §12.5.)

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Registered mobile number entered correctly | OTP sent, moves to OTP screen |
| Happy | Number with leading 0 or +91 prefix typed manually | App normalizes and accepts |
| Edge | Number not in patient master | Clear message + "request registration" or "call clinic" CTA, no account auto-created |
| Edge | Rate-limited: 5 OTP requests in 10 minutes | "Too many attempts, try again in X minutes" (§16.6 anti-enumeration/rate limit) |
| Edge | Typo caught before submit (9 digits) | Inline validation error, not a server round-trip |
| Edge | Poor network when tapping Continue | Button shows loading state, disabled to prevent double-submit, times out gracefully with retry |
| Must NOT | Login screen must never reveal whether a number "exists" vs "wrong format" in a way that lets someone enumerate registered patients | Error messaging is deliberately generic for privacy (anti-enumeration, §16.6) |

### Handoffs & cross-references
No staff action yet. If "request a callback" is used for an unregistered number, it creates a **New Lead** in the CRM/Call Desk queue (§12.5 pipeline: New Lead → Contacted).

---

## A3. OTP Verification

### Real-life scenario
Priya receives an SMS/WhatsApp OTP seconds after tapping Continue. She's standing outside the clinic with two bars of signal — the flow needs to tolerate a slow or failed delivery.

### Ideal flow
1. 6-digit OTP entry with auto-read from SMS on Android (with permission) to avoid typing; auto-advances per digit box.
2. Countdown timer for resend (e.g., 30 seconds) shown clearly; "Resend OTP" enabled only after countdown; a secondary "Send via WhatsApp instead" option if SMS is delayed.
3. Clear attempt counter is *not* shown numerically (avoids helping attackers) but after each wrong attempt: "That code didn't match, please try again."
4. After a fixed number of failed attempts, account temporarily locks with a friendly explanation and support contact — not a dead end.
5. Successful verification stores tokens securely and immediately asks (only on first-ever login): "Do you want to protect the app with Face ID / fingerprint / PIN?" (leads to a lightweight A4).
6. If this is genuinely the very first login, after OTP success the app checks whether any **dependents** are linked to this guardian's number and shows a one-time "You also manage [Yash Mehta]'s care here" confirmation before Home — this satisfies the "dependent context always visible" rule (§13.2) from the very first moment.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Correct OTP entered within validity window | Verified, proceeds to app-lock prompt or Home |
| Edge | OTP expired (e.g., >5 min old) | "This code expired, request a new one" — old code rejected server-side |
| Edge | Wrong OTP entered 3 times | Escalating lockout with cool-down timer, not permanent ban without support path |
| Edge | Resend tapped before timer ends | Button remains disabled; no duplicate SMS sent |
| Edge | OTP arrives via WhatsApp instead of SMS due to carrier delay | Both channels accepted; whichever code is entered first is validated |
| Edge | User backgrounds app mid-OTP and returns 10 min later | Session state preserved but OTP re-validated for expiry |
| Must NOT | OTP screen must never log or display the actual OTP value anywhere in app logs/analytics | No plaintext OTP in crash/analytics logs (§13.3 APP-008, §16.7) |
| Must NOT | Must not allow OTP bypass via deep link or URL parameter | Deep links can open pages but never skip authentication (§16.6 deny-by-default) |

### Handoffs & cross-references
Verified login itself creates an **Identity/Access audit event** (login success) per §16.8. No clinical staff action triggered by login alone.

---

## A4. Language Selection

### Real-life scenario
Priya's mother, who shares the family phone occasionally to check Yash's appointment, is more comfortable in Gujarati than English. The app must let language be changed painlessly, including mid-session, without logging out or losing an in-progress booking.

### Ideal flow
1. First-run: presented as a full clean screen with three large tappable cards — **English / ગુજરાતી / हिंदी** — each showing its own name in its own script so it's recognizable even to someone who can't read the others.
2. Selecting one instantly reflows all onboarding text in that language (§17.9: no hard-coded text, all strings externalized).
3. Language is always changeable later without re-onboarding: **Profile → Settings → Language**, one tap, applies instantly across the whole app — no restart required.
4. If a booking or form is in progress when the language is changed, all entered data (selected doctor, date, time, notes) is preserved — only the display strings change under the hood.
5. Medical/technical terms (e.g., drug names) may deliberately stay in English with a small translated helper caption underneath, per §17.8's rule that technical terms can remain English with local helper text.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | First-time user picks Gujarati | Entire onboarding + app renders in Gujarati |
| Happy | User switches language from Settings mid-session while on the "Book Appointment" screen with a date/time already selected | Selections persist; only labels/strings change |
| Edge | Long Gujarati/Hindi strings in buttons | No text clipping or overflow (§17.9 no fixed-length assumptions) |
| Edge | Device OS language differs from app language | App uses its own independent language, doesn't override user's explicit choice with device locale on every launch |
| Edge | Switching language while an OTP countdown is active | Countdown/timer state unaffected, only text re-renders |
| Must NOT | Must not require re-login or re-verification just to change language | Language is a pure display preference (§13.3 APP-007), not tied to auth |

### Handoffs & cross-references
Language preference syncs to patient profile and is respected by the notification templates staff/CRM send (§12.4), so a WhatsApp reminder to Priya's mother in Gujarati matches her app language.

---

# PART B — MAIN APP

## B1. Home

### Real-life scenario
Priya just got discharged from her acne consultation at 6:30pm. That evening, from her sofa, she opens the app expecting the very first thing she sees to answer "what's next for me and my family, and is there anything I need to act on right now."

### Ideal flow
1. Top of Home: a **persistent dependent-context switcher** ("Viewing: Priya Shah ▾") — even for a self-only account, this is shown (grayed if no dependents) so the pattern is consistent and there's zero ambiguity about whose data is on screen (§13.2 mandatory rule: dependent context always visible).
2. **Hero card — Next Appointment**: date, time, doctor name, branch name + a "Get directions" and "Add to calendar" button. If none exists, hero card becomes a friendly "Book your next visit" CTA.
3. **Action-needed strip** (only shown when relevant, dismissible per item, never nagging): e.g., "Your follow-up for acne treatment is due this week — Book now", "New report available", "Your reschedule request is pending confirmation."
4. **Treatment progress mini-card**: if Priya has an active package (e.g., laser sessions 3 of 6 used), a small progress bar with "2 sessions remaining, next suggested session: ..." — cost/margin never shown (§10.4).
5. **Quick actions row**: Book Appointment, My Appointments, Prescriptions, Reports — the four most-used destinations as big tappable icons, not buried in a hamburger menu.
6. **Offers carousel** below the fold, clearly separated and visually distinct from clinical content, labeled "Offers" so it's never confused with a medical notice (§12.4: marketing must be separately consented and visually separated).
7. Pull-to-refresh syncs latest state; if offline, shows last-synced timestamp banner.
8. If more than one dependent exists (Aarav's case), a subtle badge shows aggregated pending items across all profiles ("2 things need your attention across your family") so a guardian doesn't have to flip through each dependent individually to spot something urgent — tapping it deep-links into the specific dependent + screen.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient with an upcoming appointment opens Home | Hero card shows correct appointment; directions/calendar buttons work |
| Happy | Guardian (Aarav) opens Home while last-viewed context was Yash | Dependent switcher clearly shows "Viewing: Yash Mehta" banner, not silently defaulting to Aarav's own data |
| Edge | No upcoming appointment, no pending items | Home shows a calm empty state with primary "Book Appointment" CTA, not a blank screen |
| Edge | Offline on open | Cached data shown with "Last updated at 6:12 PM — reconnect to refresh" banner; action buttons requiring network are disabled with tooltip explanation |
| Edge | Push notification permission was denied earlier | Home shows a soft, dismissible banner: "Turn on notifications so you don't miss appointment reminders" linking to system settings — app still fully usable without it |
| Edge | Multiple pending items across 3 dependents | Aggregated badge count is accurate and each item deep-links to correct dependent context |
| Must NOT | Home must never show another patient's appointment/data even transiently during a fast dependent switch (race condition) | Screen shows a loading skeleton during context switch rather than flashing stale/wrong-person data |
| Must NOT | Offers/marketing card must never contain clinical specifics (e.g., "Special discount for your acne treatment") | Offers are generic/service-level, not diagnosis-specific, per §7.2 "no diagnosis in messaging" principle extended to in-app marketing |

### Handoffs & cross-references
No direct staff action from viewing Home. "Book now" and "Add to calendar" CTAs route into Booking (B2) and device calendar respectively. §13.1 defines this exact composition (next appointment, due follow-up, pending action, new released document, treatment progress).

---

## B2. Book Appointment

### Real-life scenario
That same evening, Priya wants to book her follow-up laser session. She doesn't want to call — she wants to see real available slots, pick one, and get instant certainty of confirmation status.

### Ideal flow
1. From Home or Quick Actions, tap **Book Appointment**.
2. **Step 1 — Who is this for?** If dependents exist, this is asked explicitly and up front (not assumed) — "Booking for: Priya Shah" with a switcher, so a guardian never accidentally books under the wrong person (§13.2).
3. **Step 2 — What do you need?** Two entry paths, both first-class:
   - "Continue treatment/follow-up" — if the doctor already placed a follow-up order (§8.3), this appears as a pre-filled suggested option: "Dr. Mehta recommended a follow-up in 2–4 weeks for Acne Treatment" — one tap books toward that recommendation.
   - "Book something new" — browse by service category (Consultation, Laser Hair Reduction, Skin/Hair treatment, Follow-up) with plain-language names, not clinical jargon.
4. **Step 3 — Branch.** Auto-suggests the patient's usual/nearest branch first (based on history or GPS with permission), but always lets switching branches, showing address, map pin, and phone.
5. **Step 4 — Doctor** (optional if patient has no preference — "Any available doctor" is a valid, prominent option so patients aren't forced to know doctor names).
6. **Step 5 — Date & time.** Calendar shows only genuinely bookable slots (computed from the full availability engine — doctor roster ∩ branch hours ∩ service rules ∩ room/device ∩ staff, minus buffers, §6.2) — no slot is shown that would just bounce back as unavailable. Slots are grouped Morning/Afternoon/Evening for scannability.
7. **Step 6 — Review & confirm.** Summary card: patient name (or dependent name, clearly labeled), service, doctor, branch, date/time, estimated duration. A short note field lets the patient add context ("Please note I get an itchy reaction to the numbing cream") which routes as intake info, not a chat.
8. **Step 7 — Outcome.**
   - If the slot was a normal available slot → **Confirmed** instantly, calendar event offered, confirmation notification sent.
   - If the calendar showed no matching standard slot and the patient requested a custom time via a "request different time" option → status becomes **Pending Approval**, with a clear explanation: "We've sent your request to the branch — you'll be notified within a few hours once it's confirmed or an alternative is suggested" (§6.2, §6.3).
9. Booking instantly appears in the reception's queue/calendar and pending-approvals list.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient books a standard open slot | Instant "Confirmed" state, appears in reception calendar and doctor's day view immediately |
| Happy | Patient books via the pre-filled doctor-recommended follow-up suggestion | Booking pre-fills service/doctor/urgency window from the follow-up order (§8.3), reducing re-entry |
| Edge — booking conflict | Two family members on shared device try to book the same last slot within seconds of each other | Database-level locking/idempotency (§6.2, §APT-008) ensures only one succeeds; the second sees "This slot was just taken, here are the next available options" — never a silent double-booking |
| Edge — custom time request | Patient wants a time outside standard slots | Enters Pending Approval state; patient sees status clearly, is notified of decision, never left wondering |
| Edge — same-day cutoff | Patient tries to book for today past the clinic's same-day cutoff | Today's slots after cutoff are simply not shown/selectable, with a note "Same-day booking closes at 5 PM — book for tomorrow instead" |
| Edge — cross-branch travel buffer | Doctor is at Branch A until 5:30 and Branch B from 6:15 | Slots respecting the travel buffer only are shown; unrealistic back-to-back slots never appear (§6.2) |
| Edge — offline/poor network mid-booking | Connectivity drops after Step 6 before confirmation returns | App shows "Checking booking status..." and reconciles instead of assuming success or duplicating the request on retry (idempotency key, §6.2/§APT-008) |
| Edge — wrong dependent context | Aarav starts booking while viewing Yash's profile, forgets to switch, tries to book for himself | Step 1 explicit "Booking for: Yash Mehta" banner remains visible through all steps so the mistake is self-correcting before submission |
| Must NOT | Patient must not be able to see or select branches/doctors/rooms/devices that are inactive, under maintenance, or outside their organization | Availability engine only ever exposes truly bookable, currently active resources (§4.3, §6.2) |
| Must NOT | Patient must not be able to book directly onto a treatment protocol step that requires doctor clinical approval (e.g., certain procedures) — only doctor can order those | Only doctor-orderable services are excluded from self-booking service list, or routed to a "request consultation first" flow |

### Handoffs & cross-references
- New booking → appears instantly in **Reception's Today's Queue / Pending Approvals** and the **Doctor's Calendar** (§6.4, §14.1 Reception dashboard "Arrivals, confirmations").
- Pending-approval bookings surface in **Receptionist "Pending Approvals"** and **Branch Admin dashboard**.
- Confirmation triggers the notification engine (§12.2): WhatsApp/SMS/push confirmation with date/time/branch/map + secure manage link — generic text only, no clinical content.

---

## B3. My Appointments

### Real-life scenario
A week later, Priya wants to check: "Did my reschedule request go through? What's actually confirmed right now, for me and can I also see what's coming up for Yash if I ever need to help my sister who's out of town?" (Extending scenario: assume Priya is also a secondary guardian for a niece — illustrates multi-dependent list clarity.)

### Ideal flow
1. Screen opens to a segmented view: **Upcoming / Past / Requests** tabs.
2. Each appointment card, regardless of tab, always shows a small labeled avatar/name chip for whose appointment it is — critical when dependents exist, so scanning a mixed list never causes confusion (§13.2).
3. **Upcoming** shows status-forward cards: Confirmed (green), Pending Approval (amber, with "awaiting clinic response"), Checked-in/Waiting if it's happening today.
4. **Requests** tab specifically surfaces anything awaiting a decision — pending approvals, reschedule requests sent, cancellation-in-progress — so nothing "disappears" into ambiguity.
5. Tapping any card opens a detail sheet: full date/time/branch/doctor/service, map, branch contact, and context-appropriate actions (Reschedule, Cancel, Get Directions, Add to Calendar, View pre-visit instructions if any).
6. **Past** tab links each completed appointment forward to its Timeline entry, Prescription, or Invoice if released, so a patient doesn't have to hunt across separate tabs to connect "that visit" to "that bill."

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient views Upcoming tab | Shows all future confirmed/pending appointments sorted chronologically, own + dependents clearly labeled |
| Happy | Patient taps a past appointment | Deep-links to relevant Timeline/Prescription/Invoice entries if released |
| Edge | Appointment status changes server-side (e.g., doctor's roster changed) while app is open | Pull-to-refresh or push-triggered refresh reflects the new status, with a clear "Your appointment time changed, please review" alert rather than silent update |
| Edge | Guardian views list containing appointments for self + 2 dependents | Each card visually differentiated (avatar/name/color chip) — no risk of tapping "Confirm" on the wrong person's appointment |
| Edge | No upcoming or past appointments (new patient) | Friendly empty state distinguishing "no history yet" vs an error |
| Edge | Poor network | List loads from cache first (stale-while-revalidate), with a small sync spinner, not a blank/frozen screen |
| Must NOT | Must not display other patients' appointments even ones at the same clinic/time/branch (e.g., no "3 other people booked this slot" visibility) | Strict per-account/per-dependent data scoping server-side (§16.6 deny-by-default authorization) |

### Handoffs & cross-references
This is a read/action surface over the same appointment records reception and doctors see; any action taken here (reschedule/cancel — detailed in B4/B5) writes to the shared state machine (§6.3) and is visible to staff in real time.

---

## B4. Reschedule

### Real-life scenario
Priya's laser session is booked for Thursday 4 PM, but her office announced a mandatory meeting that day. She wants to move it — ideally without a phone call, and she wants to know immediately if she's inside a cutoff window that might need clinic approval.

### Ideal flow
1. From an appointment's detail sheet, tap **Reschedule**.
2. App immediately checks the clinic's configured reschedule cutoff window (e.g., must reschedule ≥4 hours before) and shows one of two paths:
   - **Outside cutoff (plenty of notice):** Standard slot picker reappears (same UX as booking, §B2 Step 5) filtered to only show valid alternative slots; selecting one instantly re-confirms with no approval needed, old slot is released back into availability.
   - **Inside cutoff (short notice):** App is transparent: "You're rescheduling less than 4 hours before your appointment — this needs the branch's confirmation. We'll notify you as soon as they respond." Submits as Pending Approval rather than silently failing or silently succeeding.
3. A short optional reason field ("Why are you rescheduling?" — e.g., Work conflict, Feeling unwell, Transport issue) helps reception/CRM understand patterns without requiring it.
4. Confirmation screen shows old time struck through and new time highlighted, plus updated calendar/notification.
5. If the *old* slot being released makes another patient's earlier waitlist/pending request eligible, that's a backend/staff-side effect, not something the patient needs to see — but the app's copy avoids implying "your rescheduling helped someone else," keeping it neutral and about the patient's own outcome.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Reschedule requested well outside cutoff to an open slot | Instantly re-confirmed, old slot released, new confirmation sent |
| Edge — cutoff window | Reschedule requested 2 hours before a 4-hour-cutoff appointment | Clearly flagged as needing approval; submitted as Pending Approval, not silently auto-approved or silently rejected |
| Edge — no alternative slots | Patient wants to reschedule but doctor is fully booked for the next 2 weeks | App shows "No matching slots found — would you like to join the waitlist or request a custom time?" instead of a dead end |
| Edge — reschedule a Pending Approval appointment (not yet even confirmed) | Original request is superseded/withdrawn, new request submitted cleanly — no duplicate/orphaned pending records | 
| Edge — dependent's appointment | Guardian reschedules Yash's appointment; confirmation and any notification clearly says "Yash's appointment" not ambiguous "your appointment" | Notification copy always names the actual patient, not just the account holder |
| Edge — network drops after tapping a new slot but before confirmation | App reconciles on reconnect rather than creating two appointments or losing the request | 
| Must NOT | Patient must not be able to reschedule another guardian's dependent or a family member they aren't authorized for, even if they have the phone number memorized/guessed | Authorization checked server-side against verified guardian-dependent relationship (§13.2, §16.6), not just client-side dependent list |

### Handoffs & cross-references
- Outside-cutoff reschedules update the doctor/reception calendar instantly and appear in "Reschedule Requests" only if they needed approval (§ Receptionist screen list: "Reschedule Requests").
- Inside-cutoff reschedules land in **Receptionist "Pending Approvals" / "Reschedule Requests"** for a human decision, per §6.2/§12.3 (the same approve/propose-alternative/reject flow used for WhatsApp reschedules).
- Released slot may trigger a **waitlist offer** to another patient — a staff-side automation event, per PRD gap analysis §1.4 "Follow-up: Event-driven ... with delivery status" and cancellation handling in §6.3/§6.6 (APT-006 waitlist).

---

## B5. Cancel Appointment

### Real-life scenario
Priya's laser session needs to be cancelled outright — she's traveling out of town. She wants this to be quick but also wants to make sure she doesn't lose a paid package session unfairly, and that the clinic knows why (in case it matters for future recall).

### Ideal flow
1. From appointment detail, tap **Cancel** (visually secondary/lower-emphasis than Reschedule, since rescheduling is usually the better outcome for both patient and clinic — but never hidden or hard to find).
2. Before confirming, app shows a clear, honest summary: date/time being cancelled, and if this was going to consume a package session, an explicit note: "This won't use up a session from your package since you're cancelling in advance" vs., if inside a no-show-risk window, "Cancelling this late may be recorded per clinic policy" — transparency, no surprise deductions.
3. Simple reason picker (optional, not blocking): Can't make it / Feeling better / Rescheduling separately / Other — feeds CRM/recall data (§12.5) without requiring an essay.
4. One clear confirm button; a lightweight "Are you sure?" only if it's a same-day cancellation (to prevent fat-finger mistakes), not for every cancellation.
5. After cancellation: appointment moves to Past/Cancelled state, a positive next step is always offered — "Would you like to rebook for another time?" — rather than ending on a dead, negative note.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient cancels a future appointment with plenty of notice | Cancelled cleanly, slot released, no package session consumed, rebook CTA shown |
| Edge — same-day cancellation | Patient cancels a few hours before | Extra confirmation step shown; clinic's no-show/late-cancel policy communicated plainly beforehand, not as a punitive surprise afterward |
| Edge — cancelling a Pending Approval request | Simply withdraws the request; no "cancellation" audit noise implying a confirmed visit was broken | 
| Edge — cancelling on behalf of a dependent | Confirmation text explicitly names the dependent ("Cancel Yash's appointment on Thursday?") | 
| Edge — package-linked treatment session cancellation | App correctly reflects that the session is NOT deducted since it wasn't completed (§10.4: session consumed only after completed treatment) | 
| Edge — poor network during cancel | Action queues/retries safely; user sees "Cancelling..." not a false-positive success before server confirms | 
| Must NOT | Must not allow cancellation of an appointment that has already reached "Checked-in" or later clinical states (e.g., mid-consultation) from the app | Once a visit has progressed operationally, the app shows the current live status instead of a cancel option — cancellation past that point must go through staff |

### Handoffs & cross-references
- Cancellation immediately releases the resource (room/device/doctor slot) back into the availability engine and can trigger a **waitlist offer to another patient** (§6.6 APT-006).
- Appears in reception's day view as a freed slot; if same-day, may trigger an internal "cancellation today" alert per branch policy.
- Cancellation reason (if given) feeds CRM's recall/feedback loop (§12.5) without exposing clinical content.

---

## B6. Timeline (Health Timeline)

### Real-life scenario
Six months into treatment, Priya wants to look back at her whole acne-treatment journey — what was diagnosed (in patient-friendly language), what was prescribed, what reports came in, all in one scrollable story, not scattered across five different app sections.

### Ideal flow
1. A single reverse-chronological feed, one dependent's context at a time (with the switcher always visible at top, §13.2).
2. Each timeline entry is a card type: **Visit summary** (patient-facing doctor note only — never raw internal notes, §13.2/§8.3's staff-only vs patient-facing classification), **Prescription issued**, **Report released**, **Treatment session completed**, **Invoice generated** — each with a small icon and date.
3. Tapping a card expands to the relevant detail (which deep-links into Prescriptions/Reports/Treatments/Invoices screens for the full record) — Timeline is the story; the other tabs are the filing cabinet.
4. A filter chip row lets patients narrow by type (Visits / Prescriptions / Reports / Treatments / Bills) or search by keyword/date.
5. Only content the doctor/clinic has explicitly **released** to the patient appears (§13.2 core rule) — there is no "raw doctor note" leak path, and no unverified OCR-extracted report values are ever shown as if verified (§13.2).
6. Visually, entries pending release (e.g., "Your recent report is being reviewed by the doctor") can appear as a soft placeholder card so the patient knows something is coming, without showing unverified content — this manages expectations honestly rather than hiding the event entirely.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient scrolls timeline after several completed visits | Chronological, correctly typed cards, all clickable to full detail |
| Happy | Patient filters to "Prescriptions" only | List narrows correctly, still chronological |
| Edge | A report is uploaded but not yet reviewed/released by doctor | Timeline shows a neutral "pending review" placeholder, not the raw/unverified content |
| Edge | Doctor wrote an internal-only comment during a visit | That comment never appears on this timeline at all — only the released, patient-facing summary of that visit does (§8.3 classification: staff-only / internal clinical / patient-facing) |
| Edge | OCR extracted a lab value from a scanned old report before human verification | Value is not shown as a confirmed reading; document stays in "under review" state until a human verifies (§13.2, §7.1) |
| Edge | Switching from Priya's own timeline to Yash's | Full context switch with a visible confirmation banner; no cross-bleed of cards between profiles even briefly | 
| Must NOT | Patient must never see another patient's timeline entry, even by ID guessing or deep link manipulation | Every timeline query is server-authorized per-patient/per-guardian relationship (§16.6 deny-by-default) |
| Must NOT | Patient must never see the clinic's internal "Front Desk Handoff Note" content (subjective staff-only annotations) | That note is explicitly not released to the patient app per §5.3 |

### Handoffs & cross-references
Purely a read surface; "release" actions happen on the doctor/staff side (Doctor's consultation workspace "Release summary" action, §17.6 status system: Document → "Mark reviewed, Release"). This is the single most privacy-sensitive screen in the app and is the direct UI expression of §13.2.

---

## B7. Prescriptions

### Real-life scenario
Priya's mother needs to buy a refill of a prescribed cream from a local pharmacy and wants to show the exact prescription on her phone, plus check dosage instructions without having to remember them from the doctor's verbal explanation.

### Ideal flow
1. List of all released prescriptions, most recent first, each showing date, prescribing doctor, and a short human-readable summary line (e.g., "3 medicines — for acne").
2. Tapping opens full detail: each medicine with name, form/strength, dose, frequency, duration, and plain-language instructions (§8.3 structure), plus any substitution note if the doctor allowed generic substitution.
3. A **Share/Download as PDF** action generates a clean, clinic-branded PDF via short-lived signed link (§7.1) — safe to show a pharmacist without exposing the app itself.
4. If the doctor attached a patient-facing instruction draft (AI-assisted, doctor-approved per §9.1 "Patient instruction draft") — e.g., simple aftercare tips in the patient's language — it's shown clearly labeled as clinic guidance, not as raw AI output.
5. No edit capability whatsoever — purely read/share; any "I have a question about this" links to Support (from Privacy/Support area) rather than allowing in-line editing of a signed clinical document.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient views most recent prescription | Full accurate detail matches what doctor signed |
| Happy | Patient downloads/shares PDF to show a pharmacist | Signed URL opens correctly, valid for a limited time, doesn't expose an unauthenticated permanent link |
| Edge | Doctor later amends/adds an addendum to a signed prescription | Timeline/prescription view reflects the amendment with clear "updated on [date]" marker — never silently overwrites the original (§8.3 "no silent overwrite") |
| Edge | Prescription in Gujarati-preferred profile but medicine names are in English | Medicine/brand names stay accurate/English; instructions and labels localize (§17.8) |
| Edge | Guardian views dependent's prescription | Clearly headed "Yash Mehta's Prescription", not ambiguous |
| Must NOT | Patient must not be able to edit dosage/medicine text or mark a prescription as "fulfilled/dispensed" from the app — that's a pharmacy-side action | Prescription record remains strictly read-only to the patient (§11.1: pharmacy fulfillment is separately recorded by pharmacy staff) |
| Must NOT | Must not show internal-only doctor reasoning/differential diagnosis notes alongside the prescription | Only the finalized, released prescription content is shown |

### Handoffs & cross-references
Read-only mirror of the doctor's signed prescription (§8.3, §11.1). No write-back to pharmacy inventory/dispensing occurs from the app.

---

## B8. Reports

### Real-life scenario
Priya had a blood test ordered before starting isotretinoin. She's anxious and keeps checking the app to see if results are in — the flow needs to be honest about "not ready yet" versus clearly show it once released.

### Ideal flow
1. List of documents/reports relevant to the patient, each showing: report name, **clinical date** (not upload date, per §7.1) prominently, category (Lab, Imaging, Prescription, External consultation, etc.), and a status chip: **Pending Review / Released / Needs Clarification**.
2. Tapping a "Released" report opens a clean viewer (PDF/image) with pinch-zoom, download, and share-via-signed-link — same signed-URL pattern as Prescriptions (§7.1).
3. Tapping a "Pending Review" report shows a calm explanation: "Your doctor is reviewing this report. We'll notify you the moment it's ready to view" — never shows the raw uploaded file or any OCR-guessed values in the meantime (§13.2, §7.1: "OCR/AI may propose values but a human must verify").
4. Old external reports the patient/reception previously uploaded (e.g., paper report from another lab) also appear here once digitized, clearly tagged "Source: External / Uploaded by clinic" vs "Source: Aurah 360 internal."
5. A small upload-request affordance lets the patient message reception "I have an old report to share" which creates a task for staff rather than letting the patient upload directly into their own clinical record unreviewed (keeps a human verification gate, §7.1).

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient opens a released lab report | Clean viewer, correct clinical date shown, share/download works via signed URL |
| Edge | Report uploaded today but clinical draw date was 3 days ago | List sorts/displays by clinical date, not upload date |
| Edge | Report flagged "Needs Clarification" by doctor | Patient sees a neutral status, with guidance to contact clinic — not the ambiguous/flagged content itself |
| Edge | Malware scan on an uploaded external file is still "Pending" | File cannot be opened by anyone including the patient until scan clears (§7.1 "unclean files cannot be opened") |
| Edge | Offline viewing of a previously opened, cached report | Works for previously fetched reports; clearly marked as possibly stale if the report was later superseded |
| Must NOT | Must not show an unverified OCR-extracted value as if it were a confirmed lab result | Only human-verified, released reports display actual values (§13.2, §7.1) |
| Must NOT | Patient must not be able to delete or alter a report record | Reports are immutable originals; only clinic staff can manage lifecycle/versioning (§7.1) |

### Handoffs & cross-references
Report upload/verification/release happens entirely staff-side (Nurse "Upload Reports", Doctor "Reports" review, §14.1 Doctor dashboard "report review"). Patient's "share an old report" request creates a task visible in Reception's document intake queue.

---

## B9. Treatments (Treatments/Packages)

### Real-life scenario
Priya bought a 6-session laser hair reduction package. She wants to track how many sessions are left, when her next one should ideally be, and see simple aftercare tips after each session — without ever seeing internal cost/margin data.

### Ideal flow
1. Card-based list, one per active treatment plan/package: service name, plain-language description, a clear progress indicator ("Session 3 of 6 completed"), and next-recommended-date if the doctor set an interval.
2. Tapping opens full detail: chronological list of completed sessions (date, branch, brief outcome note if released, e.g., "No adverse reaction, proceed as planned"), plus any doctor-approved aftercare instructions per session.
3. A prominent **"Book next session"** button pre-fills straight into the Booking flow (B2) with the correct service/doctor/protocol context already selected — removing repetitive re-selection.
4. Completed/expired packages move to a "Past Treatments" section, still viewable for history but without an active booking CTA (replaced by "Ask about renewal" which routes to Offers/Support rather than a self-serve renewal payment, consistent with no in-app payment gateway, §11.3/§13.1).
5. Absolutely no cost, discount, or margin figures shown here — only clinically relevant plan/progress information (§10.4: "Patient app shows package progress ... without internal cost/margin").

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient views active package progress | Correct session count, next-session suggestion, "Book next session" pre-fills booking correctly |
| Happy | Patient taps into a completed session's aftercare notes | Shows only the doctor-released aftercare text, correctly dated |
| Edge | Package fully used (6 of 6) | Moves to Past, shows completion state, offers renewal conversation path (not self-checkout) |
| Edge | Package expired unused (validity lapsed) | Clearly states expiry, doesn't silently disappear, offers to talk to clinic about renewal per policy |
| Edge | An adverse event was recorded during a session | Patient-facing view shows only the doctor-approved, patient-facing outcome summary — not the internal severity/escalation clinical record (§10.3, §13.2 patient-facing vs internal split) |
| Must NOT | Must not display purchase price, discount %, or clinic margin anywhere in this view | Internal financial detail strictly excluded from patient package view (§10.4) |
| Must NOT | Must not allow the patient to mark a session as "completed" or adjust session count themselves | Session consumption is exclusively a staff-side atomic action tied to actual treatment closure (§10.1, §10.5 TRT-005) |

### Handoffs & cross-references
Session completion is driven entirely by Treatment Technician's "Complete Session" workflow (§10.1, §10.3), which atomically updates the timeline, package balance, stock, and billing — this screen simply reflects that state, never writes to it directly except via the "Book next session" booking action.

---

## B10. Invoices

### Real-life scenario
Priya wants a clear picture of what she's been billed for across visits, and whether anything is outstanding, before her next visit — without having to ask reception each time.

### Ideal flow
1. Chronological list of released invoices: date, branch, brief description (service names, not overly granular line-item clutter unless expanded), total amount, and status (**Paid / Partially Paid / Due**).
2. Tapping opens itemized detail: each billed item (consultation, treatment, product, package, discount, tax) with amounts — transparent, matching what reception/accountant recorded (§11.3).
3. **Due** invoices show the outstanding balance clearly and a "Pay at clinic" note — since there is no in-app payment gateway in MVP (§11.3, §13.1), the app is explicit about this rather than showing a broken/fake "Pay Now" button. It may offer "Get directions to pay at reception" or a callback request.
4. Each invoice links forward to its Receipt (once payment recorded) — see B11.
5. Internal cost/margin/staff commission data never appears (§11.3: "internal cost/margin hidden").

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient views a fully paid invoice | Correct itemization, status "Paid", linked receipt accessible |
| Happy | Patient views a partially paid invoice | Shows amount paid, amount due, and mode history without needing to guess |
| Edge | Invoice includes a discount applied by staff | Discount line shown transparently as part of itemization (approved discounts are legitimate patient-facing info, unlike margin) |
| Edge | Invoice has an active dispute/clarification flag from clinic side | Shown as "Under review — please contact reception" rather than a broken total | 
| Must NOT | Must not expose a working in-app "Pay Now" checkout button that processes payment | No payment gateway in MVP; app must not imply one exists (§11.3, §13.1) |
| Must NOT | Must not show internal cost basis, margin, or staff commission tied to any invoice line | Strictly patient-facing financial summary only (§11.3) |

### Handoffs & cross-references
Purely a read reflection of the Cashier/Accountant's Invoice module (§11.3, §14.1 Cashier dashboard). Any due-payment collection happens physically/manually at the branch and is then reflected back here once the accountant records it.

---

## B11. Receipts

### Real-life scenario
Priya's employer offers a wellness reimbursement and she needs an official receipt PDF for a treatment payment she made last month.

### Ideal flow
1. List of receipts, one per recorded payment (which may be a portion of a larger invoice if paid in parts), showing date, amount, mode (Cash/UPI/Card/Bank transfer/Other — §11.3), and linked invoice reference.
2. Tapping opens a clean, downloadable/shareable PDF receipt — clinic letterhead, invoice number, payment reference, mode, amount, date — generated the same way as Prescriptions/Reports (short-lived signed link).
3. If a refund was later issued against that payment, the receipt view reflects it transparently ("Refunded ₹X on [date], reference: ...") rather than leaving a stale, misleading receipt.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient downloads a receipt PDF for a past payment | Accurate, shareable, clinic-branded, opens via signed URL |
| Edge | Payment was split across two modes (part cash, part UPI) | Receipt clearly itemizes both modes | 
| Edge | Refund issued after receipt was generated | Receipt view updates to show the refund reference and amount, not a silently vanished record (§11.3: refund uses reversal, not overwrite) |
| Must NOT | Must not allow patient to edit or regenerate a receipt with different figures | Receipts are immutable financial records tied to the audited invoice/payment ledger (§11.3, §16.8) |

### Handoffs & cross-references
Direct reflection of Cashier's "Payments"/"Refunds" module (§11.3). Refund actions are staff-initiated with approval/audit trail; this screen never allows the patient to request a refund directly in-app — that goes through Support/Privacy request channel (B16) or a phone call, matching "loyalty points/refunds are staff-controlled" policy.

---

## B12. Offers

### Real-life scenario
Priya sees a seasonal offer banner and wants to check if it applies to her upcoming laser package renewal — while trusting that this is a marketing surface, not something hiding clinical judgment behind a discount.

### Ideal flow
1. Card grid/list of active offers: image, localized title/description, validity dates, which branch(es)/service(s) it applies to, and terms (expandable, not buried in tiny text).
2. Each offer has a single clear CTA: "Book with this offer" which pre-fills the Booking flow (B2) with the relevant service pre-selected and a note that the offer will be applied/verified at billing — the app never claims to auto-calculate or guarantee final discounted pricing (that's confirmed by staff at checkout, §11.3 approval rules).
3. Offers only show if the patient has actively consented to marketing communications viewing preference — even viewing the tab is fine (it's not "marketing communication," it's browsing), but if an offer is tied to a promotional campaign requiring outreach consent, that's respected separately (§12.4: marketing consent ≠ service consent).
4. Clear visual separation from clinical content — different color treatment, an "Offers" label always visible, never mixed into the Timeline or Prescriptions views.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient browses current offers and books using one | Booking pre-fills correctly; offer terms remain visible through to invoice review at the branch |
| Edge | Offer expires while patient is mid-booking | Clear "This offer has expired" message rather than silently dropping the discount at billing surprise | 
| Edge | Offer is branch-specific and patient's selected branch doesn't qualify | Offer either hidden for that branch context or clearly marked "Not available at [branch]" | 
| Must NOT | Offers screen must never reveal patient-specific clinical eligibility (e.g., must not say "You're eligible because of your acne diagnosis") | Offers are service/audience-level, never tied to disclosed individual diagnosis (§7.2 high-risk-rule extended) |
| Must NOT | Patient must not be able to redeem loyalty points or apply the offer discount directly in-app if clinic policy makes that a staff-verified action at billing | Offer "application" in-app is a request/intent only; final confirmation and any point redemption happens at reception/billing, per staff-controlled billing rules (§11.3 approval/discount controls) |

### Handoffs & cross-references
Offer content is authored/approved on the CRM/Marketing side (Owner/Admin "Offers" master, §12.5 Offer board). Booking-with-offer intents surface to reception exactly like a normal booking, with an offer reference tag reception/billing can see and apply correctly.

---

## B13. Notifications (Inbox)

### Real-life scenario
Priya gets a lock-screen notification saying only "You have a new update in your Aurah 360 app" — by design, generic — and opens the in-app inbox to see the actual, safe detail.

### Ideal flow
1. Chronological inbox list, each item with an icon by category: Appointment, Follow-up, Report Ready, Clinic Notice, Offer (separately labeled and visually distinct per §13.1).
2. Tapping any item deep-links straight to the relevant screen (an appointment reminder opens My Appointments detail; a report-ready notice opens the specific Report).
3. Unread/read state clearly tracked; a simple "Mark all as read" and per-item swipe-to-dismiss.
4. Filter chips: All / Appointments / Reports / Offers, so a patient can quickly find "did I get anything about my report" without scrolling.
5. Critically, the **content shown inside the app** can be slightly more specific than the lock-screen push text (since it's behind authentication), but still never includes full diagnosis, values, or images directly in the notification text — it says "Your report from [date] is now available" with a tap-through to view the actual released report inside its proper secure screen (§7.2 high-risk rule, §12.4 push/email generic policy).

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient taps an appointment-reminder notification | Deep-links directly to that appointment's detail in My Appointments |
| Happy | Patient taps a "report ready" notification | Deep-links to Reports screen, specific report highlighted |
| Edge | Notification received while app is closed, lock screen shows generic text | Lock screen text never contains diagnosis, report values, or treatment specifics — only generic "You have an update" or "Appointment reminder" (§13.2, §12.4) |
| Edge | User denied notification permission at OS level | In-app inbox still populates fully (server-side events aren't lost); a soft banner invites enabling push, but nothing is degraded functionally besides the lock-screen convenience |
| Edge | Offer notification arrives | Clearly tagged "Offer" in both the inbox icon/label and, where possible, distinguished tone from clinical reminders | 
| Edge | Notification for a dependent's appointment arrives while guardian is using their own profile context | Tapping it auto-switches context to the correct dependent with a visible banner, rather than silently showing dependent data under the guardian's own header | 
| Must NOT | Push/lock-screen notification text must never contain a diagnosis, lab value, medicine name, or clinical photo | Enforced by template design at the notification-template layer (§12.2, §12.4) — this is a hard platform-wide rule |
| Must NOT | Notification inbox must not show notifications belonging to another patient/dependent under the wrong context tab | Same per-profile scoping rule as Timeline (§13.2, §16.6) |

### Handoffs & cross-references
This is the patient-facing mirror of the notification/template engine (§12, NTF-001 to NTF-007). Delivery status (sent/delivered/read) feeds back into the CRM/notification-logs dashboard staff use (§14.1, §14.2 Communications reports) — a read receipt here is itself an auditable event (§16.8).

---

## B14. Profile

### Real-life scenario
Priya got married and changed her surname; she also wants to double check her registered mobile number and preferred language are correct, and understand exactly what personal information the clinic holds about her.

### Ideal flow
1. Top section: name (with an explicit distinction between **legal/registered name** used for MRN matching and an optional **preferred/display name**), age/DOB, registered mobile number (edit requires an OTP-verification step on the *new* number before it takes effect — never silently swapped), preferred language, profile photo (optional).
2. A clearly separated **Contact & Communication Preferences** section: alternate mobile, email (optional), address, and channel toggles (WhatsApp/SMS/push/voice) each tied to its actual consent purpose (transactional vs marketing vs voice) rather than one big on/off switch (§12.4, §16.3).
3. An **Emergency Contact** field, explicitly labeled "used only for clinical emergencies, never for marketing" (§5.1 rule: emergency contact is clinical-purpose only).
4. Any edit to identity-critical fields (legal name, DOB) doesn't apply instantly — it's submitted as a **change request** that reception verifies against ID/records before updating the master record, protecting MRN integrity, while less sensitive fields (preferred name, photo, language, alternate contact) apply immediately.
5. A visible, non-buried link to **Privacy & Data Requests** (B15) from within Profile, and a link to **Family Members** (dependents) management.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient updates preferred display name and photo | Applies instantly, no verification needed |
| Happy | Patient requests a legal name change (e.g., post-marriage) | Submitted as a verifiable change request; reception confirms against valid proof before MRN-linked record updates, patient sees "Pending clinic confirmation" status |
| Edge | Patient tries to change registered mobile number | New number must itself be OTP-verified before becoming the login credential; old number remains usable until new one is confirmed, preventing lockout | 
| Edge | Patient turns off marketing WhatsApp but keeps transactional appointment WhatsApp on | Both toggles work independently; turning off marketing doesn't affect appointment reminders and vice versa (§12.4) |
| Must NOT | Must not allow the patient to directly edit clinical fields (allergies, diagnosis, MRN) from Profile | Clinical data changes must go through a doctor/clinical workflow, not a self-service profile field (§8.3, §16.2 restricted clinical class) |
| Must NOT | Must not silently change the account's authentication mobile number without re-verification | Prevents account takeover / wrong-number lockouts (§16.6) |

### Handoffs & cross-references
Non-critical edits apply directly; identity-critical change requests appear in Reception's patient-record queue for verification (§5.1 duplicate/identity integrity rules extend naturally to self-service edits).

---

## B15. Family Members (Dependents)

### Real-life scenario
Aarav manages his own account plus his son Yash's (a minor) profile. He needs to add Yash formally, prove guardianship, and switch contexts cleanly whenever he's handling Yash's care versus his own.

### Ideal flow
1. A clear list: "You" at top, followed by each linked dependent with name, relationship, and a small "minor" badge if applicable.
2. **Add a family member** flow: enters the person's name, relationship (child/spouse/parent/other), DOB or age. If the dependent is *already* a patient in the clinic's records (has their own MRN from a prior visit), the app attempts to match and link — this link request is **not instantly granted**; it's submitted for reception verification of the guardian-dependent relationship (protecting against unauthorized access to someone else's record, §13.2/§16.6). If the dependent has never visited, this creates a "pending registration" that reception completes at next visit.
3. Once a dependent link is approved, switching into their context is a single, obvious tap from the same switcher used everywhere (Home, Book Appointment, Timeline, etc.) — never buried three menus deep, satisfying "dependent context always visible" (§13.2) as a *global* app-wide component, not just a Family Members feature.
4. Whenever viewing a dependent's context, every top-level screen shows a persistent, high-contrast banner: **"Viewing [Name]'s account"** so a guardian can never mistake whose appointment/report/bill they're looking at.
5. Minors aging past a configurable threshold (e.g., 18) trigger a graceful transition conversation — the app doesn't silently keep a father managing an adult child's medical data without a fresh consent/re-authorization step.
6. Removing a dependent link (e.g., after a divorce or care handover) is possible but requires confirmation and is itself an audited action.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Guardian adds a new minor dependent who has never visited the clinic | Pending registration created; guardian is told to bring the child at next visit for reception to complete registration/verification |
| Happy | Guardian links to a dependent who already has an MRN | Link request requires reception verification before granting app access; guardian sees "Verification pending" until approved |
| Happy | Guardian switches from own profile to dependent's profile | Instant, obvious context switch with a persistent banner across every subsequent screen | 
| Edge — wrong-person banner correctness | Guardian switches to Yash, then books an appointment, then switches back to self mid-flow | Each screen accurately reflects current context at all times; no stale banner from a previous context lingers after switching | 
| Edge | Two guardians (e.g., both parents) each have the app and are linked to the same dependent | Both can view/manage the dependent; any action (e.g., booking, cancelling) by either is visible to both to avoid duplicate/conflicting actions, and reflected in the shared record | 
| Edge | Dependent turns 18 | App prompts a graceful re-consent/handover flow rather than silently continuing indefinite guardian access | 
| Must NOT | Must not allow instant self-granted access to any existing patient record just by entering a name/DOB guess | Guardian-dependent linkage always requires clinic-side verification before data access is granted (§13.2, §16.6, §5.1 guardian authority verification) |
| Must NOT | Must not let a guardian view a dependent's data that predates the dependent turning 18 without appropriate ongoing authorization per clinic policy | Handled via the age-based re-consent step above |

### Handoffs & cross-references
New/unverified dependent links appear in **Reception's Patient List / Register Patient** queue for identity and guardian-authority verification (§5.1 PAT-005 guardian/dependent relationships). This is one of the highest-privacy-risk screens in the whole app and directly implements §13.2's mandatory "dependent context always visible" rule.

---

## B16. Privacy (Privacy & Support / Data Rights)

### Real-life scenario
Priya wants to know exactly what data the clinic holds on her, wants to revoke her marketing consent after getting too many promotional messages, and separately, Aarav wants to formally request a copy of Yash's records for a school health form.

### Ideal flow
1. A clean, plain-language hub — not a legal wall of text — with clearly separated, single-tap actions:
   - **View my consents** — a simple list of what Priya has agreed to (privacy notice, clinical photography, marketing, voice reminders, AI-assisted documentation, etc.) each with date, version, and a toggle/withdraw action where withdrawal is legally/operationally possible (§16.3 consent catalogue).
   - **Request a copy of my records** (data export/portability) — submits a formal, tracked request.
   - **Request a correction** — for factual errors in stored data.
   - **Request deletion / erasure** — submits a formal case; app is upfront that legally-required clinical/financial records may need to be retained even after such a request, explaining why rather than silently ignoring the request (§16.5).
   - **Raise a grievance/complaint** — free-text + category, separate from a support/FAQ chat.
   - **Manage notification preferences** shortcut (duplicates the toggle already in Profile, for discoverability).
2. Every request submitted here becomes a tracked case with a visible status: **Submitted → In Review → Resolved/Partially Fulfilled (with reason) → Closed** — visible to the patient in-app rather than only via email, so patients aren't left wondering (§16.5 steps 3–7).
3. Identity verification for sensitive requests (e.g., full data export) may require a fresh OTP step-up, consistent with §16.6 step-up rules for sensitive actions.
4. A basic **Support/FAQ + feedback/NPS** entry point sits alongside (§13.1), kept clearly distinct from formal legal/privacy requests so patients pick the right path for their need.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient withdraws marketing consent | Toggled off immediately; withdrawal history recorded; transactional/appointment messages remain unaffected (§16.3) |
| Happy | Patient submits a data export request | Case created with tracked status; patient later receives an encrypted, expiry-limited download link once fulfilled (§16.5 step 6) |
| Edge | Patient requests full erasure of their record | App clearly explains that certain signed clinical/financial/audit records must be retained per legal/clinical-integrity policy, and shows what will vs won't be removed, rather than silently declining or silently deleting protected records (§16.5 step 5 & 7) |
| Edge | Guardian submits a records-export request on behalf of a minor dependent | Case correctly tracks the requesting guardian and the subject dependent separately; verification of guardian authority is enforced (§5.1, §16.5) |
| Edge | Patient submits a grievance about a billing dispute | Routed as a grievance case distinct from a generic support FAQ ticket, with its own status tracking | 
| Must NOT | Must not allow "delete my account" to silently wipe signed clinical, financial, or audit records that are under legal/retention hold | Enforced retention exceptions are documented and shown to the patient as part of the case resolution, never silently ignored or silently granted in full where unlawful (§16.5 step 5) |
| Must NOT | Must not process a sensitive data-rights request without adequately verifying the requester's identity/authority | Step-up authentication required before fulfilling exports or erasure requests (§16.6) |

### Handoffs & cross-references
Every request here creates a formal case visible to an authorized **Privacy/Clinic Lead** role (§16.5), fully separate from ordinary clinical/reception workflows, with its own audit trail (§16.8 "Data administration" event family: export, retention job, deletion/anonymization, privacy-request outcome).

---

## B17. Settings

### Real-life scenario
Priya wants to turn on Face ID app-lock after reading about a friend's phone being briefly lost, manage which devices are logged in, and later needs to log out of an old phone she sold.

### Ideal flow
1. **App Lock** section: toggle biometric (Face ID/fingerprint) or PIN lock, with a fallback PIN always available if biometrics fail; clarified copy: "Your biometric data stays on your device — we never receive it" (§16.3: "biometric secret remains on device platform").
2. **Notification Settings** — same granular, purpose-separated toggles as referenced in Profile (transactional/appointment vs marketing vs voice vs push categories), consistent single source of truth rather than duplicated conflicting settings screens.
3. **Language** — same instant-switch control described in A4, also reachable here for discoverability.
4. **Devices & Sessions** — a list of currently logged-in devices/sessions with last-active time and a **"Log out this device"** / **"Log out of all other devices"** action (§16.6 session/device management) — critical for the sold-phone scenario.
5. **About & Legal** — app version, terms, privacy notice (full text), and links back to the Privacy hub (B16) rather than duplicating that logic here.
6. **Log out** as a clearly available, unambiguous action (not hidden), with a simple confirmation.

### Test cases

| Type | Case | Expected result |
|---|---|---|
| Happy | Patient enables Face ID app-lock | Subsequent app opens require Face ID/PIN fallback; biometric template never leaves the device |
| Happy | Patient logs out of an old, sold phone remotely from a new device's session list | That old session's tokens are immediately revoked server-side (§16.6 "immediate revocation") |
| Edge | Biometric hardware fails/unavailable mid-use | Falls back cleanly to PIN entry, never locks the user out entirely |
| Edge | Patient changes language here vs in Profile/A4 | Fully consistent — one underlying setting, no conflicting state between entry points |
| Edge | Patient logs out while a booking draft is unsaved | Clear warning before logging out that unsaved changes will be lost, consistent with §17.5 "safe navigation warning" pattern | 
| Must NOT | Must not store or transmit raw biometric data to any server | Strictly device-local biometric authentication only |
| Must NOT | Must not allow session/device list to reveal another patient's device/session data (e.g., on a shared clinic kiosk scenario) | Session list is strictly scoped to the authenticated account only |

### Handoffs & cross-references
Device/session actions here map directly to the same session infrastructure staff-side admins rely on for security incident response (§16.6 Termination: "revoke sessions/tokens" applies symmetrically to patient-initiated logout).

---

# Appendix — Cross-Screen Rules That Apply Everywhere

These are not single-screen concerns; they are constraints the whole app must honor on every relevant screen, restated here for traceability:

| Rule | Source | Applies to |
|---|---|---|
| Dependent context always visible via a persistent, unambiguous banner/switcher | §13.2 | Home, Book Appointment, My Appointments, Reschedule, Cancel, Timeline, Prescriptions, Reports, Treatments, Invoices, Receipts, Notifications, Family Members |
| Only doctor/clinic-released content is patient-visible; raw internal/staff-only notes never surface | §13.2, §8.3 | Timeline, Prescriptions, Reports, Treatments |
| Unverified OCR/AI extraction is never shown as a verified result | §13.2, §7.1 | Reports, Timeline |
| Clinical photos default hidden; explicit release required for any patient-facing view | §7.2, §13.2 | Timeline, Treatments (not explicitly listed as a standalone screen in this inventory, but referenced wherever before/after content might surface) |
| Push/lock-screen/SMS/WhatsApp text stays generic — no diagnosis, values, medicine names, or photos | §7.2, §12.4, §13.2 | Notifications, and any external channel triggered by in-app actions |
| OTP-only patient authentication with rate limiting, anti-enumeration, and biometric/PIN app-lock option | §13.2, §16.6 | Login, OTP, Settings |
| No payment gateway in MVP; billing screens show status/history only, payment happens at the branch | §11.3, §13.1 | Invoices, Receipts |
| No in-app self-redemption of loyalty points/staff-controlled discounts; offer "booking" is only an intent, confirmed by staff at billing | §11.3, §12.5 | Offers, Invoices |
| Guardian-dependent linkage requires clinic-side verification, never instant self-grant | §5.1, §13.2, §16.6 | Family Members, and by extension every screen with a dependent switcher |
| Deny-by-default server-side authorization on every read/write — no reliance on client-side filtering as a security boundary | §16.6 | All screens |
| No restricted/clinical data in analytics, crash logs, or AI payloads | §13.3 APP-008, §16.7, §9.2 | All screens, especially Timeline, Reports, Prescriptions |
| Offline/poor-network behavior: cached last-known state with visible "last synced" indicator rather than blank/frozen screens; writes queue safely and use idempotency to avoid duplicates | §6.2, §NFR-004, §NFR-008 | Home, Book Appointment, Reschedule, Cancel, Notifications |
| All user-visible text externalized/localized (English/Gujarati/Hindi); no clipped or broken layouts from longer translated strings | §17.9, §APP-007 | All screens |

---

*End of document. This specification intentionally redesigns interaction order and screen composition for maximum patient/guardian usability; it does not describe the current mobile app's existing implementation. All business rules referenced trace back to Aurah 360 ClinicOS PRD v1.0 (04 August 2026) and the Role-Based UI Screens inventory.*
