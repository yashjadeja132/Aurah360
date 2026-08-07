# Requirements Traceability Matrix — Aurah 360 ClinicOS

**Source of truth:** `aurah_prd.md` (Version 1.0 / 04 August 2026)  
**Codebase audited:** `d:\New folder\aurah360-clinicos`  
**Audit date:** 2026-08-06  
**Method:** PRD section extraction → code path / route / model / UI verification (no assumptions)

**Status legend**

| Symbol | Meaning |
|---|---|
| ✅ Complete | Usable implementation found; no obvious functional gap for stated requirement |
| 🟡 Partial | Implemented but incomplete vs PRD (missing UI, API, validation, workflow, or placeholder) |
| 🔴 Missing | No usable implementation found |
| ⚪ Out of Scope | Explicitly deferred by PRD release scope, project ADR, or MVP non-goals |

**Scope notes (must read first)**

1. PRD §2.3 phases: **MVP**, **Phase 2**, **Phase 3**. Many Phase 2/3 items are correctly not “MVP complete.”
2. ADR-001 (`docs/adr/001-stack-decision.md`) **replaces PRD §15 stack** (NestJS/Postgres/Next.js → Express/Mongo/Vite). Functional requirements remain authoritative; stack differences are documented, not defects.
3. Project README / architecture docs state **single-clinic, not multi-tenant SaaS** — conflicts with PRD ORG-001/ORG-007 multi-organization isolation. Treated as **intentional product decision** vs PRD; marked 🟡/🔴 with notes.

---

## 00–02 Vision, principles, release scope

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| 2.2 | One patient, one timeline | 🟡 Partial | Patient detail + portal timeline exist; not a single universal timeline API covering all events | `PatientDetailPage.jsx`, `PatientPortalService` timeline | Cross-module timeline aggregation incomplete |
| 2.2 | Configure, do not hard-code | 🟡 Partial | Masters, protocols, templates configurable | `masters`, `ConsultationTemplate`, treatment protocols | Some tax/GST still placeholder |
| 2.2 | Doctor remains accountable | ✅ Complete | Sign/lock consultation; AI not auto-committed | `ConsultationService.sign` | AI is stub only |
| 2.2 | Event-driven automation | 🟡 Partial | eventBus + BullMQ + notifications | `eventBus.js`, `notificationJobs.js` | Providers are **mock** |
| 2.2 | Safe failure if AI/WhatsApp down | ✅ Complete | Clinical flows do not depend on AI/providers | Mock providers fail soft | Matches principle |
| 2.3 | MVP scope modules | 🟡 Partial | Modules 1–19 built as ClinicOS web | `docs/MODULES.md` | Gaps inside MVP listed below |
| 2.3 | Phase 2 patient mobile app | 🟡 Partial | **Web** portal `/portal`, not RN/Expo | `pages/portal/*`, `/api/v1/patient` | PRD APP-001 expects Expo |
| 2.3 | Phase 3 ABDM/FHIR / multi-org SaaS | ⚪ Out of Scope | No ABDM/FHIR/Organization model | ADR + README | Phase 3 |
| 2.3 | MVP non-goal: payment gateway | ⚪ Out of Scope | No Razorpay/Stripe | `docs/architecture/overview.md` | Correct absence |
| 2.3 | MVP non-goal: autonomous diagnosis | ⚪ Out of Scope | AI stubs only | `ConsultationAiInterface.js` | Correct |

---

## 03 Users, roles & access

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| 03 | Owner / Super Admin | ✅ Complete | `ROLES.OWNER`, `*` permissions | `roles.js`, `rolePermissions.js` | Step-up MFA for exports **missing** |
| 03 | Organization Admin | ✅ Complete | Mapped to `ADMIN` | `rolePermissions.js` | Name differs from PRD |
| 03 | Branch Admin | ✅ Complete | `BRANCH_MANAGER` | `rolePermissions.js` | |
| 03 | Receptionist | ✅ Complete | Role + FE guards | `routes/index.jsx` | |
| 03 | Doctor | ✅ Complete | Role + clinical perms | | |
| 03 | Nurse / Clinical Assistant | ✅ Complete | `NURSE` | | |
| 03 | Treatment Technician | ✅ Complete | `TECHNICIAN` | | |
| 03 | Pharmacy / Medical Staff | ✅ Complete | `PHARMACIST` | | |
| 03 | Accountant / Cashier | 🟡 Partial | `CASHIER` only | `roles.js` | No distinct Accountant; cash close missing |
| 03 | CRM / Call Desk | ✅ Complete | `CRM_EXECUTIVE` | | |
| 03 | Auditor / Read-only | 🔴 Missing | Not in `ROLES` | `constants/roles.js` | |
| 03 | Patient / Guardian | 🟡 Partial | Patient portal JWT; no guardian switching UX | `/patient`, `/portal` | Dependents limited |
| 3.1 | Staff MFA | 🔴 Missing | No MFA code | security docs list as future | P0 for privileged roles per PRD |
| 3.1 | Patient OTP | 🟡 Partial | Route exists; service placeholder | `PatientAuthService.otpLogin` | Throws/not enabled |
| 3.1 | Break-glass | 🔴 Missing | Only Owner consultation unlock | `ConsultationService.unlock` | Not PRD break-glass |
| 3.1 | Step-up for export/refund/role change | 🔴 Missing | No step-up middleware | | |
| 3.1 | Staff-only / internal / patient-facing notes | 🔴 Missing | No note visibility classification | EMR models | |

---

## 04 Organization, branches, doctors, resources

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| ORG-001 | Organization profile | 🔴 Missing | No Organization model | — | Single-clinic decision |
| ORG-002 | Unlimited branches | ✅ Complete | Branch CRUD + soft delete | `Branch.model.js`, `/branches` | |
| ORG-003 | Branch services/fees/rooms/devices/stock/invoice series | 🟡 Partial | Hours, settings, stock, fees partial | `Branch.settings` | Rooms/devices masters missing; GST placeholder |
| ORG-004 | Shared patient master across branches | ✅ Complete | `primaryBranchId` + global MRN | `Patient.model.js` | |
| ORG-005 | Branch deactivate/merge/transfer | 🟡 Partial | Soft deactivate exists | Branch service | Merge/transfer workflow missing |
| ORG-006 | Org masters inherit / branch override | 🔴 Missing | No org inheritance | Masters are global | |
| ORG-007 | Every record has organization + branch | 🟡 Partial | Branch on most domain records; no organizationId | Models | Intentional single-clinic |
| 4.2 | Doctor roster + leave + blocked time | ✅ Complete | Schedule, leave, blocked slots | `/doctors/:id/schedule`, scheduling routes | |
| 4.2 | Travel buffer | 🔴 Missing | Only `appointmentBufferMinutes` | `schedule.engine.js` | Not cross-branch travel |
| 4.2 | Global collision across branches | 🟡 Partial | Doctor/patient overlap check | `AppointmentConflictService.js` | No room/device; no travel |
| 4.3 | Room master + scheduling | 🔴 Missing | Free-text `roomId` on sessions only | `TreatmentSession.model.js` | |
| 4.3 | Device master + maintenance blocks | 🔴 Missing | Free-text device fields | | |
| 4.3 | Staff skill / credential expiry | 🔴 Missing | No skill model | | |
| 4.3 | Treatment protocol configuration | ✅ Complete | Protocols CRUD | `/treatment-plans/protocols` | |

---

## 05 Patient master & reception handoff

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| PAT-001 | Create/search/update + duplicate detection | ✅ Complete | Duplicate check API | `PatientDuplicateService`, `POST /patients/duplicates/check` | |
| PAT-001 | Merge-review (non-destructive) | 🟡 Partial | Merge service throws | `PatientMergeService.js` | Placeholder |
| PAT-002 | Quick returning check-in | ✅ Complete | Reception check-in | `ReceptionService.checkIn`, `/reception` | |
| PAT-003 | Referral source / campaign | ✅ Complete | leadSource + CRM sources | Patient + Lead models | |
| PAT-004 | Separate consents | 🟡 Partial | Boolean consent flags | `Patient.model.js` consentSchema | No versioned consent catalogue / withdrawal history |
| PAT-005 | Guardian/dependent | 🟡 Partial | Emergency contact fields | Patient model | Full guardian authority workflow weak |
| PAT-006 | Front Desk Handoff Note | 🟡 Partial | `receptionNotes` free text | `ReceptionService`, QueueEntry | No categories, urgency, acknowledgment entity |
| PAT-007 | Permission-aware cross-branch timeline | 🟡 Partial | Patient history APIs | | Not full unified timeline |
| PAT-008 | CSV/API migration | 🔴 Missing | No Kivi migration tooling | | P1 |
| 5.1 | MRN, VIP, blacklist, tags | ✅ Complete | Fields on Patient | `Patient.model.js` | |

---

## 06 Appointments, calendar, queue

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| APT-001 | Collision-safe availability | 🟡 Partial | Doctor/patient conflicts + schedule engine | `AppointmentConflictService`, `schedule.engine.js` | Room/device/travel missing |
| APT-002 | Reception booking | ✅ Complete | Book page + API | `/appointments/book` | |
| APT-002 | Patient app booking | 🟡 Partial | Portal can book | portal appointments | Not native app |
| APT-002 | WhatsApp / website OTP booking | 🔴 Missing | No REST public booking / WhatsApp flow | | |
| APT-003 | Pending Approval / alternative slot | 🔴 Missing | Statuses lack REQUESTED/PENDING_APPROVAL | `enums/appointment.js` | Only SCHEDULED…RESCHEDULED |
| APT-004 | Calendar filters/views | 🟡 Partial | Calendar page exists | `AppointmentCalendarPage.jsx` | Not FullCalendar resource timeline; custom UI |
| APT-005 | Check-in, queue, wait timer | ✅ Complete | Reception + Queue | `/reception`, `/queue` | |
| APT-006 | Cancel/no-show reason, waitlist | 🟡 Partial | Cancel/no-show exist | Appointment lifecycle | Waitlist missing |
| APT-007 | State → audit/notifications | 🟡 Partial | Audit + eventBus | | Notification providers mock |
| APT-008 | Locking / idempotency | 🟡 Partial | Conflict checks | | No explicit idempotency keys on booking |
| 6.5 | Public queue board least-PII | 🔴 Missing | Queue shows full names | `QueueService` populate | |
| 6.5 | Called / Away / Late / No Response | 🟡 Partial | Queue statuses subset | `enums/queue.js` | Not full PRD set |

---

## 07 Documents & clinical photography

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| DOC-001 | Mandatory metadata | 🟡 Partial | Document model has fields | `PatientDocument.model.js` | Verify all PRD fields enforced in validators |
| DOC-002 | Camera/batch scan workflow | 🟡 Partial | Upload via multer | upload middleware | Multi-page scan/OCR not present |
| DOC-003 | Immutable original, checksum, malware, signed URL | 🟡 Partial | Local storage; `getSignedUrl` returns `/uploads/...` | `LocalStorage.js` | **Public static `/uploads`**; no malware scan |
| IMG-001 | Photo consent | 🟡 Partial | `photographyConsent` boolean | Patient consent | Not purpose-specific capture gate |
| IMG-002 | Body region / before-after pairing | 🟡 Partial | `ClinicalPhoto` + PHOTO_TYPE | `ClinicalPhoto.model.js` | Slider/standardization limited |
| IMG-003 | Restricted body-area policy server-side | 🔴 Missing | No restricted-area enforcement found | | |
| IMG-004 | Non-destructive annotation | 🔴 Missing | | | P1 |
| IMG-005 | Separate release/export controls | 🟡 Partial | Portal release concepts | Patient portal docs | Incomplete vs PRD |

---

## 08 Consultation / EMR

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| EMR-001 | Encounter linked to appointment/patient | ✅ Complete | Consultation model + start | `ConsultationService.start` | |
| EMR-002 | Nurse intake, templates | 🟡 Partial | Vitals + templates | `/consultations/vitals`, templates | Specialty dermatology template pack incomplete |
| EMR-003 | Autosave, favorites, copy-forward | 🟡 Partial | Workspace UI | `ConsultationWorkspacePage.jsx` | Copy-previous not a first-class API |
| EMR-004 | Structured diagnosis/Rx/plan/follow-up | ✅ Complete | Linked modules | Consultation, Prescription, TreatmentPlan | |
| EMR-005 | Sign/lock/amend | 🟡 Partial | Sign/lock/unlock | `ConsultationService` | **Amend/addendum trail missing**; unlock ≠ amend |
| EMR-006 | Internal vs patient-facing release | 🟡 Partial | Portal release filters | Patient portal | Incomplete classification on notes |
| EMR-007 | Dictation / decision support | ⚪ Out of Scope | P2 | | |
| EMR-008 | Longitudinal medical summary | 🟡 Partial | Patient summary panels | | Not one-page formal summary |

---

## 09 AI clinical copilot

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| AI-001…AI-008 | AI gateway, de-ID, accept/reject, audit | 🔴 Missing / Placeholder | Interface throws NOT_IMPLEMENTED | `ConsultationAiInterface.js`, `AiReportPlaceholderService.js` | Phase 2; correctly not live |
| 9.3 | Image AI | ⚪ Out of Scope | Phase-gated in PRD | | |

---

## 10 Treatment, procedures, packages

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| TRT-001 | Structured treatment plan/order | ✅ Complete | Plans + accept | `TreatmentPlanService` | |
| TRT-002 | Staff queue + guided checklist | 🟡 Partial | Session list/execution | `/treatment-sessions` | **Guided checklist steps missing** |
| TRT-003 | Room/device/staff reservation | 🟡 Partial | Free-text fields | Session model | No reservation engine |
| TRT-004 | Parameters, consumables, outcome | 🟡 Partial | Session fields + consumables | `TreatmentSessionService` | Adverse event **missing** |
| TRT-005 | Atomic close → stock/package/billing | 🟡 Partial | Complete updates package/stock paths | `complete` | Billing linkage partial |
| TRT-006 | Patch-test and consent dependencies | 🔴 Missing | No patch-test entity/hard-stop | Grep empty | |
| TRT-007 | Protocol versioning | 🟡 Partial | Protocol versions exist | Protocol model | Prospective versioning rules incomplete |
| TRT-008 | Multi-session packages | ✅ Complete | Packages + usage | Package builder, plans | |

---

## 11 Prescription, pharmacy, inventory, billing

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| RX-001 | Structured Rx + autocomplete | ✅ Complete | Prescription module + medicines | `/prescriptions`, Medicine master | |
| INV-001 | Product, vendor, PO, GRN, batch, expiry | ✅ Complete | Inventory + purchase | `/inventory`, `/inventory/purchase-orders` | |
| INV-002 | Immutable ledger + transfer | ✅ Complete | StockTransaction + transfer | `InventoryService.transfer` | Request→approve→dispatch workflow simplified |
| INV-003 | FEFO dispensing | ✅ Complete | FEFO in InventoryService + UI | `PharmacyService`, `DispenseScreenPage` | |
| INV-004 | Low stock / expiry / negative stock | ✅ Complete | Controls + reports | InventoryService | |
| BIL-001 | Fee schedule, invoice, manual payments | ✅ Complete | Billing module | `/billing` | |
| BIL-002 | Split/partial, due, refund, discount audit | 🟡 Partial | Split/partial/overpay guard | `BillingService.recordPayment` | **Refund placeholder**; discount approval weak |
| BIL-003 | Package sale + cash close | 🟡 Partial | Packages exist | | **Cash close missing** |
| 11.3 | Cannot edit finalized invoice | ✅ Complete | `#assertDraft` | `BillingService.js` | |
| 11.2 | Expired batch cannot dispense | ✅ Complete | Explicit error | `InventoryService.js` | |

---

## 12 CRM & notifications

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| NTF-001 | Event-driven notifications + templates | ✅ Complete | Templates + NotificationService + BullMQ | Module 15 | |
| NTF-002 | WhatsApp templates + reschedule actions | 🟡 Partial | Mock WhatsApp provider | `notifications/providers.js` | No real WhatsApp / manage-link flow |
| NTF-003 | DLT-aware SMS | 🟡 Partial | Mock SMS | providers.js | No DLT template ID enforcement |
| NTF-004 | Voice reminder | 🔴 Missing | No voice provider | | |
| NTF-005 | Push/email deep links | 🟡 Partial | Mock push/email | | |
| NTF-006 | Consent / quiet hours / opt-out | 🟡 Partial | Marketing consent flag | Patient consent | Quiet hours incomplete |
| NTF-007 | Idempotency, retries, DLQ | ✅ Complete | BullMQ retries + DLQ | `queues/dlq.js` | |
| CRM-001 | Lead pipeline, recall, feedback, offer board | 🟡 Partial | Pipeline + leads + tasks + feedback | `/crm` | **Offer board missing** |
| 12.3 | WhatsApp reschedule approval workflow | 🔴 Missing | | | |
| 12.1 | Follow-up → tracked task + reminder plan | 🟡 Partial | CRM follow-ups + appointment follow-up | | Full reminder plan matrix incomplete |

---

## 13 Patient Android/iOS app

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| APP-001 | Expo/React Native | 🔴 Missing | No mobile app package | | **Web portal substitute** (Phase 2 partial) |
| APP-002 | OTP, biometric, device controls | 🔴 Missing | OTP placeholder | `otpLogin` | Password login on web portal |
| APP-003–006 | Booking, timeline, bills, docs, prefs | 🟡 Partial | Web portal pages | `pages/portal/*` | Functional subset on web |
| APP-007 | GU/HI/EN localization | 🔴 Missing | Default `en` only | | |
| APP-008 | No clinical data in analytics logs | 🟡 Partial | PHI-safe logger guidance | `logger.js` | No auto-redaction |

---

## 14 Dashboards & reports

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| 14.1 | Owner / Doctor / Reception / CRM / Pharmacy / Treatment dashboards | 🟡 Partial | Role dashboards M16 + executive M18 + module dashboards | `/reports`, `/analytics`, module pages | Not all PRD widgets present |
| 14.2 | Report catalogue groups | 🟡 Partial | M16 generate + M18 category analytics | | AI governance / security reports incomplete |
| 14.3 | Export CSV/XLSX/PDF + async | 🟡 Partial | CSV/XLSX real; PDF placeholder; queue export | `AnalyticsExportService`, ExportService | |
| 14.3 | Separate view vs export permissions | ✅ Complete | `reports.view` / `reports.export` | permissions.js | |

---

## 15 Architecture & APIs

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| 15.1 | NestJS + Postgres + Next.js + RN | ⚪ Out of Scope | ADR-001 alternate stack | `docs/adr/001-stack-decision.md` | Intentional divergence |
| 15.1 | Redis + BullMQ | ✅ Complete | Workers running | queues/* | |
| 15.1 | Private S3 + malware scan | 🟡 Partial | Local + cloud placeholders | `StorageFactory.js` | |
| 15.4 | Idempotency keys | 🔴 Missing | Not implemented on risky writes | | |
| 15.4 | Transactional outbox | 🔴 Missing | Direct eventBus emit | | |
| 15.5 | Endpoint groups roughly match | 🟡 Partial | `/api/v1/*` covers most domains | `routes/v1/index.js` | Paths differ from PRD names |
| 15.5 | `/ai`, `/otp`, `/cash-close`, `/rooms` | 🔴 Missing | | | |

---

## 16 Privacy, security, governance

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| SEC-001 | Deny-by-default RBAC | ✅ Complete | `requirePermission` | permission.middleware.js | |
| SEC-002 | MFA / step-up / rate limit | 🟡 Partial | Rate limits yes; MFA no | security.middleware.js | |
| SEC-003 | Encryption, private files, secure upload | 🟡 Partial | Helmet/TLS ops; public uploads | `app.js` static `/uploads` | **Production blocker** |
| SEC-004 | Append-oriented audit | ✅ Complete | AuditService + AuditLog | | |
| SEC-005 | PHI-safe observability | 🟡 Partial | Logger guidance | | No SAST/SBOM gate in CI fully |
| PRV-001 | Versioned consents / withdrawal | 🟡 Partial | Booleans only | Patient.consent | |
| PRV-002 | Patient rights case workflow | 🔴 Missing | | | |
| PRV-003 | Retention / legal hold | 🔴 Missing | | | |
| BCM-001 | Automated backups / PITR / restore tests | 🟡 Partial | Placeholder scripts + docs | `db/backup.placeholder.js` | Ops not automated |
| GOV-001 | Protocol approval + adverse event | 🟡 Partial | Protocols exist | | Adverse event missing |
| AIG-001 | AI governance before AI release | ⚪ Out of Scope | AI not released | Correct gate |

---

## 17 UX / localization

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| 17 | Role shells, queues, guided flows | 🟡 Partial | AppLayout + role pages | frontend | Premium design partial |
| 17.9 | Gujarati / Hindi / English | 🔴 Missing | No i18n framework | | |
| 17.9 | Accessibility | 🟡 Partial | Sparse a11y | frontend-review.md | |
| 17.7 | FullCalendar resource views | 🔴 Missing | Custom calendar | | Premium license N/A |

---

## 18–20 NFR, testing, rollout, acceptance

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| 18.1 | 99.9% availability / p95 <2s | 🟡 Partial | Health probes, hardening | Module 19 | Not measured in prod |
| 18.2 | Test pyramid | 🟡 Partial | Smoke + regression + skeletons | `smoke-*.js`, `tests/` | No Vitest suite wired |
| 18.3 | Mandatory negative tests | 🟡 Partial | Some smoke coverage | | Incomplete vs PRD list |
| 19.5 | KiviHealth migration | 🔴 Missing | | | |
| 20.3 | Pilot acceptance scenarios 1–36 | 🟡 Partial | See gap analysis mapping | | Many fail (handoff, travel buffer, OTP, voice, cash close, GU/HI, AI, public queue) |

---

## Critical business rules (cross-cutting)

| PRD Section | Requirement | Status | Evidence | File(s) | Notes |
|-------------|-------------|--------|----------|---------|-------|
| Scheduling | No double booking | ✅ Complete | `AppointmentConflictService.assertNoConflicts` | | Doctor + patient |
| Pharmacy | Cannot dispense expired | ✅ Complete | InventoryService expired batch block | | |
| Billing | Cannot edit finalized invoice | ✅ Complete | `#assertDraft` | BillingService | |
| Billing | Cannot overpay | ✅ Complete | `Cannot overpay invoice` | BillingService | |
| EMR | Cannot edit signed consultation | ✅ Complete | `#assertEditable` | ConsultationService | |
| Treatment | Cannot exceed sessions | ✅ Complete | `#assertCanCreateSession` | TreatmentSessionService | |
| Inventory | Mutations via InventoryService only | ✅ Complete | Documented + callers | InventoryService | Seeds bypass |

---

## End-to-end workflow (PRD journey)

| Transition | Status | Evidence |
|---|---|---|
| Lead → Patient | ✅ | `POST /crm/leads/:id/convert`, `CrmService.convert`, LeadDetailPage |
| Patient → Appointment | ✅ | `POST /appointments`, book page |
| Appointment → Reception check-in | ✅ | `POST /reception/check-in/:id` |
| Check-in → Queue call | ✅ | `POST /queue/call-next` |
| Queue → Consultation start/sign | ✅ | `POST /consultations`, `/:id/sign` |
| Consultation → Prescription finalize | ✅ | `POST /prescriptions/:id/finalize` |
| Consultation → Treatment plan accept | ✅ | `POST /treatment-plans/:id/accept` |
| Plan/Visit → Invoice finalize/pay | ✅ | `POST /billing/:id/finalize`, `/payments` |
| Plan → Treatment session complete | ✅ | `POST /treatment-sessions/:id/complete` |
| Rx → Pharmacy dispense | ✅ | `POST /pharmacy/dispenses/:id/dispense` |
| Stock movements | ✅ | InventoryService paths |
| Reports / Analytics | ✅ | `/reports`, `/analytics` |
| Patient portal access | ✅ | `/patient/login`, `/portal` |

**Workflow verdict:** Core clinical–commercial chain is **wired end-to-end**. Gaps are depth (handoff structure, resources, approvals, real notifications, cash close, AI, native app), not missing backbone modules.

---

## Documentation vs implementation

| Doc | Matches code? | Notes |
|---|---|---|
| README | ✅ Mostly | Reflects Express/Mongo + modules 1–19 |
| ADR-001 | ✅ | Explains stack divergence from PRD §15 |
| Swagger/OpenAPI | 🟡 | Partial path coverage |
| Deployment / security / RTM docs | ✅ | Align with hardened state |
| PRD §15 monorepo layout | 🔴 vs code | Different structure by ADR |

---

*End of Requirements Traceability Matrix*
