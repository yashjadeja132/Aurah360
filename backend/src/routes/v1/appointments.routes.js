import { Router } from 'express';
import AppointmentController from '../../controllers/AppointmentController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentQuerySchema,
  appointmentIdParamSchema,
  availableSlotsQuerySchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  followUpSchema,
  doctorCalendarQuerySchema,
  patientHistoryParamSchema,
  approvalDecisionSchema,
  waitlistCreateSchema,
  waitlistOfferSchema,
  waitlistQuerySchema,
  waitlistIdParamSchema,
} from '../../validators/appointment.validator.js';

const router = Router();
const controller = new AppointmentController();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ query: listAppointmentQuerySchema }),
  controller.list
);

router.post(
  '/',
  requirePermission(PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ body: createAppointmentSchema }),
  controller.create
);

router.get(
  '/available-slots',
  requirePermission(PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ query: availableSlotsQuerySchema }),
  controller.availableSlots
);

router.get(
  '/doctor-calendar',
  requirePermission(PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ query: doctorCalendarQuerySchema }),
  controller.doctorCalendar
);

router.get(
  '/patient/:patientId/history',
  requirePermission(PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: patientHistoryParamSchema }),
  controller.patientHistory
);

router.get(
  '/waitlist',
  requirePermission(PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ query: waitlistQuerySchema }),
  controller.listWaitlist
);

router.post(
  '/waitlist',
  requirePermission(PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ body: waitlistCreateSchema }),
  controller.addToWaitlist
);

router.post(
  '/waitlist/:id/offer',
  requirePermission(PERMISSIONS.APPOINTMENTS_EDIT, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: waitlistIdParamSchema, body: waitlistOfferSchema }),
  controller.offerWaitlistSlot
);

router.post(
  '/waitlist/:id/convert',
  requirePermission(PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: waitlistIdParamSchema }),
  controller.convertWaitlist
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema }),
  controller.getById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.APPOINTMENTS_EDIT, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema, body: updateAppointmentSchema }),
  controller.update
);

router.post(
  '/:id/confirm',
  requirePermission(PERMISSIONS.APPOINTMENTS_EDIT, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema }),
  controller.confirm
);

router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.APPOINTMENTS_CANCEL, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema, body: cancelAppointmentSchema }),
  controller.cancel
);

router.post(
  '/:id/no-show',
  requirePermission(PERMISSIONS.APPOINTMENTS_EDIT, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema }),
  controller.noShow
);

router.post(
  '/:id/complete',
  requirePermission(PERMISSIONS.APPOINTMENTS_COMPLETE, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema }),
  controller.complete
);

router.post(
  '/:id/reschedule',
  requirePermission(PERMISSIONS.APPOINTMENTS_RESCHEDULE, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema, body: rescheduleAppointmentSchema }),
  controller.reschedule
);

router.post(
  '/:id/follow-up',
  requirePermission(PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema, body: followUpSchema }),
  controller.followUp
);

router.post(
  '/:id/approval',
  requirePermission(PERMISSIONS.APPOINTMENTS_EDIT, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema, body: approvalDecisionSchema }),
  controller.decideApproval
);

router.post(
  '/:id/accept-alternative',
  requirePermission(PERMISSIONS.APPOINTMENTS_EDIT, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema }),
  controller.acceptAlternative
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.APPOINTMENTS_DELETE, PERMISSIONS.APPOINTMENTS_ALL),
  validate({ params: appointmentIdParamSchema }),
  controller.softDelete
);

export default router;
