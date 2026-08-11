import { Router } from 'express';
import PatientPortalController from '../../controllers/PatientPortalController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticatePatient } from '../../middlewares/patientAuth.middleware.js';
import {
  idParamSchema,
  paymentIdParamSchema,
  loginSchema,
  refreshSchema,
  forgotSchema,
  changePasswordSchema,
  profileUpdateSchema,
  bookAppointmentSchema,
  cancelSchema,
  rescheduleSchema,
  feedbackSchema,
  requestOtpSchema,
  otpLoginSchema,
  dependentIdParamSchema,
  submitPrivacyRequestSchema,
} from '../../validators/patientPortal.validator.js';
import { authRateLimiter } from '../../middlewares/security.middleware.js';

const router = Router();
const controller = new PatientPortalController();

/** Public auth */
router.post('/login', validate({ body: loginSchema }), controller.login);
router.post('/refresh', validate({ body: refreshSchema }), controller.refresh);
router.post('/forgot-password', validate({ body: forgotSchema }), controller.forgotPassword);
router.post('/otp-request', authRateLimiter(), validate({ body: requestOtpSchema }), controller.requestOtp);
router.post('/otp-login', authRateLimiter(), validate({ body: otpLoginSchema }), controller.otpLogin);
router.post('/verify-email', controller.verifyEmail);

/** Authenticated patient portal */
router.use(authenticatePatient);

router.post('/logout', controller.logout);
router.get('/me', controller.me);
router.post('/change-password', validate({ body: changePasswordSchema }), controller.changePassword);

router.get('/dashboard', controller.dashboard);

/** Dependent/guardian switching (APP-006) */
router.get('/dependents', controller.listDependents);
router.get(
  '/dependents/:dependentId/dashboard',
  validate({ params: dependentIdParamSchema }),
  controller.dependentDashboard
);
router.get(
  '/dependents/:dependentId/appointments',
  validate({ params: dependentIdParamSchema }),
  controller.dependentAppointments
);
router.post(
  '/dependents/:dependentId/appointments',
  validate({ params: dependentIdParamSchema, body: bookAppointmentSchema }),
  controller.bookDependentAppointment
);
router.get(
  '/dependents/:dependentId/invoices',
  validate({ params: dependentIdParamSchema }),
  controller.dependentInvoices
);
router.get(
  '/dependents/:dependentId/documents',
  validate({ params: dependentIdParamSchema }),
  controller.dependentDocuments
);
router.get(
  '/dependents/:dependentId/treatment-plans',
  validate({ params: dependentIdParamSchema }),
  controller.dependentTreatmentPlans
);
router.get(
  '/dependents/:dependentId/timeline',
  validate({ params: dependentIdParamSchema }),
  controller.dependentTimeline
);
router.get(
  '/dependents/:dependentId/prescriptions',
  validate({ params: dependentIdParamSchema }),
  controller.dependentPrescriptions
);
router.get(
  '/dependents/:dependentId/loyalty/balance',
  validate({ params: dependentIdParamSchema }),
  controller.dependentLoyaltyBalance
);
router.get(
  '/dependents/:dependentId/loyalty/ledger',
  validate({ params: dependentIdParamSchema }),
  controller.dependentLoyaltyLedger
);

router.get('/profile', controller.getProfile);
router.patch('/profile', validate({ body: profileUpdateSchema }), controller.updateProfile);

router.get('/appointments', controller.listAppointments);
router.get('/appointments/calendar', controller.appointmentCalendar);
router.get('/appointments/slots', controller.availableSlots);
router.post(
  '/appointments',
  validate({ body: bookAppointmentSchema }),
  controller.bookAppointment
);
router.get(
  '/appointments/:id',
  validate({ params: idParamSchema }),
  controller.getAppointment
);
router.post(
  '/appointments/:id/cancel',
  validate({ params: idParamSchema, body: cancelSchema }),
  controller.cancelAppointment
);
router.post(
  '/appointments/:id/reschedule',
  validate({ params: idParamSchema, body: rescheduleSchema }),
  controller.rescheduleAppointment
);

router.get('/consultations', controller.listConsultations);
router.get(
  '/consultations/:id',
  validate({ params: idParamSchema }),
  controller.getConsultation
);
router.get(
  '/consultations/:id/download',
  validate({ params: idParamSchema }),
  controller.consultationDownload
);

router.get('/prescriptions', controller.listPrescriptions);
router.get(
  '/prescriptions/:id',
  validate({ params: idParamSchema }),
  controller.getPrescription
);
router.get(
  '/prescriptions/:id/print',
  validate({ params: idParamSchema }),
  controller.prescriptionPrint
);
router.post('/prescriptions/refill', controller.prescriptionRefill);

router.get('/treatment-plans', controller.listTreatmentPlans);
router.get(
  '/treatment-plans/:id',
  validate({ params: idParamSchema }),
  controller.getTreatmentPlan
);
router.get(
  '/treatment-plans/:id/summary',
  validate({ params: idParamSchema }),
  controller.treatmentSummary
);

router.get('/treatment-sessions', controller.listTreatmentSessions);
router.get(
  '/treatment-sessions/:id',
  validate({ params: idParamSchema }),
  controller.getTreatmentSession
);

router.get('/invoices', controller.listInvoices);
router.get('/invoices/outstanding', controller.outstanding);
router.get('/invoices/:id', validate({ params: idParamSchema }), controller.getInvoice);
router.get(
  '/invoices/:id/print',
  validate({ params: idParamSchema }),
  controller.invoicePrint
);
router.get(
  '/payments/:paymentId/receipt',
  validate({ params: paymentIdParamSchema }),
  controller.paymentReceipt
);

router.get('/offers', controller.listOffers);

router.get('/documents', controller.listDocuments);
router.get(
  '/documents/:id/download',
  validate({ params: idParamSchema }),
  controller.downloadDocument
);

router.get('/notifications', controller.notifications);
router.get('/notifications/unread-count', controller.unreadCount);
router.post(
  '/notifications/:id/read',
  validate({ params: idParamSchema }),
  controller.markNotificationRead
);
router.post(
  '/notifications/:id/archive',
  validate({ params: idParamSchema }),
  controller.archiveNotification
);

router.get('/feedback', controller.listFeedback);
router.post('/feedback', validate({ body: feedbackSchema }), controller.submitFeedback);

router.get('/loyalty/balance', controller.loyaltyBalance);
router.get('/loyalty/ledger', controller.loyaltyLedger);
router.get('/referral', controller.referral);

router.get('/timeline', controller.timeline);

router.post(
  '/privacy-requests',
  validate({ body: submitPrivacyRequestSchema }),
  controller.submitPrivacyRequest
);
router.get('/privacy-requests', controller.listPrivacyRequests);

export default router;
