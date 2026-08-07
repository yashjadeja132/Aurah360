# Final Gap Analysis — PRD vs Implementation

**PRD:** Aurah 360 ClinicOS Case Study / PRD / SRS v1.0 (04 Aug 2026)  
**Codebase:** `aurah360-clinicos` (Modules 1–19 + RC1 hardening)  
**Date:** 2026-08-06  
**Companion RTM:** [`docs/requirements-traceability-report.md`](./requirements-traceability-report.md)

---

## 1. Executive verdict

The implementation is a **working single-clinic web ClinicOS** with an end-to-end clinical–commercial workflow (Lead → Portal). It does **not** yet satisfy the full PRD as a multi-branch, multi-resource, privacy-grade, multi-channel, AI-assisted, native-app product.

| Lens | Assessment |
|---|---|
| Against **full PRD** (all phases) | **~48% complete** |
| Against **PRD MVP / pilot** (§2.3 MVP column) | **~62% complete** |
| Against **shipped product intent** (ADR single-clinic web) | **~78% ready** for controlled internal pilot after P0 security ops |
| Ready for **client UAT against full PRD** | **No** — many acceptance scenarios (20.3) will fail |
| Ready for **internet-facing production** | **No** — public uploads, no MFA, mock communications, consent/privacy gaps |

---

## 2. Totals (RTM line items)

Counted from the Requirements Traceability Matrix (unique PRD requirements / discrete checks).

| Status | Count | % of tracked |
|---|---:|---:|
| ✅ Complete | 52 | 28% |
| 🟡 Partial | 86 | 46% |
| 🔴 Missing | 38 | 20% |
| ⚪ Out of Scope / intentional non-goal | 12 | 6% |
| **Total tracked** | **188** | 100% |

**Completion % (Complete only):** **28%** of full PRD tracked items  
**Completion % (Complete + Partial usable):** **74%** have some implementation  
**Strict MVP completion (Complete / MVP-relevant subset ≈ 95 items):** **~45 Complete + ~40 Partial + ~10 Missing → ~47% fully done, ~89% started**

---

## 3. Module completion %

| Module / PRD area | Complete | Partial | Missing | Module score* |
|---|---:|---:|---:|---:|
| Auth / RBAC (core roles) | High | MFA/Auditor | MFA, Auditor | **75%** |
| Branches / Doctors / Scheduling | Med | Travel, rooms/devices | Rooms/devices masters | **60%** |
| Patients / Reception | Med | Handoff, merge, consents | Merge, rights workflow | **65%** |
| Appointments / Queue | Med | Approval states, public board | Pending approval, waitlist | **60%** |
| Documents / Photos | Low-Med | Metadata/upload | Malware, signed private URLs, restricted areas | **40%** |
| EMR / Consultation | Med-High | Amend, copy-forward, note classes | Amend trail | **70%** |
| AI Copilot | — | — | All (placeholder) | **5%** |
| Treatment / Packages | Med | Checklist, patch test, adverse | Patch test, adverse event | **55%** |
| Rx / Pharmacy / Inventory | High | Transfer workflow depth | — | **85%** |
| Billing | Med-High | Refund, cash close, GST | Cash close | **70%** |
| CRM | Med | Offers, real WhatsApp | Offer board, WhatsApp approval | **55%** |
| Notifications | Med | Mock providers | Voice, DLT real, WhatsApp real | **45%** |
| Patient access | Med (web) | Portal vs native | Expo app, OTP, i18n | **40%** |
| Reports / Analytics | Med-High | PDF, widget completeness | AI/security report groups | **75%** |
| Privacy / Security / BCM | Med | Hardening done | MFA, private files, rights cases | **50%** |
| Localization / UX a11y | Low | — | GU/HI | **20%** |

\*Score = qualitative Complete-weighted estimate for that domain vs PRD depth.

---

## 4. Production readiness %

| Gate | % | Comment |
|---|---:|---|
| Core workflow usability (staff web) | **80%** | Chain works |
| PRD MVP functional completeness | **62%** | See gaps |
| Security / privacy production bar (PRD §16) | **45%** | Uploads, MFA, CSRF, consents |
| Communications production bar | **25%** | Mocks only |
| Ops (backup/DR/monitoring) | **55%** | Health OK; backup placeholder |
| **Overall production readiness vs full PRD** | **~42%** | |
| **Controlled pilot readiness (single branch, staff-only, mock SMS)** | **~70%** | If P0 blockers mitigated |

---

## 5. Top 20 missing features

1. Organization / multi-tenant isolation (ORG-001/007) — intentionally omitted  
2. Room & device masters + collision scheduling  
3. Cross-branch **travel buffer**  
4. Appointment **Pending Approval / Requested** state machine  
5. Structured **Front Desk Handoff** (category, urgency, acknowledgment)  
6. Patient **merge** (non-destructive review) — placeholder  
7. **Public least-PII queue board**  
8. Private **signed URL** file access + **malware scan**  
9. Restricted clinical photo body-area policy (server-side)  
10. Consultation **amend/addendum** trail  
11. Treatment **guided checklist**, **patch test**, **adverse event**  
12. Billing **cash close** + real **refund** workflow  
13. Real **WhatsApp** templates + reschedule approval  
14. **DLT SMS** production validation  
15. **Voice** reminders  
16. CRM **offer board**  
17. Native **Android/iOS** patient app (Expo)  
18. Patient **OTP** login (placeholder)  
19. Staff **MFA** / step-up / break-glass  
20. **Gujarati / Hindi** localization  

---

## 6. Top 20 risks

1. Public `/uploads` exposes clinical files if used for PHI photos  
2. Mock WhatsApp/SMS → false confidence in “notifications done”  
3. Missing MFA on Owner/Admin  
4. No CSRF strategy with cookie credentials  
5. Consent model too shallow for DPDP (no versioned withdrawal history)  
6. Incomplete handoff → clinical safety / communication loss  
7. Cross-branch double-booking residual risk without travel buffer / resources  
8. Refund/cash-close gaps → finance mismatch  
9. Patch-test / adverse-event absence → treatment safety gap  
10. Patient merge placeholder → duplicate clinical risk  
11. AI stubs if accidentally enabled without governance  
12. Stack divergence from PRD may surprise stakeholders expecting Nest/Postgres  
13. Single-clinic vs PRD multi-org messaging mismatch  
14. Calendar not FullCalendar Premium — resource views absent  
15. No KiviHealth migration path for cutover  
16. AuditLog unbounded growth  
17. N+1 list queries under load  
18. PDF export placeholder for compliance packs  
19. Localization missing → pilot acceptance scenario #36 fails  
20. Scope creep if Phase 2/3 treated as MVP blockers without re-baseline  

---

## 7. Top technical debt

1. `ReportService.js` mega-service + Model bypass (~1151 lines)  
2. Dual reporting stacks (M16 `/reports` + M18 `/analytics`)  
3. Validator / sequence-helper duplication  
4. N+1 populate patterns on list endpoints  
5. Public local file serving  
6. Placeholder sprawl (PDF, AI, cloud, merge, refund, OTP, e-sign)  
7. Test runner not wired (smoke-only)  
8. Incomplete OpenAPI coverage  
9. Frontend Zod coverage uneven  
10. Appointment status model simpler than PRD state machine  

---

## 8. Top refactoring opportunities

1. Extract report query repositories; split ReportService  
2. Private file gateway (auth + signed URLs); remove public static PHI  
3. Introduce `validators/common.js` migration across modules  
4. Unify analytics product surface (or document M16 legacy clearly)  
5. Appointment status machine upgrade (Requested / Pending Approval)  
6. HandoffNote first-class entity  
7. Resource (Room/Device) domain + availability intersection  
8. Collapse N+1 via populated aggregates  
9. Wire Vitest + expand permission/workflow tests  
10. i18n framework (en/gu/hi) before Surat pilot training  

---

## 9. Security issues (evidence-backed)

| Issue | Severity | Evidence |
|---|---|---|
| Public static uploads | **Critical** | `app.js` → `express.static('/uploads')` |
| No MFA | **High** | No MFA implementation; PRD SEC-002 |
| CSRF readiness | **High** | No CSRF middleware; cookie+CORS credentials |
| MIME-only uploads | **High** | `upload.middleware.js`; no magic-byte/malware |
| Refresh reuse detection | **Medium** | Rotation without reuse family revoke |
| Consent catalogue shallow | **High** (privacy) | Boolean flags only |
| Swagger in non-prod OK; ensure prod off | **Medium** | Env default fixed in Module 19 |

---

## 10. Performance issues

- N+1 list/populate loops (appointments, consultations, plans, billing lists)  
- Heavy analytics aggregations without full covering indexes including `deletedAt`  
- Report export hard limits (500–2000) without cursor pagination  
- Frontend improved via lazy routes (RC1) — charts still large chunk  

---

## 11. Architecture issues

| PRD expectation | Implementation | Gap type |
|---|---|---|
| NestJS / Postgres / Prisma | Express / Mongo / Mongoose | ADR-accepted divergence |
| Next.js staff app | Vite React SPA | ADR |
| Expo patient app | React web portal | Phase 2 substitute |
| Organization scoping | Branch-only single clinic | Product decision vs PRD |
| S3 private files | Local + placeholders | Partial |
| Outbox / idempotency | Direct emit / conflict checks | Missing |

Layering (Route → Validation → Controller → Service → Repository) is **generally followed** for clinical modules; reports/analytics/portal often query Models directly (documented debt).

---

## 12. Placeholder features

| Feature | Location |
|---|---|
| Patient merge | `PatientMergeService.js` |
| Recurring appointments | `RecurringAppointmentService.js` |
| Queue branch transfer | `QueueService.js` |
| Cloud storage S3/Azure/GCS | `CloudStoragePlaceholder.js` |
| PDF export | `ExportService.toPdfPlaceholder` |
| AI consultations / AI reports | `ConsultationAiInterface.js`, `AiReportPlaceholderService.js` |
| OTP / email verify | `PatientAuthService` |
| Portal PDF / refill | `PatientPortalService` |
| Billing refund / email / WhatsApp | `BillingService`, billing routes |
| CRM communication log | `CrmService` |
| DB backup/restore | `scripts/db/*placeholder*` |
| Analytics email digests | `analyticsJobs.js` |
| Heatmap chart | `ChartKit.jsx` |
| Treatment plan e-sign UI | `TreatmentPlanBuilderPage.jsx` |
| Barcode scan UI | `DispenseScreenPage.jsx` |
| Forgot password | `ForgotPasswordPage.jsx` |

---

## 13. Mock features

| Feature | Location |
|---|---|
| Email / SMS / WhatsApp / Push providers | `backend/src/notifications/providers.js` |
| Notification delivery in production sense | Documented “mock adapters only” in NotificationService |

---

## 14. Pilot acceptance scenarios (PRD §20.3) — pass forecast

| # | Scenario | Forecast |
|---:|---|---|
| 1 | New walk-in registration | 🟡 Likely pass with training |
| 2 | Returning check-in ≤60s | 🟡 Likely |
| 3 | Shared family mobile / dependent | 🔴 Likely fail |
| 4 | Reception handoff structured + ack | 🔴 Fail (notes only) |
| 5 | Cross-branch + travel buffer | 🔴 Fail |
| 6 | Patient self-booking | 🟡 Web portal only |
| 7 | Pending reschedule approval | 🔴 Fail |
| 8 | Queue + public mask | 🔴 Fail public mode |
| 9–12 | Docs/photos governance | 🟡/🔴 Partial |
| 13 | Consultation draft | 🟡 Pass basic |
| 14–15 | AI | 🔴 Fail (not implemented) |
| 16–18 | Rx / follow-up / treatment order | 🟡 Pass basic |
| 19–21 | Treatment hard stop / adverse | 🔴 Fail |
| 22–24 | Pharmacy / transfer | 🟡 Pass basic |
| 25–26 | Invoice / discount-refund | 🟡 / 🔴 refund |
| 27 | Cash close | 🔴 Fail |
| 28–29 | Reminders / marketing opt-out | 🔴/🟡 Mocks |
| 30 | Patient app released timeline | 🟡 Web portal |
| 31–32 | Reports / role restriction | 🟡 Likely |
| 33 | Staff termination revoke | 🟡 Partial (JWT TTL) |
| 34–35 | Backup / migration | 🔴 Fail |
| 36 | Gujarati / mobile usability | 🔴 Fail i18n |

**Approx. pass rate if UAT run today against §20.3:** **~30–40% clear passes**, rest fail or conditional.

---

## 15. Future enhancements (aligned to PRD phases)

**Stabilize MVP (before Surat pilot)**  
Private files, MFA for Owner/Admin, real SMS or documented offline comms, handoff entity, cash close, refund, travel buffer, pending-approval appointments, consent versioning.

**Phase 2**  
Expo patient app, WhatsApp Business + DLT, offer board, AI gateway with governance, before/after comparison UX, push notifications.

**Phase 3**  
ABDM/FHIR, image-assist AI, lab integration, teleconsult, multi-organization SaaS controls.

---

## 16. Duplicate implementations

| Area | Duplication |
|---|---|
| Reports | Module 16 `/reports` vs Module 18 `/analytics` |
| KPI / filters UI | Reports vs Analytics components |
| Sequence number helpers | ~10 near-identical helpers |
| Zod objectId / emptyToNull | Many validators (common.js started) |

---

## 17. Recommendations for sign-off

1. **Re-baseline the contract:** Publish a “ClinicOS Web MVP Scope” addendum that accepts ADR stack + single-clinic + web portal (not Expo) + mock notifications for pilot.  
2. **Do not sign full PRD UAT** until Top 20 missing features for MVP are closed or formally waived.  
3. **P0 before any internet exposure:** private uploads, `COOKIE_SECURE`, MFA for Owner, disable Swagger, rotate seeds.  
4. Use RTM statuses as the backlog; do not start new business modules until MVP gaps are triaged.  

---

## 18. Sign-off statement

> Based on code inspection against `aurah_prd.md`, Aurah 360 ClinicOS **implements a substantial operational backbone** (RBAC, patients, scheduling, queue, EMR, Rx, treatment plans/sessions, inventory/pharmacy, billing, CRM, notifications framework, reports/analytics, patient web portal, production hardening).  
> It is **not yet PRD-complete**. Critical PRD capabilities (resource scheduling, structured handoff, appointment approval states, real telecom channels, privacy-grade file access, MFA, cash close, adverse events, native app, localization, AI) remain **missing, partial, or placeholder**.  
> **Recommendation:** Conditional pilot only after security P0s and written scope waiver; full production sign-off against the PRD is **not justified** at this time.

---

*Generated from evidence-based code audit. No code was modified for this report.*
