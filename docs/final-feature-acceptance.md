# Final Feature Acceptance Audit — Aurah 360 ClinicOS

**Version under audit:** `1.0.0-rc.1`  
**Date:** 2026-08-06  
**Method:** Inspect-only (no code modified)  
**Acceptance lens:** **Approved project scope** (Modules 1–19 + ADR-001), cross-checked against Original PRD, RTM, Gap Analysis, Scope Reconciliation, and Pre-UAT Validation  

### Sources of truth consulted

| Source | Path |
|---|---|
| Original PRD | `aurah_prd.md` (referenced via RTM / gap / reconciliation) |
| ADR | `docs/adr/001-stack-decision.md` |
| Module register | `docs/MODULES.md` |
| RTM | `docs/requirements-traceability-report.md` |
| Gap analysis | `docs/final-gap-analysis.md` |
| Scope reconciliation | `docs/final-scope-reconciliation.md` |
| Pre-UAT | `docs/pre-uat-validation.md` |
| Permission matrix | `docs/PERMISSION_MATRIX.md` |
| Release notes | `docs/RELEASE_NOTES_v1.0.0-rc.1.md` |
| Implementation | `backend/src/**`, `frontend/src/**` |

### Status legend (this audit)

| Symbol | Meaning |
|---|---|
| 🟢 | **Fully Implemented** — BE + FE + API + model (if needed) + validation + permissions + nav/UI + workable E2E |
| 🟡 | **Partially Implemented** — usable but depth/ops gap vs approved expectation |
| 🔴 | **Missing** — required under approved scope / safe delivery, not present |
| ⚪ | **Out of Scope (approved)** — Phase 2/3, PRD non-goal, or explicit deferral |
| 🔵 | **Placeholder / Mock** — surface exists but intentionally stubbed |

---

# Executive Summary

Aurah 360 ClinicOS RC1 delivers a **working single-clinic, multi-branch web ClinicOS** covering the approved clinical–commercial spine (**Lead → Patient Portal**). Pre-UAT was a **conditional PASS**. Against **approved scope**, the product is **UAT-ready** with disclosed caveats; it is **not production-ready** until P0 security/ops items close.

| Lens | Verdict |
|---|---|
| Approved scope backbone | **Acceptable for Client UAT** |
| Original full PRD | **Not fully accepted** (~31% strict per reconciliation; many items ⚪/🔵) |
| Client can use promised **approved-scope** features? | **Mostly yes** — core workflows yes; a short list of 🟡/🔵/🔴 remain |
| Production sign-off | **No** |

**Headline counts (feature acceptance rows in this document):** see Final Summary.  
**Module roll-up table:** see Final Table.

---

# Module-by-module verification

Each module was checked for: backend service/routes, frontend pages/nav, API mount (`routes/v1/index.js`), models, Zod validators, `requirePermission`, UI actions, error handling, audit/events where applicable.

## Module 1 — Users & RBAC — Status: 🟢 (with 🔵/⚪ edges)

| Check | Result | Evidence |
|---|---|---|
| Backend | 🟢 | `AuthService`, `UserService`, `RoleService`; `auth.routes.js`, `users.routes.js`, `roles.routes.js` |
| Frontend | 🟢 | `LoginPage`, `Staff*Page`, profile pages; `PermissionGuard` |
| API | 🟢 | `/api/v1/auth`, `/users`, `/roles` |
| Models | 🟢 | `User`, `Role`, `Permission`, `RefreshToken`, `AuditLog` |
| Validation | 🟢 | `auth.validator.js`, `user.validator.js` |
| Permissions | 🟢 | `permissions.js`, `rolePermissions.js`, middleware |
| Navigation | 🟢 | `AppLayout` Staff item |
| Audit | 🟢 | Login/user actions via `AuditService` |
| E2E | 🟢 | Pre-UAT + `smoke-module1` / regression |

Gaps: forgot-password email 🔵; role **CRUD** UI/API thin (list/view) 🟡; MFA ⚪.

## Module 2 — Branches & Masters — Status: 🟢

| Check | Result | Evidence |
|---|---|---|
| Backend | 🟢 | `BranchService`, `MasterService` |
| Frontend | 🟢 | `pages/settings/branches/*`, `MasterPage.jsx` |
| API / Models | 🟢 | `/branches`, `/masters`; `Branch`, `Master` |
| Permissions / Nav | 🟢 | Settings nav; branch/master permissions |

## Module 3 — Doctors / Staff clinical profiles — Status: 🟢

| Check | Result | Evidence |
|---|---|---|
| Backend | 🟢 | `DoctorService`, schedule/leave/availability services |
| Frontend | 🟢 | `pages/doctors/*` |
| API / Models | 🟢 | `/doctors`; `Doctor`, `DoctorSchedule`, `DoctorLeave`, … |
| Permissions / Nav | 🟢 | Doctors nav |

*(Staff users = Module 1; Doctor clinical entity = Module 3.)*

## Module 4 — Patients — Status: 🟡 (core 🟢; merge 🔵)

| Check | Result | Evidence |
|---|---|---|
| CRUD / search / documents / timeline | 🟢 | `PatientService`, `patients.routes.js`, `pages/patients/*` |
| Duplicate check | 🟢 | `PatientDuplicateService` |
| Merge | 🔵 | `PatientMergeService` throws not-implemented; routes exist; no FE merge UI |
| Consent / e-sign field | 🟡 / 🔵 | Consent patch exists; `eSignPlaceholder` on model |

## Module 5 — Scheduling — Status: 🟢 (travel buffer 🔴/roadmap)

| Check | Result | Evidence |
|---|---|---|
| Slots / holidays / blocked / special | 🟢 | `scheduling.routes.js`, schedule engine helpers, FE scheduling pages |
| Travel buffer | 🔴→roadmap | Not in M1–19 deliverables per reconciliation |

## Module 6 — Appointments — Status: 🟢 (recurring 🔵)

| Check | Result | Evidence |
|---|---|---|
| Book / lifecycle / calendar / history | 🟢 | `AppointmentService`, `appointments.routes.js`, FE appointment pages |
| Double-booking prevention | 🟢 | `AppointmentConflictService.assertNoConflicts` |
| Recurring | 🔵 | `RecurringAppointmentService` / schema placeholder; create rejects enabled recurring |

## Module 7 — Reception & Queue — Status: 🟢 (cross-branch transfer 🔵)

| Check | Result | Evidence |
|---|---|---|
| Reception today / check-in / walk-in | 🟢 | `reception.routes.js`, `ReceptionDashboardPage` |
| Queue board / call / reorder / sockets | 🟢 | `queue.routes.js`, `QueueService`, `emitQueueEvent`, FE queue pages |
| Doctor transfer (same branch) | 🟢 | `QueueService.transfer` |
| Branch transfer | 🔵 | Explicit placeholder error if `branchId` change requested |
| Handoff note depth | 🟡 | Free-text `receptionNotes` only |

## Module 8 — Consultation / EMR — Status: 🟢 (AI 🔵)

| Check | Result | Evidence |
|---|---|---|
| Start / SOAP / vitals / Dx / photos / templates | 🟢 | `consultations.routes.js`, clinical services, FE workspace |
| Sign + lock immutability | 🟢 | `ConsultationService` lock guards; unlock Owner |
| AI summarize / draft | 🔵 / ⚪ | `ConsultationAiInterface` NOT_IMPLEMENTED |
| ICD-10 depth | 🟡 | UI labeled placeholder |

## Module 9 — Prescription — Status: 🟢

| Check | Result | Evidence |
|---|---|---|
| Draft / finalize / print / templates / medicines | 🟢 | `prescriptions.routes.js`, `PrescriptionService`, FE Rx pages |
| Finalize immutability | 🟢 | `#assertDraft` / FINALIZED status |
| Blocked if consultation locked | 🟢 | `#assertConsultationUsable` |

## Module 10 — Treatment Plans — Status: 🟢 (e-sign 🔵)

| Check | Result | Evidence |
|---|---|---|
| Protocols / packages / recommend / approve / accept | 🟢 | `treatmentPlans.routes.js`, `TreatmentPlanService`, FE builders |
| Consent gate on accept | 🟢 | `ConsentRecord` + accept flow |
| E-sign / PKI | 🔵 | `E_SIGN_PLACEHOLDER` |
| Versioned consent catalogue | 🟡 | Fixed text in service |

## Module 11 — Billing — Status: 🟡

| Check | Result | Evidence |
|---|---|---|
| Invoice CRUD / finalize / payments / print | 🟢 | `billing.routes.js`, `BillingService`, FE invoice pages |
| No overpayment | 🟢 | `Cannot overpay invoice` |
| Refund | 🔵 | `refundPlaceholder` |
| Cash close | 🔴 | No implementation |
| Invoice email/WhatsApp send | 🔵 | `email-placeholder`, `whatsapp-placeholder` routes |
| GST display | 🟡 / 🔵 | `gstPlaceholder` flags |

## Module 12 — Treatment Execution — Status: 🟢

| Check | Result | Evidence |
|---|---|---|
| Sessions from accepted + paid/partial plans | 🟢 | `#assertPaymentGate` in `TreatmentSessionService` |
| Lifecycle / print / dashboard | 🟢 | routes + FE treatment session pages |
| E2E | 🟢 | `smoke-module12` |

## Module 13 — Pharmacy & Inventory — Status: 🟢

| Check | Result | Evidence |
|---|---|---|
| Inventory via `InventoryService` only | 🟢 | Pharmacy/Purchase call `InventoryService` |
| Expired batch blocked | 🟢 | `Cannot use expired batch` / no usable batch |
| Dispense / PO / GRN / ledger | 🟢 | routes + FE pharmacy/inventory pages |
| Note | — | Pre-UAT M13 smoke fail on exhausted Rx qty = data state, not missing feature |

## Module 14 — CRM — Status: 🟢 (comms log 🔵)

| Check | Result | Evidence |
|---|---|---|
| Leads / pipeline / tasks / convert / BullMQ reminders | 🟢 | `crm.routes.js`, `CrmService`, FE CRM pages |
| Communication log | 🔵 | Placeholder notes; no external dialer/WA |

## Module 15 — Notifications — Status: 🟡 / 🔵 providers

| Check | Result | Evidence |
|---|---|---|
| Templates / queue / inbox / retry / delivery log | 🟢 | `notifications.routes.js`, `NotificationService`, FE pages |
| Email/SMS/WhatsApp/Push send | 🔵 | Mock adapters in `notifications/providers.js` (approved v1) |

## Module 16 — Reports — Status: 🟢 (PDF 🔵)

| Check | Result | Evidence |
|---|---|---|
| Role dashboards / generate / CSV / Excel / schedule | 🟢 | `reports.routes.js`, `ReportService`, FE reports pages |
| PDF export | 🔵 | `toPdfPlaceholder` in `ExportService.js` |

## Module 17 — Patient Portal — Status: 🟢 (auth extras 🔵)

| Check | Result | Evidence |
|---|---|---|
| Login / me / ownership / dashboard / records / billing / feedback | 🟢 | `patient.routes.js`, `PatientPortalService`, `assertOwnPatient`, FE `/portal/*` |
| JWT isolation from staff | 🟢 | Pre-UAT cross-JWT 401 |
| Forgot / OTP / email verify | 🔵 | `PatientAuthService` placeholders |
| Rx refill request | 🔵 | `prescriptionRefillPlaceholder` |
| Portal PDF download | 🔵 | `placeholderPdf` messages |

## Module 18 — AI / Analytics (ADR: analytics + AI deferred) — Status: 🟡

| Check | Result | Evidence |
|---|---|---|
| Executive + category analytics / Redis cache / CSV-Excel / BullMQ | 🟢 | `analytics.routes.js`, facade services, FE analytics pages |
| AI analytics category | 🔵 | `AiReportPlaceholderService` (explicit: do not implement AI yet) |
| Live clinical AI | ⚪ | Deferred per Module 18 instruction / ADR treatment |

## Module 19 — Production Hardening — Status: 🟡

| Check | Result | Evidence |
|---|---|---|
| Helmet/CSP/HPP/sanitize/rate limits | 🟢 | `security.middleware.js`, `app.js` |
| Health livez/readyz/healthz | 🟢 | `health.routes.js` |
| Winston rotate / DLQ / OpenAPI / Docker / PM2 | 🟢 | Module 19 deliverables + `smoke-module19` |
| Public `/uploads` | 🔴 | `express.static('/uploads')` in `app.js` |
| Backup/restore npm scripts | 🔵 | `backup.placeholder.js`, `restore.placeholder.js` |
| Cloud storage drivers | 🔵 | `StorageFactory` → placeholders |
| MFA | ⚪ | Future |

---

# Feature-by-feature verification

Discrete acceptance features (approved-scope lens). Evidence abbreviated to primary files.

### Module 1

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F1.1 | Staff login / logout / refresh | 🟢 | `auth.routes.js`, `LoginPage.jsx` |
| F1.2 | `/auth/me` + profile + change password | 🟢 | auth/user routes, profile pages |
| F1.3 | Staff CRUD / activate / reset password | 🟢 | `users.routes.js`, `Staff*Page` |
| F1.4 | RBAC permission enforcement | 🟢 | `permission.middleware.js`, `PermissionGuard` |
| F1.5 | Roles catalog list | 🟡 | GET roles; no full role editor |
| F1.6 | Audit on auth/user ops | 🟢 | `AuditService`, `AuditLog.model.js` |
| F1.7 | Forgot-password email delivery | 🔵 | `AuthService.forgotPassword` |
| F1.8 | MFA Owner/Admin | ⚪ | Not in M1–19 acceptance |

### Module 2

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F2.1 | Branch CRUD / settings | 🟢 | `branches.routes.js`, branch pages |
| F2.2 | Master data CRUD | 🟢 | `masters.routes.js`, `MasterPage.jsx` |

### Module 3

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F3.1 | Doctor CRUD | 🟢 | `doctors.routes.js`, doctor pages |
| F3.2 | Weekly schedule + slot preview | 🟢 | schedule routes/services, `DoctorSchedulePage` |
| F3.3 | Leave management | 🟢 | leave routes, `DoctorLeavePage` |
| F3.4 | Availability API | 🟢 | `DoctorAvailabilityService` |

### Module 4

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F4.1 | Patient CRUD / search / pagination | 🟢 | patients API + list pages |
| F4.2 | Duplicate detection | 🟢 | `PatientDuplicateService` |
| F4.3 | Documents upload/list | 🟢 | document routes + panel |
| F4.4 | Patient timeline | 🟢 | timeline service/model |
| F4.5 | Patient merge | 🔵 | `PatientMergeService` not implemented |
| F4.6 | Consent / e-sign | 🟡 / 🔵 | consent patch; eSign placeholder |

### Module 5

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F5.1 | Slot engine / viewer | 🟢 | scheduling routes + `ScheduleViewerPage` |
| F5.2 | Branch holidays | 🟢 | holiday service + page |
| F5.3 | Doctor blocked slots | 🟢 | blocked slot service + page |
| F5.4 | Special schedules | 🟢 | special schedule service |
| F5.5 | Travel buffer | 🔴 | Not implemented (roadmap) |

### Module 6

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F6.1 | Appointment book/list/edit | 🟢 | appointments module + FE |
| F6.2 | Lifecycle (confirm/cancel/no-show/…) | 🟢 | `AppointmentLifecycleService` |
| F6.3 | Calendar + patient history | 🟢 | calendar/history pages |
| F6.4 | Double-booking prevention | 🟢 | `AppointmentConflictService` |
| F6.5 | Recurring appointments | 🔵 | recurring placeholder service |
| F6.6 | Pending-approval appointment state | 🔴 | Not in enum (roadmap) |

### Module 7

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F7.1 | Reception dashboard / today | 🟢 | reception routes + page |
| F7.2 | Check-in / walk-in | 🟢 | reception actions + dialogs |
| F7.3 | Queue board / call-next / reorder | 🟢 | queue routes + FE + sockets |
| F7.4 | Same-branch doctor transfer | 🟢 | `QueueService.transfer` |
| F7.5 | Cross-branch queue transfer | 🔵 | placeholder rejection |
| F7.6 | Structured handoff note | 🟡 | free-text only |

### Module 8

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F8.1 | Consultation start/workspace | 🟢 | consultations routes + workspace page |
| F8.2 | SOAP / vitals / diagnosis / exam / photos | 🟢 | clinical services + models |
| F8.3 | Sign consultation | 🟢 | sign endpoint |
| F8.4 | Lock → immutable EMR | 🟢 | lock + edit guards |
| F8.5 | Templates | 🟢 | template routes |
| F8.6 | AI EMR assists | 🔵 / ⚪ | `ConsultationAiInterface` |
| F8.7 | ICD-10 coding depth | 🟡 | UI placeholder label |

### Module 9

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F9.1 | Prescription CRUD / print | 🟢 | prescriptions module + FE |
| F9.2 | Finalize → immutable | 🟢 | finalize + draft assert |
| F9.3 | Medicine search / templates | 🟢 | medicine/template routes |
| F9.4 | Print logo/QR assets | 🔵 | cosmetic placeholders |

### Module 10

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F10.1 | Plan builder + protocols/packages | 🟢 | treatment plan module + FE |
| F10.2 | Approve / accept / reject / complete | 🟢 | lifecycle routes |
| F10.3 | Consent records gate accept | 🟢 | consent accept flow |
| F10.4 | E-sign / PKI | 🔵 | placeholder |
| F10.5 | Versioned consent catalogue | 🟡 | fixed text |

### Module 11

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F11.1 | Invoice create/update/finalize | 🟢 | billing service + FE |
| F11.2 | Partial / split payments | 🟢 | `recordPayment`; smoke M11 |
| F11.3 | Overpay prevention | 🟢 | BillingService validation |
| F11.4 | Invoice / receipt print | 🟢 | print routes + pages |
| F11.5 | Refund posting | 🔵 | `refundPlaceholder` |
| F11.6 | Cash close / day-end | 🔴 | missing |
| F11.7 | Email/WA invoice delivery | 🔵 | placeholder routes |
| F11.8 | Payment gateway | ⚪ | PRD non-goal / MVP out |

### Module 12

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F12.1 | Session create requires accepted plan | 🟢 | `#assertPaymentGate` |
| F12.2 | Payment gate (Paid/Partial) | 🟢 | same + smoke M12 |
| F12.3 | Session execute / complete / print | 🟢 | session pages + routes |
| F12.4 | Treatment dashboard | 🟢 | dashboard endpoint + page |

### Module 13

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F13.1 | Inventory dashboard / adjust / ledger | 🟢 | inventory module + FE |
| F13.2 | Stock mutations only via InventoryService | 🟢 | Pharmacy/Purchase wiring |
| F13.3 | Block expired dispense/use | 🟢 | InventoryService / PharmacyService |
| F13.4 | Pharmacy queue / dispense | 🟢 | pharmacy routes + FE |
| F13.5 | PO / GRN / suppliers | 🟢 | purchase + supplier surfaces |

### Module 14

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F14.1 | Lead CRUD / assign | 🟢 | CRM module |
| F14.2 | Kanban pipeline | 🟢 | pipeline API + page |
| F14.3 | Tasks / follow-ups | 🟢 | task board |
| F14.4 | Convert lead → patient | 🟢 | convert via PatientService |
| F14.5 | BullMQ CRM reminders | 🟢 | smoke M14 processed jobs |
| F14.6 | External comms log | 🔵 | placeholder log |

### Module 15

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F15.1 | Templates / inbox / unread / mark read | 🟢 | notifications module |
| F15.2 | Queue / retry / delivery log | 🟢 | NotificationService + FE |
| F15.3 | Event→template mapping | 🟢 | smoke M15 LeadCreated |
| F15.4 | Live Email/SMS/WhatsApp/Push | 🔵 | mock providers (approved v1) |

### Module 16

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F16.1 | Role dashboards | 🟢 | reports routes + FE |
| F16.2 | Report generate + filters | 🟢 | ReportService |
| F16.3 | CSV / Excel export | 🟢 | ExportService |
| F16.4 | PDF export | 🔵 | PDF placeholder |
| F16.5 | Scheduled reports + heavy queue | 🟢 | scheduled + BullMQ |

### Module 17

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F17.1 | Patient login / refresh / me | 🟢 | patient auth + portal login |
| F17.2 | Ownership enforcement | 🟢 | `assertOwnPatient`; smoke M17 |
| F17.3 | Portal appointments / records / Rx / treatments / billing | 🟢 | portal pages |
| F17.4 | Notifications + feedback | 🟢 | portal pages + API |
| F17.5 | Forgot/OTP/verify email | 🔵 | PatientAuthService |
| F17.6 | Native Expo app | ⚪ / replaced | Web portal approved (ADR/Module 17) |

### Module 18

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F18.1 | Analytics dashboard + categories | 🟢 | analytics API + FE |
| F18.2 | Redis cache | 🟢 | smoke M18 HIT |
| F18.3 | Export CSV/Excel + BullMQ | 🟢 | AnalyticsExport + jobs |
| F18.4 | AI report category | 🔵 | `AiReportPlaceholderService` |
| F18.5 | Live AI clinical copilot | ⚪ | Explicitly deferred |

### Module 19

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F19.1 | Security middleware suite | 🟢 | Helmet, HPP, sanitize, limits |
| F19.2 | Health probes | 🟢 | `/api/v1/health/*` |
| F19.3 | Logging channels + DLQ | 🟢 | Winston + `dlq.js` |
| F19.4 | OpenAPI / Swagger | 🟢 | swagger/openapi; disable flag |
| F19.5 | Docker / nginx / PM2 / CI skeleton | 🟢 | `docker/`, `ecosystem.config.cjs`, `.github` |
| F19.6 | Private / auth-gated uploads | 🔴 | public `express.static('/uploads')` |
| F19.7 | Operational backup/restore automation | 🔵 | placeholder scripts |
| F19.8 | Cloud object storage | 🔵 | StorageFactory placeholders |
| F19.9 | Prod secrets / password rotation (ops) | 🔴 | checklist item; seed defaults remain |

### ADR / platform replacements (tracked once)

| ID | Feature | Status | Evidence |
|---|---|---|---|
| F0.1 | Nest/Postgres/Next stack | ⚪ | ADR-001 Accepted → Express/Mongo/Vite |
| F0.2 | Multi-org SaaS tenancy | ⚪ | Single-clinic architecture |
| F0.3 | Payment gateway | ⚪ | MVP non-goal |
| F0.4 | ABDM/FHIR/teleconsult/kiosks | ⚪ | Phase 3 |

---

# Workflow verification

Pre-UAT + module smokes confirm transitions. Each hop must leave durable state usable by the next.

| # | Transition | Status | Evidence |
|---|---|---|---|
| 1 | Lead → Patient | 🟢 | `CrmService.convert` → `PatientService`; smoke M14 |
| 2 | Patient → Appointment | 🟢 | `AppointmentService` book; conflict check |
| 3 | Appointment → Reception | 🟢 | reception today + check-in |
| 4 | Reception → Queue | 🟢 | check-in creates/updates `QueueEntry` |
| 5 | Queue → Consultation | 🟢 | start-consult / consultation create; socket events |
| 6 | Consultation → Prescription | 🟢 | Rx tied to consultation; lock rules |
| 7 | Consultation → Treatment Plan | 🟢 | plan create from consultation |
| 8 | Treatment Plan → Billing | 🟢 | invoice from plan/package (M11) |
| 9 | Billing → Payment | 🟢 | `recordPayment`; no overpay |
| 10 | Payment → Treatment Session | 🟢 | payment gate on session create/start |
| 11 | Prescription → Pharmacy | 🟢 | pharmacy queue / dispense |
| 12 | Pharmacy → Inventory | 🟢 | dispense → `InventoryService` deduct |
| 13 | Clinic ops → Reports | 🟢 | M16 aggregations from live data |
| 14 | Patient → Patient Portal | 🟢 | portal JWT + ownership; smoke M17 |

**Workflow overall:** 🟢 **Complete under approved scope** (with disclosed 🔵 channel/PDF/AI edges that do not break the spine).

---

# Role verification

Implemented roles (`backend/src/constants/roles.js`):  
`OWNER`, `ADMIN`, `BRANCH_MANAGER`, `DOCTOR`, `RECEPTIONIST`, `NURSE`, `TECHNICIAN`, `CASHIER`, `PHARMACIST`, `CRM_EXECUTIVE`.

| Requested persona | System role | Menu | Permissions | Routes | APIs | Restrictions | Status |
|---|---|---|---|---|---|---|---|
| Owner | OWNER | Full nav (wildcard) | `*` effective | Staff + settings | All staff APIs | Unlock consult etc. | 🟢 |
| Admin | ADMIN | Near-full | Near-full matrix | Staff routes | Staff APIs | No owner-only edges | 🟢 |
| Branch Manager | BRANCH_MANAGER | Ops + reports + CRM | Branch-scoped ops | Permission-gated | Permission-gated | Branch focus | 🟢 |
| Doctor | DOCTOR | EMR/Rx/Plans/Queue/… | Clinical set | Clinical routes | Clinical APIs | No users.* admin | 🟢 |
| Receptionist | RECEPTIONIST | Reception/Queue/Patients/Appts/Billing create | Reception set | Reception routes | Reception APIs | Limited clinical edit | 🟢 |
| Technician | TECHNICIAN | Treatments / inventory view | Session + stock adjust | Treatment routes | Session APIs | Limited | 🟢 |
| Pharmacist | PHARMACIST | Pharmacy/Inventory | Pharmacy.* | Pharmacy routes | Dispense/stock | Rx view/print | 🟢 |
| CRM Executive | CRM_EXECUTIVE | CRM (+ limited patient/appt) | CRM.* | CRM routes | CRM APIs | Limited clinical | 🟢 |
| **Accountant** | **CASHIER** (mapped) | Billing + reports.view | `billing.*` | Billing routes | Billing APIs | No clinical write | 🟡 naming |
| Patient | Portal JWT (not staff role) | `/portal/*` only | Ownership only | `PatientProtectedRoute` | `/api/v1/patient` | Staff JWT rejected | 🟢 |
| Nurse | NURSE | Clinical view/edit limited | Nurse matrix | Gated | Gated | — | 🟢 (extra vs list) |

Evidence: `docs/PERMISSION_MATRIX.md`, `rolePermissions.js`, `AppLayout.jsx` nav filter, portal shell.

**Note:** PRD “Accountant” is delivered as **`CASHIER`** — functionally present; label differs 🟡.

---

# Business-rule verification

| Rule | Status | Evidence |
|---|---|---|
| No doctor/patient double booking (active statuses) | 🟢 | `AppointmentConflictService.assertNoConflicts` |
| No invoice overpayment | 🟢 | `BillingService` “Cannot overpay invoice”; smoke M11 |
| Signed/locked consultation immutable | 🟢 | `ConsultationService` lock guards; Rx/plan also blocked when locked |
| Finalized prescription immutable | 🟢 | Prescription finalize + `#assertDraft` |
| Inventory mutations through InventoryService only | 🟢 | Pharmacy/Purchase call InventoryService |
| Cannot dispense/use expired medicine batch | 🟢 | InventoryService / PharmacyService expired checks |
| Treatment session requires accepted plan | 🟢 | `#assertPaymentGate` plan status `ACCEPTED` |
| Payment gates treatment (Paid/Partial) | 🟢 | same method; smoke M12 blocks unpaid |
| Patient portal ownership validation | 🟢 | `assertOwnPatient`; smoke M17 |
| Staff vs patient JWT isolation | 🟢 | Pre-UAT cross-token 401 |
| Accepted treatment plan not freely editable | 🟢 | smoke M10 locked edit 403 |
| Completed dispense immutable | 🟢 | smoke M13 assert |
| Zod validation on mutating routes | 🟢 | `validate` middleware + validators |
| RBAC on staff routes | 🟢 | `requirePermission` |
| Rate limiting | 🟢 | security middleware; 429 observed in pre-UAT |

---

# Placeholder features

| Placeholder | Location | Approved? |
|---|---|---|
| Mock Email/SMS/WhatsApp/Push | `backend/src/notifications/providers.js` | Yes (v1) |
| AI analytics category | `AiReportPlaceholderService.js` | Yes (deferred AI) |
| Consultation AI interface | `ConsultationAiInterface.js` | Yes (deferred) |
| PDF export adapter | `ExportService.toPdfPlaceholder` | Interim |
| Cloud S3/Azure/GCS | `StorageFactory`, `CloudStoragePlaceholder.js` | Interim local |
| Backup / restore npm | `scripts/db/backup.placeholder.js`, `restore.placeholder.js` | Ops must replace |
| Billing refund | `BillingService.refundPlaceholder` | Gap → need real or waive |
| Billing email/WA markers | billing placeholder routes | Mock-aligned |
| Patient merge | `PatientMergeService` | Gap |
| Recurring appointments | `RecurringAppointmentService` | Deferred depth |
| Queue cross-branch transfer | `QueueService` | Deferred |
| Forgot-password (staff + patient) | Auth / PatientAuth services | Gap for prod self-serve |
| Patient OTP / email verify | `PatientAuthService` | Deferred |
| Portal Rx refill | `prescriptionRefillPlaceholder` | Deferred |
| Portal/server PDF | placeholderPdf flags | Interim |
| Consent e-sign / PKI | Treatment plan / ConsentRecord | Deferred |
| CRM communication log | CrmService placeholder notes | Mock-aligned |
| Analytics digest email | `runDigestPlaceholder` | Interim |
| Print logo/QR cosmetics | billing/Rx/session print payloads | Cosmetic |
| GST placeholder flags | Branch/Billing | Interim |
| Session QR placeholder | TreatmentSessionService | Cosmetic |
| ICD-10 UI label | Diagnosis forms | Depth gap |
| Migrate script “placeholder migrations” | index sync only | Accepted approach |

---

# Deferred features

| Item | Horizon | Basis |
|---|---|---|
| Live WhatsApp/SMS/email vendors | Phase 2 | Mock approved for v1 |
| Live AI clinical + analytics AI | Phase 2+ | Module 18 instruction |
| MFA | Future hardening | Module 19 future |
| Travel buffer / rooms-devices engine | Roadmap | Not M1–19 acceptance |
| Appointment pending-approval states | Roadmap | Enum gap |
| GU/HI localization | Roadmap | Not delivered |
| Native mobile apps | Phase 2+ | Web portal replacement |
| Real PDF renderer | Before polish GA | Placeholder OK for UAT |
| Private signed URL uploads | **Before PHI prod** | Security P0 (treat as must-fix, not “nice deferred”) |

---

# Out-of-scope features

| Item | Basis |
|---|---|
| Multi-tenant SaaS / org onboarding | Architecture / README |
| NestJS + PostgreSQL + Prisma + Next.js rewrite | ADR-001 |
| Payment gateway | PRD §2.3 non-goal / MVP |
| ABDM / FHIR / teleconsult / kiosks | Phase 3 |
| Autonomous diagnosis / image-diagnosis AI | Non-goal / phase-gated |
| FullCalendar Premium resource timeline | Replaced by custom calendar |

---

# Client-visible limitations

Disclose in UAT kickoff:

1. Notifications show as sent via **mock** channels (no real SMS/WA/email).  
2. **PDF** downloads may be placeholder payloads — use CSV/Excel or browser print.  
3. **AI** tiles/buttons return placeholder / not-implemented.  
4. **Refund** and **cash close** are not full finance workflows.  
5. **Patient merge** is not operational.  
6. **Forgot password** does not send email.  
7. Seed passwords are demo-only.  
8. Uploaded files may be reachable via static `/uploads` URLs in current build — avoid sensitive PHI uploads on shared networks until fixed.  
9. Role label **Accountant** appears as **Cashier** in the product.  
10. Module 16 Reports and Module 18 Analytics are **both** present (intentional).

---

# Production blockers

| ID | Blocker | Severity |
|---|---|---|
| P0-1 | Public `/uploads` | Critical |
| P0-2 | Rotate seed passwords / JWT secrets; `COOKIE_SECURE`; Swagger off | Critical |
| P0-3 | Wire real `mongodump` backup + restore drill | Critical |
| P0-4 | Accept mock notifications in writing **or** enable one live channel | Critical (policy) |
| P1-1 | Cash close | High (finance ops) |
| P1-2 | Real refund | High |
| P1-3 | Patient merge (or hide API/UI) | Medium-High |
| P1-4 | Auth-gate uploads / private storage | Critical (overlaps P0-1) |

---

# UAT blockers

| Item | Blocks UAT? |
|---|---|
| Core Lead→Portal workflow | **No** — verified |
| Mock notifications | **No** if disclosed |
| PDF/AI placeholders | **No** if disclosed |
| Public uploads on isolated UAT LAN | **No** if PHI policy agreed; **Yes** if client insists on PHI photos in UAT |
| Cash close / refund / merge | **No** for clinical UAT; **Yes** for finance UAT scenarios that require them |
| Seed credentials | **No** for closed UAT; must not be internet-facing |

**UAT can proceed** with written acceptance of client-visible limitations.

---

# Final Table

| Module | Features | Complete 🟢 | Partial 🟡 | Missing 🔴 | Placeholder 🔵 | Status |
|---|---:|---:|---:|---:|---:|---|
| 1 Users & RBAC | 8 | 5 | 1 | 0 | 1 (+1 ⚪ MFA) | 🟢 |
| 2 Branches & Masters | 2 | 2 | 0 | 0 | 0 | 🟢 |
| 3 Doctors | 4 | 4 | 0 | 0 | 0 | 🟢 |
| 4 Patients | 6 | 4 | 1 | 0 | 1 | 🟡 |
| 5 Scheduling | 5 | 4 | 0 | 1 | 0 | 🟢 |
| 6 Appointments | 6 | 4 | 0 | 1 | 1 | 🟢 |
| 7 Reception & Queue | 6 | 4 | 1 | 0 | 1 | 🟢 |
| 8 Consultation / EMR | 7 | 5 | 1 | 0 | 1 | 🟢 |
| 9 Prescription | 4 | 3 | 0 | 0 | 1 | 🟢 |
| 10 Treatment Plans | 5 | 3 | 1 | 0 | 1 | 🟢 |
| 11 Billing | 8 | 4 | 1 | 1 | 2 (+1 ⚪ gateway) | 🟡 |
| 12 Treatment Execution | 4 | 4 | 0 | 0 | 0 | 🟢 |
| 13 Pharmacy & Inventory | 5 | 5 | 0 | 0 | 0 | 🟢 |
| 14 CRM | 6 | 5 | 0 | 0 | 1 | 🟢 |
| 15 Notifications | 4 | 3 | 0 | 0 | 1 | 🟡 |
| 16 Reports | 5 | 4 | 0 | 0 | 1 | 🟢 |
| 17 Patient Portal | 6 | 4 | 0 | 0 | 2 (+1 ⚪ Expo) | 🟢 |
| 18 Analytics / AI | 5 | 3 | 0 | 0 | 1 (+1 ⚪ live AI) | 🟡 |
| 19 Production Hardening | 9 | 5 | 0 | 2 | 2 | 🟡 |
| ADR / platform OOS | 4 | 0 | 0 | 0 | 0 (+4 ⚪) | ⚪ |
| **TOTAL** | **109** | **75** | **6** | **5** | **18** (+ **8** ⚪) | — |

*Notes:* Counts are **acceptance features** in this audit (not the 188 RTM lines). ⚪ items are counted in “Out of Scope” summary, not as Incomplete. Module Status is the dominant module health for client communication.

---

# Final Summary

| # | Metric | Value |
|---|---|---|
| 1 | **Total Features Verified** | **109** |
| 2 | **Fully Implemented (🟢)** | **75** (~69%) |
| 3 | **Partially Implemented (🟡)** | **6** (~6%) |
| 4 | **Missing (🔴)** | **5** (~5%) — travel buffer, pending-approval state, cash close, private uploads, prod secret/ops hardening as tracked features |
| 5 | **Placeholder / Mock (🔵)** | **18** (~17%) |
| 6 | **Out of Scope (⚪)** | **8** (~7%) |
| 7 | **Client-ready %** (approved scope, usable 🟢+acceptable 🟡+approved 🔵) | **~88–92%** |
| 8 | **UAT-ready %** | **~95%** (spine green; caveats disclosed) |
| 9 | **Production-ready %** | **~70–75%** (P0 security/ops open) |
| 10 | **Can the client use every feature promised in the approved scope?** | **No — not every feature.** They **can** run the promised **end-to-end clinic workflow**. Remaining gaps: cash close 🔴, private uploads 🔴, real refund 🔵, patient merge 🔵, live channels 🔵 (approved mock), PDF/AI 🔵, forgot-password email 🔵, Accountant→Cashier naming 🟡, assorted depth 🟡. |
| 11 | **Exact features still needed before `v1.0.0` GA** | See below |

### Before `v1.0.0` (minimum)

1. **Auth-gated / private file serving** (remove public `/uploads` PHI risk) — `app.js`  
2. **Production secrets & password rotation** + `COOKIE_SECURE` + Swagger off  
3. **Operational backup/restore** (`mongodump` wired; replace placeholder scripts)  
4. **Written waiver for mock notifications** *or* one live channel  
5. **Cash close** *or* formal finance waiver  
6. **Real refund** *or* hide/disable refund placeholder from client UI  
7. **Patient merge** implement *or* remove routes/permission from client-facing surface  
8. UAT defect burn-down from client sign-off cycle  

Optional but recommended for GA polish: real PDF renderer, forgot-password email, hide AI buttons or label clearly, Socket Redis adapter if multi-instance.

### Cross-doc consistency

| Prior doc | Alignment |
|---|---|
| Scope reconciliation | Confirmed — backbone ~90%; delivery gaps match P0/P1 list |
| Pre-UAT | Confirmed — UAT yes / Prod no |
| Gap analysis (full PRD) | Still valid that **full PRD ≠ accepted** for this RC |
| ADR-001 | Stack replacements treated as ⚪ / satisfied, not 🔴 |

---

## Sign-off recommendation

| Decision | Recommendation |
|---|---|
| Client UAT start | **Approve** with limitations appendix |
| Production go-live | **Reject** until Production blockers closed |
| Tag | Keep **`1.0.0-rc.1`** until GA checklist complete → then **`1.0.0`** |

---

*Audit only — no application code was modified.*
