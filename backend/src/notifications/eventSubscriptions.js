import { eventBus } from '../events/eventBus.js';
import NotificationService from '../services/NotificationService.js';
import ConsentService from '../services/ConsentService.js';
import User from '../models/User.model.js';
import Patient from '../models/Patient.model.js';
import Notification from '../models/Notification.model.js';
import PatientFeedback from '../models/PatientFeedback.model.js';
import { ROLES } from '../constants/roles.js';
import { LOYALTY_EVENTS } from '../enums/loyalty.js';
import { NOTIFICATION_CHANNEL } from '../enums/notification.js';
import { CONSENT_PURPOSE, CONSENT_STATE } from '../enums/privacy.js';
import logger from '../libs/logger.js';

/**
 * Subscribe NotificationService to domain events.
 * Events not yet emitted by modules are still registered for future use.
 */
const SUBSCRIBED_EVENTS = [
  'AppointmentCreated',
  'AppointmentConfirmed',
  'PatientCheckedIn',
  'ConsultationSigned',
  'PrescriptionFinalized',
  'TreatmentPlanAccepted',
  'InvoiceCreated',
  'InvoiceFinalized',
  'InvoicePaid',
  'TreatmentSessionCompleted',
  'LeadCreated',
  'LeadConverted',
  'FollowUpDue',
  'LoyaltyPointsExpiringSoon',
];

function pickVariables(eventName, payload = {}) {
  return {
    ...payload,
    summary: payload.summary || eventName,
    invoiceNumber: payload.invoiceNumber || payload.invoice?.invoiceNumber || '',
    leadNumber: payload.leadNumber || '',
    sessionNumber: payload.sessionNumber || '',
    patientName: payload.patientName || '',
    mrn: payload.mrn || '',
  };
}

/**
 * LOY — roles that hold loyalty.adjust_approve by default (see constants/rolePermissions.js).
 * An adjustment parked in PENDING_APPROVAL is invisible until someone opens the queue, so the
 * approvers are alerted the same way adverseEventAlertListener.js fans an alert out to staff:
 * queueEvent targets a single recipient, so we resolve the approvers and queue one IN_APP
 * notification each. patientId is deliberately NOT set — this is a staff alert, not a patient one.
 */
const LOYALTY_APPROVER_ROLES = Object.freeze([ROLES.OWNER, ROLES.ADMIN, ROLES.BRANCH_MANAGER]);

async function handleLoyaltyAdjustmentPendingApproval(service, payload = {}) {
  const { adjustmentRequestId, patientId, points, direction, branchId } = payload;
  if (!adjustmentRequestId) return;

  const query = { role: { $in: LOYALTY_APPROVER_ROLES }, isActive: true, deletedAt: null };
  if (branchId) query.branch = branchId;
  const approvers = await User.find(query).select('_id').lean();

  const subject = 'Loyalty adjustment awaiting approval';
  const message =
    `A manual loyalty ${String(direction || '').toLowerCase() || 'adjustment'} of ${points ?? 0} points ` +
    'exceeds the requester\'s own limit and is waiting in the loyalty adjustment approval queue.';

  for (const user of approvers) {
    await service.queueEvent({
      eventName: LOYALTY_EVENTS.ADJUSTMENT_PENDING_APPROVAL,
      userId: user._id.toString(),
      channels: [NOTIFICATION_CHANNEL.IN_APP],
      variables: {
        subject,
        message,
        summary: subject,
        adjustmentRequestId,
        patientId: patientId || null,
        points: points ?? 0,
        direction: direction || null,
      },
    });
  }

  logger.info('Loyalty adjustment approval alert dispatched', {
    adjustmentRequestId,
    recipients: approvers.length,
  });
}

/**
 * LOY edge rule — a refund/void clawback that can't fully recover spend-points earned on the
 * invoice is left as a pending-clawback shortfall (see LoyaltyLedgerService#clawback). Nobody
 * polls that state, so the same approver roles used for adjustment approvals are alerted here.
 */
/**
 * SEC-002/PRV — break-glass access ("reason + recent MFA + short expiry + privacy alert" per
 * spec) previously emitted `BreakGlassUsed` with zero listeners. There is no PRIVACY_OFFICER
 * role in constants/roles.js today, so Owner/Admin — the only roles able to view the
 * break-glass grant log — are alerted, mirroring the loyalty-approval fan-out above.
 */
const BREAK_GLASS_ALERT_ROLES = Object.freeze([ROLES.OWNER, ROLES.ADMIN]);

async function handleBreakGlassUsed(service, payload = {}) {
  const { breakGlassId, userId, patientId, reason } = payload;
  if (!breakGlassId) return;

  const recipients = await User.find({
    role: { $in: BREAK_GLASS_ALERT_ROLES },
    isActive: true,
    deletedAt: null,
  })
    .select('_id')
    .lean();

  const subject = 'Break-glass access used';
  const message =
    `A staff member used break-glass emergency access${patientId ? ' on a patient record' : ''}. ` +
    `Reason given: "${reason || 'none provided'}".`;

  for (const user of recipients) {
    if (user._id.toString() === String(userId)) continue; // don't alert the actor about their own action
    await service.queueEvent({
      eventName: 'BreakGlassUsed',
      userId: user._id.toString(),
      channels: [NOTIFICATION_CHANNEL.IN_APP],
      variables: {
        subject,
        message,
        summary: subject,
        breakGlassId,
        patientId: patientId || null,
        reason: reason || null,
        usedByUserId: userId || null,
      },
    });
  }

  logger.info('Break-glass privacy alert dispatched', {
    breakGlassId,
    recipients: recipients.length,
  });
}

async function handleLoyaltyClawbackPending(service, payload = {}) {
  const { patientId, shortfall, sourceRefType, sourceRefId, branchId } = payload;
  if (!shortfall) return;

  const query = { role: { $in: LOYALTY_APPROVER_ROLES }, isActive: true, deletedAt: null };
  if (branchId) query.branch = branchId;
  const approvers = await User.find(query).select('_id').lean();

  const subject = 'Loyalty clawback could not be fully recovered';
  const message =
    `A refund/void clawback on ${sourceRefType || 'an invoice'} ${sourceRefId || ''} could not ` +
    `recover ${shortfall} loyalty point(s) — the patient's balance was insufficient. Manual review required.`;

  for (const user of approvers) {
    await service.queueEvent({
      eventName: LOYALTY_EVENTS.CLAWBACK_PENDING,
      userId: user._id.toString(),
      channels: [NOTIFICATION_CHANNEL.IN_APP],
      variables: {
        subject,
        message,
        summary: subject,
        patientId: patientId || null,
        shortfall,
        sourceRefType: sourceRefType || null,
        sourceRefId: sourceRefId || null,
      },
    });
  }

  logger.info('Loyalty clawback shortfall alert dispatched', {
    sourceRefType,
    sourceRefId,
    shortfall,
    recipients: approvers.length,
  });
}

/**
 * CRM-001 — auto-request NPS/feedback after a visit is marked Completed. Fires off
 * AppointmentLifecycleService.complete()'s 'AppointmentCompleted' emit, same event the loyalty
 * E1 VISIT_COMPLETED handler subscribes to (loyalty/eventSubscriptions.js).
 *
 * Consent — NPS/feedback requests are a service-adjacent communication about the visit the
 * patient just had, not an outbound marketing push, so they are NOT gated on marketingConsent
 * (same "service messages aren't suppressed by marketing opt-out" rule NotificationService
 * already applies via TRANSACTIONAL_TEMPLATE_CODES/FEEDBACK_REQUEST). What DOES gate it is an
 * explicit SERVICE_MESSAGES withdrawal — a patient who has explicitly opted out of service
 * messages (privacy consent ledger, ConsentService) must not get this either. Absent any
 * explicit consent record either way, the request proceeds (default-allowed, matching every
 * other transactional notification in this codebase).
 *
 * Idempotency — skipped if a feedback request notification, or an actual PatientFeedback
 * submission, already exists for this appointmentId.
 */
const consentService = new ConsentService();

async function handleAppointmentCompletedFeedbackRequest(service, payload = {}) {
  const { appointmentId, patientId } = payload;
  if (!appointmentId || !patientId) return;

  const [existingRequest, existingFeedback] = await Promise.all([
    Notification.findOne({ eventName: 'FeedbackRequested', 'variables.appointmentId': appointmentId })
      .select('_id')
      .lean(),
    PatientFeedback.findOne({ appointmentId }).select('_id').lean(),
  ]);
  if (existingRequest || existingFeedback) return;

  const states = await consentService.currentStates(patientId);
  const serviceMessagesWithdrawn = states.some(
    (s) => s.purpose === CONSENT_PURPOSE.SERVICE_MESSAGES && s.state === CONSENT_STATE.WITHDRAWN
  );
  if (serviceMessagesWithdrawn) return;

  const patient = await Patient.findById(patientId).select('firstName lastName').lean();
  const patientName = patient ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') : '';

  await service.sendFeedbackRequest({ patientId, appointmentId, patientName });
}

export function registerNotificationEventListeners() {
  const service = new NotificationService();

  eventBus.on('AppointmentCompleted', async (payload) => {
    try {
      await handleAppointmentCompletedFeedbackRequest(service, payload);
    } catch (err) {
      logger.warn('Notification event handler failed', {
        eventName: 'AppointmentCompleted:FeedbackRequest',
        message: err.message,
      });
    }
  });

  eventBus.on(LOYALTY_EVENTS.ADJUSTMENT_PENDING_APPROVAL, async (payload) => {
    try {
      await handleLoyaltyAdjustmentPendingApproval(service, payload);
    } catch (err) {
      logger.warn('Notification event handler failed', {
        eventName: LOYALTY_EVENTS.ADJUSTMENT_PENDING_APPROVAL,
        message: err.message,
      });
    }
  });

  eventBus.on(LOYALTY_EVENTS.CLAWBACK_PENDING, async (payload) => {
    try {
      await handleLoyaltyClawbackPending(service, payload);
    } catch (err) {
      logger.warn('Notification event handler failed', {
        eventName: LOYALTY_EVENTS.CLAWBACK_PENDING,
        message: err.message,
      });
    }
  });

  eventBus.on('BreakGlassUsed', async (payload) => {
    try {
      await handleBreakGlassUsed(service, payload);
    } catch (err) {
      logger.warn('Notification event handler failed', {
        eventName: 'BreakGlassUsed',
        message: err.message,
      });
    }
  });

  for (const eventName of SUBSCRIBED_EVENTS) {
    eventBus.on(eventName, async (payload) => {
      try {
        await service.queueEvent({
          eventName,
          variables: pickVariables(eventName, payload),
          patientId: payload.patientId || null,
          userId: payload.userId || payload.assignedTo || null,
        });
      } catch (err) {
        logger.warn('Notification event handler failed', {
          eventName,
          message: err.message,
        });
      }
    });
  }

  logger.info('Notification event listeners registered', {
    events: SUBSCRIBED_EVENTS.length,
  });
}

export default registerNotificationEventListeners;
