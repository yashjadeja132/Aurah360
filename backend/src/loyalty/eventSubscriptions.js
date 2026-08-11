import { eventBus } from '../events/eventBus.js';
import logger from '../libs/logger.js';
import LoyaltyEarningEngineService from '../services/LoyaltyEarningEngineService.js';
import LoyaltyLedgerService from '../services/LoyaltyLedgerService.js';
import LoyaltyEarningRule from '../models/LoyaltyEarningRule.model.js';
import Invoice from '../models/Invoice.model.js';
import Patient from '../models/Patient.model.js';
import { LOYALTY_EARNING_EVENT, LOYALTY_SOURCE_REF_TYPE } from '../enums/loyalty.js';
import { BILLING_EVENTS } from '../enums/billing.js';
import { PATIENT_PORTAL_EVENTS } from '../enums/patientPortal.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Fallback ON_TIME_FOLLOW_UP grace window (days past dueDate) when no active rule version
 *  sets LoyaltyEarningRule.versions[].graceWindowDays — matches the recall worklist's own
 *  "still workable" feel rather than an arbitrarily tight same-day requirement. */
const DEFAULT_FOLLOW_UP_GRACE_DAYS = 3;

/**
 * LOY-004 — wires the earning engine (LoyaltyEarningEngineService.resolveAndCredit) up to the
 * domain events that already fire elsewhere in the codebase, per event E1-E12. Every handler is
 * wrapped in try/catch + logger.warn — a loyalty resolution failure must never take down (or
 * even be visible to) the primary flow that emitted the event.
 *
 * New emitDomain call sites added elsewhere for events nothing suitable already fired:
 *  - AppointmentLifecycleService.complete() -> 'AppointmentCompleted' (E1 VISIT_COMPLETED)
 *  - AppointmentLifecycleService.complete() -> 'FollowUpAppointmentCompleted' (E6
 *    ON_TIME_FOLLOW_UP) — fires only when the completed appointment is the
 *    `resultingAppointmentId` of a BOOKED RecallEntry (call-desk follow-up worklist).
 *  - PatientService update path -> 'PatientProfileUpdated' (E10 PROFILE_COMPLETION) — fires on
 *    every reception profile edit; this listener itself decides whether the configured field
 *    set just became fully complete.
 *
 * NOT wired here (documented, not silently skipped):
 *  - REFERRAL_REFERRER/REFERRAL_REFEREE (E5) — Patient.referredBy is a free-text field, not a
 *    patient reference, and CrmService's LeadConverted payload carries no referring-patient id.
 *    Pairing referrer/referee correctly requires a real referral-tracking model this task was
 *    not scoped to add; wiring would silently do the wrong thing, so it is left for the module
 *    that introduces proper referral tracking to call engine.resolveAndCredit() directly.
 *  - APP_REGISTRATION (E7) — patients are pre-registered by staff; there is no
 *    patient-self-registers-for-app flow/event in PatientAuthService to hook (only OTP login of
 *    an already-provisioned account).
 * These can be wired the same way once their upstream events/models exist.
 */
const engine = new LoyaltyEarningEngineService();
const ledger = new LoyaltyLedgerService();

/**
 * LOY-001 `earnOnRedeemedPortion` — should the part of a bill settled with the patient's own
 * points earn points again? Invoice.total is already NET of the redemption, so OFF (the default,
 * and the no-double-dip answer) needs no adjustment; ON adds the redeemed value back to the
 * earning base.
 */
async function earnableAmountFor(invoice, fallbackAmount) {
  const amount = Number(fallbackAmount) || 0;
  const redeemed = Number(invoice?.loyaltyRedemption?.valueInr) || 0;
  if (!redeemed) return amount;
  const settings = await ledger.getSettings();
  return settings?.earnOnRedeemedPortion ? amount + redeemed : amount;
}

function safeHandle(eventName, handler) {
  eventBus.on(eventName, async (payload) => {
    try {
      await handler(payload);
    } catch (err) {
      logger.warn('Loyalty event handler failed', { eventName, message: err.message });
    }
  });
}

export function registerLoyaltyEventListeners() {
  // E1 — VISIT_COMPLETED: appointment marked completed.
  safeHandle('AppointmentCompleted', async (payload) => {
    await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.VISIT_COMPLETED, {
      patientId: payload.patientId,
      branchId: payload.branchId,
      occurredAt: payload.completedAt || payload.emittedAt,
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.APPOINTMENT,
      sourceRefId: payload.appointmentId,
      idempotencyKey: payload.appointmentId ? `visit-completed:${payload.appointmentId}` : null,
    });
  });

  // E2/E4 — SPEND_BASED on every PAID invoice; PACKAGE_PURCHASE additionally when the invoice
  // carries a package snapshot.
  //
  // Deliberately InvoicePaid, not InvoiceFinalized: points are a reward for money actually
  // received. Accruing at finalize granted points against an invoice that might never be paid
  // (and, once voided, left points behind that only the clawback path could chase).
  safeHandle(BILLING_EVENTS.INVOICE_PAID, async (payload) => {
    const invoice = await Invoice.findById(payload.invoiceId)
      .select('branchId packageSnapshot total loyaltyRedemption')
      .lean();
    if (!invoice) return;

    await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.SPEND_BASED, {
      patientId: payload.patientId,
      branchId: invoice.branchId,
      amountInr: await earnableAmountFor(invoice, payload.total ?? invoice.total),
      occurredAt: payload.emittedAt,
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
      sourceRefId: payload.invoiceId,
      idempotencyKey: `spend-based:${payload.invoiceId}`,
    });

    if (invoice.packageSnapshot?.packageId) {
      await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.PACKAGE_PURCHASE, {
        patientId: payload.patientId,
        branchId: invoice.branchId,
        amountInr: invoice.packageSnapshot.packagePrice ?? invoice.total,
        packageId: invoice.packageSnapshot.packageId,
        occurredAt: payload.emittedAt,
        sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
        sourceRefId: payload.invoiceId,
        idempotencyKey: `package-purchase:${payload.invoiceId}`,
      });
    }
  });

  // E3 — TREATMENT_SESSION_COMPLETED.
  safeHandle('TreatmentSessionCompleted', async (payload) => {
    await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.TREATMENT_SESSION_COMPLETED, {
      patientId: payload.patientId,
      branchId: payload.branchId,
      occurredAt: payload.emittedAt,
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.TREATMENT_SESSION,
      sourceRefId: payload.sessionId,
      idempotencyKey: payload.sessionId ? `treatment-session:${payload.sessionId}` : null,
    });
  });

  // E8 — REVIEW_SUBMITTED: patient feedback/review submission. Payload carries no branchId, so
  // fall back to the patient's primary branch.
  safeHandle(PATIENT_PORTAL_EVENTS.FEEDBACK_SUBMITTED, async (payload) => {
    const branchId =
      payload.branchId || (await Patient.findById(payload.patientId).select('primaryBranchId').lean())?.primaryBranchId;
    if (!branchId) return;
    await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.REVIEW_SUBMITTED, {
      patientId: payload.patientId,
      branchId,
      occurredAt: payload.emittedAt,
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.FEEDBACK,
      sourceRefId: payload.feedbackId,
      idempotencyKey: payload.feedbackId ? `review-submitted:${payload.feedbackId}` : null,
    });
  });

  // E6 — ON_TIME_FOLLOW_UP: a recall-worklist follow-up appointment completed within the rule's
  // grace window of its RecallEntry.dueDate. idempotencyKey is keyed on the recallEntryId (not
  // the appointmentId) — the same appointment cannot double-fulfil two recalls, but this also
  // means a rescheduled/reused recall never double-credits even if resultingAppointmentId is
  // rewritten later.
  safeHandle('FollowUpAppointmentCompleted', async (payload) => {
    if (!payload.dueDate) return;
    const rule = await LoyaltyEarningRule.findOne({
      eventType: LOYALTY_EARNING_EVENT.ON_TIME_FOLLOW_UP,
      isActive: true,
      deletedAt: null,
    });
    const version = rule?.activeVersionAt(new Date(payload.completedAt || Date.now()));
    const graceDays = Number.isFinite(version?.graceWindowDays)
      ? version.graceWindowDays
      : DEFAULT_FOLLOW_UP_GRACE_DAYS;

    const dueDate = new Date(payload.dueDate);
    const completedAt = new Date(payload.completedAt || Date.now());
    const graceDeadline = new Date(dueDate.getTime() + graceDays * MS_PER_DAY);
    if (completedAt > graceDeadline) return; // completed too late — no bonus, no error

    await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.ON_TIME_FOLLOW_UP, {
      patientId: payload.patientId,
      branchId: payload.branchId,
      occurredAt: payload.completedAt,
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.APPOINTMENT,
      sourceRefId: payload.appointmentId,
      idempotencyKey: `on-time-followup:${payload.recallEntryId}`,
    });
  });

  // E10 — PROFILE_COMPLETION (one-time): fires every time a patient profile is saved; the engine's
  // ONE_TIME_ONLY_RULE_CODES_CHECK_EVENTS guard (LoyaltyEarningEngineService) makes repeat fires
  // harmless no-ops once credited, so this listener only needs to decide "is the configured field
  // set complete as of *this* save" — it does not need to track "was it already complete before".
  safeHandle('PatientProfileUpdated', async (payload) => {
    if (!payload.patientId || !payload.branchId) return;
    const rule = await LoyaltyEarningRule.findOne({
      eventType: LOYALTY_EARNING_EVENT.PROFILE_COMPLETION,
      isActive: true,
      deletedAt: null,
    });
    const version = rule?.activeVersionAt(new Date());
    if (!rule || !version) return;

    const fields = version.profileCompletionFields?.length
      ? version.profileCompletionFields
      : ['firstName', 'lastName', 'mobile', 'email', 'dateOfBirth', 'gender', 'address.addressLine1'];

    const patient = await Patient.findById(payload.patientId).select(fields.join(' ')).lean();
    if (!patient) return;
    const isComplete = fields.every((path) => {
      const value = path.split('.').reduce((acc, key) => acc?.[key], patient);
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
    if (!isComplete) return;

    await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.PROFILE_COMPLETION, {
      patientId: payload.patientId,
      branchId: payload.branchId,
      occurredAt: payload.emittedAt,
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.MANUAL,
      sourceRefId: payload.patientId,
      // No idempotencyKey needed — the engine's one-time-only ledger check is authoritative.
      idempotencyKey: null,
    });
  });

  logger.info('Loyalty earning-engine event listeners registered');
}

export default { registerLoyaltyEventListeners };
