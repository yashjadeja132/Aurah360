# Final Scope Reconciliation — PRD vs Approved Project Scope

**Date:** 2026-08-06  
**Sources reviewed (evidence):**

| Source | Path / evidence |
|---|---|
| Original PRD | `aurah_prd.md` v1.0 (04 Aug 2026) |
| ADR | `docs/adr/001-stack-decision.md` (Accepted) |
| Architecture | `docs/architecture/overview.md`, `docs/SYSTEM_ARCHITECTURE.md` |
| README | Root `README.md` — single-clinic, Modules 1–19 |
| Module register | `docs/MODULES.md` — Modules 1–18 Approved, 19 Complete |
| Hardening report | `docs/production-readiness-report.md` |
| Prior audits | `docs/requirements-traceability-report.md`, `docs/final-gap-analysis.md`, `docs/final-project-review.md` |
| Code markers | `NotificationService` mock adapters; AI placeholders; storage placeholders |

**Method:** Reclassify every prior RTM finding using **documented scope decisions first**. A PRD line is **not** “Missing” if ADR/README/module brief intentionally replaced, deferred, or mocked it.

---

## 1. Approved Project Scope (binding contract for this repo)

The approved delivery for **Aurah 360 ClinicOS v1** is defined as:

### 1.1 In scope (must exist)

| # | Decision | Evidence |
|---|---|---|
| 1 | **Single clinic** (Aurah 360 only), **multi-branch**, **not** multi-tenant SaaS | README; `architecture/overview.md` |
| 2 | **Modules 1–19** as the implementation program | `MODULES.md`; README module table |
| 3 | Staff **web** ClinicOS (React/Vite) + REST API | ADR-001; README |
| 4 | Patient self-service via **web portal** (`/portal`, `/api/v1/patient`) | Module 17 approved |
| 5 | Core clinical–commercial workflow | Modules 4–13 approved |
| 6 | CRM + notification **framework** (templates, queue, audit) | Modules 14–15 approved |
| 7 | Reports + analytics dashboards | Modules 16 & 18 approved |
| 8 | Production hardening (security middleware, health, Docker, docs) | Module 19 complete |

### 1.2 Explicitly replaced / deferred (not “Missing”)

| PRD expectation | Approved treatment | Status class | Evidence |
|---|---|---|---|
| NestJS + PostgreSQL + Prisma | Express + MongoDB + Mongoose | 🔵 Replaced | ADR-001 |
| Next.js App Router + TypeScript | Vite + React + JavaScript | 🔵 Replaced | ADR-001 |
| React Native / Expo patient app | React **web** patient portal | 🔵 Replaced | Module 17; README; prod report “No mobile native apps” |
| Organization / multi-org SaaS isolation | Branch-scoped single clinic (no `tenantId`) | 🔵 Replaced | `architecture/overview.md` |
| Live WhatsApp / DLT SMS / push vendors | Provider-neutral adapters + **mock** providers for v1 | 🔵 Replaced (v1) | `NotificationService` comment: “mock provider adapters only” |
| AI clinical copilot (live) | Placeholder interfaces only; **do not implement AI yet** | ⚪ Deferred | Module 18 instruction; `ConsultationAiInterface`; `AiReportPlaceholderService` |
| Payment gateway | MVP non-goal | ⚪ Out of scope | PRD §2.3; architecture non-goals |
| S3 private object storage | Local storage now; S3/Azure/GCS placeholders | 🔵 Replaced (interim) | `StorageFactory`; overview “Local now; S3 later” |
| ABDM / FHIR / teleconsult / kiosks | Phase 3 | ⚪ Out of scope | PRD §2.3 |
| Image-diagnosis AI | Phase-gated | ⚪ Out of scope | PRD §9.3 |
| Autonomous diagnosis | Non-goal | ⚪ Out of scope | PRD §2.3 |
| FullCalendar Premium resource timeline | Custom calendar UI | 🔵 Replaced | Custom `AppointmentCalendarPage` |
| PRD monorepo `apps/web|api|mobile` | `frontend/` + `backend/` monorepo | 🔵 Replaced | ADR + repo layout |

### 1.3 Still required under approved scope

These remain **in-scope gaps** (not waived by ADR). They either block safe client delivery or leave an approved module functionally thin:

| Item | Class | Why still required |
|---|---|---|
| Auth-gated / private file downloads (stop public `/uploads` for PHI) | 🔴 / delivery P0 | Called out in Module 19 production warnings |
| Production env checklist (secrets, `COOKIE_SECURE`, Swagger off, seed password rotation) | 🔴 / ops P0 | Module 19 deployment checklist |
| Operational backup (`mongodump`) wired | 🟡 | Backup script is placeholder; BCM needed for delivery |
| Patient merge (non-destructive) | 🟡 | Route/service exist as placeholder inside Patient module |
| Billing refund (real, not placeholder) | 🟡 | Placeholder in Billing module |
| Cash close | 🔴 | Not implemented; finance ops for clinic day-end |
| Structured handoff note (beyond free-text) | 🟡 | Reception approved with `receptionNotes` only — depth gap |
| MFA for Owner/Admin | 🟡 → future hardening | Listed Module 19 future; PRD P0 but not in Modules 1–19 acceptance as delivered |
| Rooms/devices collision engine | 🟡 → roadmap | Not delivered in Modules 1–19; multi-branch resource depth |
| Appointment Pending Approval states | 🟡 → roadmap | Not in current appointment enum |
| Travel buffer | 🟡 → roadmap | Not implemented |
| GU/HI localization | 🟡 → roadmap | Not in Modules 1–19 deliverables |
| Real WhatsApp/SMS (beyond mocks) | ⚪→roadmap | Mocks are approved for v1; live vendors = Phase 2 |

---

## 2. Status legend (this reconciliation)

| Symbol | Meaning |
|---|---|
| ✅ Implemented | Exists and usable under approved scope |
| 🟡 Partial | In approved scope, but incomplete depth |
| 🔴 Missing | Required for approved-scope client delivery / safe production, not done |
| ⚪ Intentionally out of scope | Phase 2/3, PRD non-goal, or explicit deferral |
| 🔵 Replaced by approved alternative | PRD item satisfied by a documented different approach |

---

## 3. Reclassification summary (from prior 188 RTM items)

Prior RTM treated many ADR/phase items as 🔴 Missing. After reconciliation:

| Class | Count | Notes |
|---|---:|---|
| ✅ Implemented | **58** | +6 vs prior (some “partial stack” items now ✅ under ADR) |
| 🟡 Partial | **72** | Depth gaps inside Modules 1–19 |
| 🔴 Missing (approved-scope required) | **14** | Delivery/security/ops + a few clinic-ops holes |
| ⚪ Intentionally out of scope | **26** | Phase 2/3, non-goals, deferred AI live release |
| 🔵 Replaced by ADR / approved alternative | **18** | Stack, tenancy, Expo→portal, mocks, local storage |
| **Total tracked** | **188** | Same population as prior RTM |

### 3.1 Examples of reclassification (was → now)

| Requirement | Prior label | Reconciled | Reason |
|---|---|---|---|
| NestJS / Postgres / Next.js | Often scored as gap | 🔵 | ADR-001 Accepted |
| Expo patient app | 🔴 Missing | 🔵 | Module 17 web portal approved |
| Organization / tenantId | 🔴 Missing | 🔵 | Single-clinic architecture docs |
| Live WhatsApp Business | 🔴/🟡 | 🔵 (v1) / ⚪ (live) | Mock adapters approved for Module 15 |
| AI gateway live | 🔴 Missing | ⚪ | Explicitly deferred Module 18 |
| Payment gateway | — | ⚪ | PRD non-goal |
| S3 + malware | 🔴/🟡 | 🔵 interim + 🟡 hardening | Local + placeholders documented |
| Public `/uploads` | Security issue | 🔴 | Still required before PHI production |
| Cash close | 🔴 | 🔴 | Still required for clinic finance day-end under approved billing scope |
| Rooms/devices engine | 🔴 | 🟡 roadmap / not in M1–19 | Not waived forever; not Module 1–19 acceptance item |

---

## 4. Recalculated completion

### 4.1 Vs Original PRD (all phases, literal)

| Metric | Value |
|---|---|
| Strict complete (✅ only) | **58 / 188 = 31%** |
| Complete + replaced (✅ + 🔵) | **76 / 188 = 40%** |
| Usable progress (✅ + 🔵 + 🟡) | **148 / 188 = 79%** |
| Unresolved vs full PRD (🔴 + remaining Phase work in ⚪) | See roadmap |

**Original PRD completion (strict): ~31%**  
**Original PRD “addressed somehow” (✅+🔵+🟡): ~79%**

### 4.2 Vs Approved Project Scope (Modules 1–19 + ADR)

**Denominator** = items that are not ⚪ (out of scope / deferred phase):

| Class | Count |
|---|---:|
| ✅ Implemented | 58 |
| 🔵 Replaced (counts as satisfied) | 18 |
| 🟡 Partial | 72 |
| 🔴 Missing (still required) | 14 |
| **In-scope total** | **162** |

| Metric | Formula | Value |
|---|---|---|
| **Satisfied (✅ + 🔵)** | 76 / 162 | **47%** fully satisfied |
| **Satisfied + partial credit** | (76 + 0.5×72) / 162 | **~69%** weighted |
| **Module backbone complete** | Workflow + RBAC + M1–19 surfaces exist | **~90%** |
| **Client-delivery ready (approved scope)** | After P0 list below | **~75–80%** today; **~90%+** after P0 |

Interpretation: the **approved module program was largely delivered**. Remaining work is **depth, finance ops, and production safety**, not “rebuild the product.”

---

## 5. Remaining work (must still implement for approved-scope client delivery)

### P0 — before internet / PHI production

1. **Private file access** — remove world-readable `/uploads` for clinical docs/photos; auth-gated or signed URLs  
2. **Production secrets checklist** — strong JWTs, `COOKIE_SECURE=true`, `ENABLE_SWAGGER=false`, rotate seed passwords  
3. **Backup procedure** — real `mongodump` schedule + tested restore (scripts today are placeholders)  
4. **Confirm notification stance in writing** — “mocks for pilot” OR wire one real channel (SMS/WhatsApp)

### P1 — before full clinic day-ops acceptance

5. **Cash close** (opening/expected/counted/variance)  
6. **Refund** with approval/reason (replace placeholder)  
7. **Patient merge review** (replace not-implemented service)  
8. **Structured reception handoff** (category + acknowledgment) — if client requires PRD handoff acceptance  
9. **PDF export** real renderer (or accept CSV/XLSX only in acceptance)  

### P2 — quality / roadmap (approved backlog, not blockers for limited pilot)

10. MFA for Owner/Admin  
11. Rooms/devices scheduling  
12. Travel buffer + Pending Approval appointments  
13. Localization GU/HI  
14. Live WhatsApp/DLT/voice  
15. S3 storage + malware scan  
16. Live AI (only with governance)  

---

## 6. Deferred work (intentionally not in v1)

| Work | Deferral basis |
|---|---|
| Expo Android/iOS app | Replaced by web portal for v1; PRD Phase 2 |
| Live AI clinical copilot | Module 18 + Phase 2 |
| Multi-organization SaaS | Architecture non-goal |
| ABDM/FHIR, teleconsult, lab, kiosks | PRD Phase 3 |
| Payment gateway | PRD MVP non-goal |
| Image AI diagnosis | PRD §9.3 phase gate |
| Nest/Postgres/Next rewrite | ADR-001 permanent for this product line |

---

## 7. Future roadmap (aligned)

```text
Now (v1 delivery hardening)
  → P0 security/ops + P1 finance/handoff/merge

Phase 2 (PRD)
  → Live WhatsApp/DLT/push, offer board, Expo app (optional if portal sufficient),
    AI gateway with governance, deeper photo comparison

Phase 3 (PRD)
  → ABDM/FHIR, image-assist AI, teleconsult, multi-org SaaS (if ever required)
```

---

## 8. Production readiness (approved scope)

| Gate | Status | Evidence |
|---|---|---|
| Functional Modules 1–19 | **Largely complete** | MODULES.md Approved; smoke regression green |
| Stack / tenancy | **Accepted** | ADR-001; single-clinic docs |
| Security for PHI internet exposure | **Not ready** | Public uploads; MFA absent; checklist open |
| Communications | **Pilot-ready with mocks**; **not** carrier-ready | Mock providers |
| Ops backup/DR | **Procedure documented; automation placeholder** | BACKUP/RESTORE guides |
| **Approved-scope production readiness** | **~78%** (matches Module 19 report) → **~90% after P0** | |

**Limited internal pilot (staff web, mock SMS, no public PHI files):** feasible after seed password rotation + Swagger/CORS lockdown.  
**Public / multi-branch PHI production:** not ready until P0 file security + backup + written comms decision.

---

## 9. Client acceptance readiness

| Acceptance type | Ready? | Condition |
|---|---|---|
| Acceptance vs **original full PRD** | **No** | Many Phase 2/3 and depth items unmet |
| Acceptance vs **approved ClinicOS v1 scope** (Modules 1–19 + ADR) | **Conditional Yes** | Client signs scope waiver + completes P0 checklist |
| UAT against PRD §20.3 all 36 scenarios | **No** | Expect ~30–40% clear passes without waiver |
| UAT against **workflow smoke** (book→treat→bill→portal) | **Yes** | `smoke:regression` evidence |

**Recommended client sign-off packet:**

1. This reconciliation document  
2. ADR-001  
3. MODULES.md (1–19 approved)  
4. Production checklist completion evidence  
5. Explicit waiver: Expo, live AI, live WhatsApp, multi-org SaaS, payment gateway  

---

## 10. Final verdict (answer separately)

### 1. Is the project complete according to the ORIGINAL PRD?

**No.**

**Evidence:** Original PRD includes multi-org SaaS-ready isolation, Nest/Postgres/Next/Expo, live AI, live WhatsApp/DLT/voice, room/device resource engine, native app, ABDM Phase 3, FullCalendar Premium resources, versioned consent catalogue, MFA/break-glass, cash close, etc. Strict ✅ coverage is **~31%**; even counting replacements only reaches **~40%** of literal PRD lines. Prior gap analysis and RTM remain valid **against the unamended PRD**.

### 2. Is the project complete according to the APPROVED PROJECT SCOPE?

**Mostly yes — with a short delivery backlog.**

**Evidence:**

- Modules **1–18 Approved** and **19 Complete** (`MODULES.md`, README).  
- ADR-001 stack and single-clinic architecture are **Accepted/documented**.  
- Module 17 web portal **replaces** Expo for v1.  
- Module 15 **mocks** are explicit.  
- Module 18 **AI deferred** by instruction.  
- End-to-end workflow verified in code + `smoke:regression`.  

**Not 100%:** P0 security (public uploads), finance day-end (cash close / refund), patient merge placeholder, and optional depth items remain. Weighted approved-scope completion **~69%** fully/partial; **backbone ~90%**.

### 3. What must still be implemented before client delivery?

**Minimum for “Approved Scope — Client Delivery”:**

| Priority | Item | Evidence of gap |
|---|---|---|
| P0 | Private/authenticated file serving for uploads | `app.js` static `/uploads`; Module 19 warning |
| P0 | Production env + secret/password rotation | Module 19 checklist |
| P0 | Real backup + restore rehearsal | `backup.placeholder.js` |
| P0 | Written acceptance of mock notifications **or** one live channel | `providers.js` mocks |
| P1 | Cash close | No CashClose implementation found |
| P1 | Real refund flow | `BillingService.refundPlaceholder` |
| P1 | Patient merge (or remove from UI/API until ready) | `PatientMergeService` not implemented |
| P1 | Agree handoff depth (keep free-text **or** build structured note) | `receptionNotes` only |

**Not required for approved-scope delivery (defer with waiver):** Expo app, live AI, multi-org SaaS, payment gateway, ABDM/FHIR, Nest/Postgres rewrite, live WhatsApp/DLT (if mocks accepted), GU/HI (if English pilot accepted).

---

## 11. Conclusion

| Question | Answer |
|---|---|
| Original PRD complete? | **No (~31% strict)** |
| Approved project scope complete? | **Mostly yes (~90% backbone; ~75–80% delivery-ready)** |
| Block client delivery? | **Only P0/P1 list above** — not a rebuild |

This document should be treated as the **scope baseline** for any further UAT. Future audits must score against **Approved Project Scope**, and use Original PRD only for roadmap / Phase 2–3 planning.

---

*No application code was modified for this reconciliation.*
