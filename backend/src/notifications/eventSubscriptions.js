import { eventBus } from '../events/eventBus.js';
import NotificationService from '../services/NotificationService.js';
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

export function registerNotificationEventListeners() {
  const service = new NotificationService();

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
