import { Router } from 'express';
import DoctorController from '../../controllers/DoctorController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  listDoctorQuerySchema,
  doctorIdParamSchema,
  scheduleIdParamSchema,
  leaveIdParamSchema,
  upsertScheduleSchema,
  scheduleListQuerySchema,
  previewSlotsQuerySchema,
  availabilityQuerySchema,
  createLeaveSchema,
  updateLeaveSchema,
} from '../../validators/doctor.validator.js';

const router = Router();
const controller = new DoctorController();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.DOCTORS_VIEW, PERMISSIONS.DOCTORS_ALL),
  validate({ query: listDoctorQuerySchema }),
  controller.list
);

router.post(
  '/',
  requirePermission(PERMISSIONS.DOCTORS_CREATE, PERMISSIONS.DOCTORS_ALL),
  validate({ body: createDoctorSchema }),
  controller.create
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.DOCTORS_VIEW, PERMISSIONS.DOCTORS_ALL),
  validate({ params: doctorIdParamSchema }),
  controller.getById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.DOCTORS_EDIT, PERMISSIONS.DOCTORS_ALL),
  validate({ params: doctorIdParamSchema, body: updateDoctorSchema }),
  controller.update
);

router.post(
  '/:id/activate',
  requirePermission(PERMISSIONS.DOCTORS_EDIT, PERMISSIONS.DOCTORS_ALL),
  validate({ params: doctorIdParamSchema }),
  controller.activate
);

router.post(
  '/:id/deactivate',
  requirePermission(PERMISSIONS.DOCTORS_EDIT, PERMISSIONS.DOCTORS_ALL),
  validate({ params: doctorIdParamSchema }),
  controller.deactivate
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DOCTORS_DELETE, PERMISSIONS.DOCTORS_ALL),
  validate({ params: doctorIdParamSchema }),
  controller.softDelete
);

router.get(
  '/:id/schedules',
  requirePermission(PERMISSIONS.DOCTOR_SCHEDULE_VIEW, PERMISSIONS.DOCTOR_SCHEDULE_ALL, PERMISSIONS.DOCTORS_VIEW),
  validate({ params: doctorIdParamSchema, query: scheduleListQuerySchema }),
  controller.listSchedules
);

router.put(
  '/:id/schedules',
  requirePermission(PERMISSIONS.DOCTOR_SCHEDULE_EDIT, PERMISSIONS.DOCTOR_SCHEDULE_ALL),
  validate({ params: doctorIdParamSchema, body: upsertScheduleSchema }),
  controller.upsertSchedules
);

router.get(
  '/:id/schedules/preview',
  requirePermission(PERMISSIONS.DOCTOR_SCHEDULE_VIEW, PERMISSIONS.DOCTOR_SCHEDULE_ALL, PERMISSIONS.DOCTORS_VIEW),
  validate({ params: doctorIdParamSchema, query: previewSlotsQuerySchema }),
  controller.previewSlots
);

router.delete(
  '/:id/schedules/:scheduleId',
  requirePermission(PERMISSIONS.DOCTOR_SCHEDULE_EDIT, PERMISSIONS.DOCTOR_SCHEDULE_ALL),
  validate({ params: scheduleIdParamSchema }),
  controller.deleteSchedule
);

router.get(
  '/:id/availability',
  requirePermission(PERMISSIONS.DOCTORS_VIEW, PERMISSIONS.DOCTORS_ALL, PERMISSIONS.DOCTOR_SCHEDULE_VIEW),
  validate({ params: doctorIdParamSchema, query: availabilityQuerySchema }),
  controller.availability
);

router.get(
  '/:id/leaves',
  requirePermission(PERMISSIONS.DOCTOR_LEAVE_VIEW, PERMISSIONS.DOCTOR_LEAVE_ALL, PERMISSIONS.DOCTORS_VIEW),
  validate({ params: doctorIdParamSchema }),
  controller.listLeaves
);

router.post(
  '/:id/leaves',
  requirePermission(PERMISSIONS.DOCTOR_LEAVE_EDIT, PERMISSIONS.DOCTOR_LEAVE_ALL),
  validate({ params: doctorIdParamSchema, body: createLeaveSchema }),
  controller.createLeave
);

router.patch(
  '/:id/leaves/:leaveId',
  requirePermission(PERMISSIONS.DOCTOR_LEAVE_EDIT, PERMISSIONS.DOCTOR_LEAVE_ALL),
  validate({ params: leaveIdParamSchema, body: updateLeaveSchema }),
  controller.updateLeave
);

router.delete(
  '/:id/leaves/:leaveId',
  requirePermission(PERMISSIONS.DOCTOR_LEAVE_EDIT, PERMISSIONS.DOCTOR_LEAVE_ALL),
  validate({ params: leaveIdParamSchema }),
  controller.deleteLeave
);

export default router;
