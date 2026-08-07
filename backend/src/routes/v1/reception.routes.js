import { Router } from 'express';
import ReceptionController from '../../controllers/ReceptionController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  receptionDashboardQuerySchema,
  todaysAppointmentsQuerySchema,
  appointmentIdParamSchema,
  checkInSchema,
  walkInSchema,
} from '../../validators/reception.validator.js';

const router = Router();
const controller = new ReceptionController();

router.use(authenticate);

router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.RECEPTION_VIEW, PERMISSIONS.RECEPTION_ALL),
  validate({ query: receptionDashboardQuerySchema }),
  controller.dashboard
);

router.get(
  '/appointments/today',
  requirePermission(PERMISSIONS.RECEPTION_VIEW, PERMISSIONS.RECEPTION_ALL),
  validate({ query: todaysAppointmentsQuerySchema }),
  controller.todaysAppointments
);

router.post(
  '/check-in/:appointmentId',
  requirePermission(PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL),
  validate({ params: appointmentIdParamSchema, body: checkInSchema }),
  controller.checkIn
);

router.post(
  '/undo-check-in/:appointmentId',
  requirePermission(PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL),
  validate({ params: appointmentIdParamSchema }),
  controller.undoCheckIn
);

router.post(
  '/walk-in',
  requirePermission(PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL),
  validate({ body: walkInSchema }),
  controller.walkIn
);

export default router;
