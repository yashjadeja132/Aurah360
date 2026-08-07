import { Router } from 'express';
import CrmController from '../../controllers/CrmController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  idParamSchema,
  leadListQuerySchema,
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema,
  statusSchema,
  followUpSchema,
  convertSchema,
  createTaskSchema,
  updateTaskSchema,
  communicationSchema,
  reportTypeParamSchema,
  taskListQuerySchema,
} from '../../validators/crm.validator.js';

const router = Router();
const controller = new CrmController();

const view = [PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_ALL];
const create = [PERMISSIONS.CRM_CREATE, PERMISSIONS.CRM_ALL];
const edit = [PERMISSIONS.CRM_EDIT, PERMISSIONS.CRM_ALL];
const assign = [PERMISSIONS.CRM_ASSIGN, PERMISSIONS.CRM_ALL];
const convert = [PERMISSIONS.CRM_CONVERT, PERMISSIONS.CRM_ALL];
const followup = [PERMISSIONS.CRM_FOLLOWUP, PERMISSIONS.CRM_ALL];

router.use(authenticate);

router.get('/dashboard', requirePermission(...view), controller.dashboard);
router.get('/pipeline', requirePermission(...view), controller.pipeline);
router.get(
  '/reports/:type',
  requirePermission(...view),
  validate({ params: reportTypeParamSchema }),
  controller.report
);
router.post('/reminders/run', requirePermission(...view), controller.runReminders);

router.get(
  '/tasks',
  requirePermission(...view),
  validate({ query: taskListQuerySchema }),
  controller.listTasks
);
router.post(
  '/tasks',
  requirePermission(...edit, ...assign),
  validate({ body: createTaskSchema }),
  controller.createTask
);
router.patch(
  '/tasks/:id',
  requirePermission(...edit),
  validate({ params: idParamSchema, body: updateTaskSchema }),
  controller.updateTask
);

router.get(
  '/leads',
  requirePermission(...view),
  validate({ query: leadListQuerySchema }),
  controller.list
);
router.post(
  '/leads',
  requirePermission(...create),
  validate({ body: createLeadSchema }),
  controller.create
);
router.get(
  '/leads/:id',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.getById
);
router.patch(
  '/leads/:id',
  requirePermission(...edit),
  validate({ params: idParamSchema, body: updateLeadSchema }),
  controller.update
);
router.post(
  '/leads/:id/assign',
  requirePermission(...assign),
  validate({ params: idParamSchema, body: assignLeadSchema }),
  controller.assign
);
router.post(
  '/leads/:id/status',
  requirePermission(...edit),
  validate({ params: idParamSchema, body: statusSchema }),
  controller.changeStatus
);
router.post(
  '/leads/:id/follow-ups',
  requirePermission(...followup),
  validate({ params: idParamSchema, body: followUpSchema }),
  controller.addFollowUp
);
router.post(
  '/leads/:id/convert',
  requirePermission(...convert),
  validate({ params: idParamSchema, body: convertSchema }),
  controller.convert
);
router.post(
  '/leads/:id/communications',
  requirePermission(...followup),
  validate({ params: idParamSchema, body: communicationSchema }),
  controller.logCommunication
);

export default router;
