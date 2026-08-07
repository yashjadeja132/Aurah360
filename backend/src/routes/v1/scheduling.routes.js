import { Router } from 'express';
import SchedulingController from '../../controllers/SchedulingController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  availabilityQuerySchema,
  weeklyPreviewQuerySchema,
  validateSlotSchema,
  checkAvailabilitySchema,
  createHolidaySchema,
  updateHolidaySchema,
  holidayIdParamSchema,
  holidayListQuerySchema,
  createBlockedSlotSchema,
  updateBlockedSlotSchema,
  blockedSlotIdParamSchema,
  blockedListQuerySchema,
  upsertSpecialScheduleSchema,
  specialScheduleIdParamSchema,
  specialListQuerySchema,
} from '../../validators/scheduling.validator.js';

const router = Router();
const controller = new SchedulingController();

router.use(authenticate);

const canViewSchedule = requirePermission(
  PERMISSIONS.SCHEDULE_VIEW,
  PERMISSIONS.SCHEDULE_ALL,
  PERMISSIONS.DOCTOR_SCHEDULE_VIEW
);
const canEditSchedule = requirePermission(
  PERMISSIONS.SCHEDULE_EDIT,
  PERMISSIONS.SCHEDULE_ALL
);
const canViewHolidays = requirePermission(
  PERMISSIONS.HOLIDAYS_VIEW,
  PERMISSIONS.HOLIDAYS_ALL,
  PERMISSIONS.SCHEDULE_VIEW
);
const canEditHolidays = requirePermission(
  PERMISSIONS.HOLIDAYS_EDIT,
  PERMISSIONS.HOLIDAYS_ALL
);

router.get(
  '/slots',
  canViewSchedule,
  validate({ query: availabilityQuerySchema }),
  controller.getAvailableSlots
);

router.post(
  '/check',
  canViewSchedule,
  validate({ body: checkAvailabilitySchema }),
  controller.checkAvailability
);

router.post(
  '/validate-slot',
  canViewSchedule,
  validate({ body: validateSlotSchema }),
  controller.validateSlot
);

router.get(
  '/weekly-preview',
  canViewSchedule,
  validate({ query: weeklyPreviewQuerySchema }),
  controller.weeklyPreview
);

router.get(
  '/holidays',
  canViewHolidays,
  validate({ query: holidayListQuerySchema }),
  controller.listHolidays
);

router.post(
  '/holidays',
  canEditHolidays,
  validate({ body: createHolidaySchema }),
  controller.createHoliday
);

router.patch(
  '/holidays/:id',
  canEditHolidays,
  validate({ params: holidayIdParamSchema, body: updateHolidaySchema }),
  controller.updateHoliday
);

router.delete(
  '/holidays/:id',
  canEditHolidays,
  validate({ params: holidayIdParamSchema }),
  controller.deleteHoliday
);

router.get(
  '/blocked-slots',
  canViewSchedule,
  validate({ query: blockedListQuerySchema }),
  controller.listBlocked
);

router.post(
  '/blocked-slots',
  canEditSchedule,
  validate({ body: createBlockedSlotSchema }),
  controller.createBlocked
);

router.patch(
  '/blocked-slots/:id',
  canEditSchedule,
  validate({ params: blockedSlotIdParamSchema, body: updateBlockedSlotSchema }),
  controller.updateBlocked
);

router.delete(
  '/blocked-slots/:id',
  canEditSchedule,
  validate({ params: blockedSlotIdParamSchema }),
  controller.deleteBlocked
);

router.get(
  '/special-schedules',
  canViewSchedule,
  validate({ query: specialListQuerySchema }),
  controller.listSpecial
);

router.put(
  '/special-schedules',
  canEditSchedule,
  validate({ body: upsertSpecialScheduleSchema }),
  controller.upsertSpecial
);

router.delete(
  '/special-schedules/:id',
  canEditSchedule,
  validate({ params: specialScheduleIdParamSchema }),
  controller.deleteSpecial
);

export default router;
