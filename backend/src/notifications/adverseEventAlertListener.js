import User from '../models/User.model.js';
import NotificationService from '../services/NotificationService.js';
import { eventBus } from '../events/eventBus.js';
import { TREATMENT_SESSION_EVENTS, ADVERSE_EVENT_SEVERITY } from '../enums/treatmentSession.js';
import { ROLES } from '../constants/roles.js';
import { NOTIFICATION_CHANNEL } from '../enums/notification.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';
import logger from '../libs/logger.js';

/**
 * TRT-006 — an adverse event must alert staff immediately; it must never be visible only to
 * someone who happens to open the Treatment Safety page. The AdverseEvent model's own comment
 * is explicit: "Cannot be hidden by completing billing." NotificationService.queueEvent only
 * targets a single patient/user, so this listener resolves the branch's doctors/admins and
 * fans out one high-priority IN_APP alert per recipient, plus a live socket broadcast for any
 * already-open staff dashboard. The resulting Notification records are never touched by
 * billing/invoice events — they are only meant to be worked through the AdverseEvent's own
 * OPEN/ESCALATED/UNDER_REVIEW/RESOLVED/CLOSED workflow.
 */
const ALERT_ROLES = Object.freeze([ROLES.DOCTOR, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.OWNER]);

const SEVERITY_LABEL = Object.freeze({
  [ADVERSE_EVENT_SEVERITY.MILD]: 'Mild',
  [ADVERSE_EVENT_SEVERITY.MODERATE]: 'Moderate',
  [ADVERSE_EVENT_SEVERITY.SEVERE]: 'Severe',
  [ADVERSE_EVENT_SEVERITY.LIFE_THREATENING]: 'Life-threatening',
});

async function handleAdverseEventReported(payload = {}) {
  const { adverseEventId, branchId, patientId, severity } = payload;
  if (!adverseEventId) return;

  try {
    const staff = await User.find({
      branch: branchId || null,
      role: { $in: ALERT_ROLES },
      isActive: true,
      deletedAt: null,
    })
      .select('_id')
      .lean();

    const severityLabel = SEVERITY_LABEL[severity] || severity || 'Unknown severity';
    const subject = `URGENT: Adverse event reported (${severityLabel})`;
    const message =
      `A ${severityLabel.toLowerCase()} adverse event was reported and needs clinical review. ` +
      'Open the Treatment Safety workflow to acknowledge it — this alert is independent of ' +
      'billing/invoice status and can only be resolved through the adverse event\'s own workflow.';

    const notificationService = new NotificationService();
    for (const user of staff) {
      await notificationService.queueEvent({
        eventName: TREATMENT_SESSION_EVENTS.ADVERSE_EVENT_REPORTED,
        userId: user._id.toString(),
        channels: [NOTIFICATION_CHANNEL.IN_APP],
        variables: {
          subject,
          message,
          summary: subject,
          adverseEventId,
          patientId: patientId || null,
          branchId: branchId || null,
          severity: severity || null,
        },
      });
    }

    // Live push for any already-open staff dashboard (queue board / branch room), mirroring
    // how inventory low-stock/near-expiry alerts already broadcast over the same socket channel.
    emitQueueEvent(SOCKET_EVENTS.ADVERSE_EVENT_REPORTED, {
      adverseEventId,
      patientId: patientId || null,
      branchId: branchId || null,
      severity: severity || null,
      subject,
    });

    logger.info('Adverse event alert dispatched', {
      adverseEventId,
      branchId,
      severity,
      recipients: staff.length,
    });
  } catch (err) {
    logger.warn('Adverse event alert handler failed', {
      adverseEventId,
      message: err.message,
    });
  }
}

export function registerAdverseEventAlertListeners() {
  eventBus.on(TREATMENT_SESSION_EVENTS.ADVERSE_EVENT_REPORTED, handleAdverseEventReported);
  logger.info('Adverse event alert listener registered');
}

export default registerAdverseEventAlertListeners;
