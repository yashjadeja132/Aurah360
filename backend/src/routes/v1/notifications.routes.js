import { Router } from 'express';
import NotificationController from '../../controllers/NotificationController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  idParamSchema,
  listQuerySchema,
  scheduleSchema,
  templateSchema,
  updateTemplateSchema,
} from '../../validators/notification.validator.js';

const router = Router();
const controller = new NotificationController();

const view = [PERMISSIONS.NOTIFICATIONS_VIEW, PERMISSIONS.NOTIFICATIONS_ALL];
const manage = [PERMISSIONS.NOTIFICATIONS_MANAGE, PERMISSIONS.NOTIFICATIONS_ALL];

router.use(authenticate);

router.get('/provider-status', controller.providerStatus);
router.get('/inbox', requirePermission(...view), controller.inbox);
router.get('/unread-count', requirePermission(...view), controller.unreadCount);
router.post('/inbox/read-all', requirePermission(...view), controller.markAllRead);

router.get(
  '/',
  requirePermission(...view),
  validate({ query: listQuerySchema }),
  controller.list
);
router.get(
  '/reports/summary',
  requirePermission(...view, ...manage),
  controller.reports
);
router.get(
  '/dead-letter',
  requirePermission(...manage),
  controller.deadLetterList
);
router.post(
  '/schedule',
  requirePermission(...manage),
  validate({ body: scheduleSchema }),
  controller.schedule
);
router.post('/process-pending', requirePermission(...manage), controller.processPending);

router.get('/templates', requirePermission(...view), controller.listTemplates);
router.post(
  '/templates',
  requirePermission(...manage),
  validate({ body: templateSchema }),
  controller.createTemplate
);
router.get(
  '/templates/:id',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.getTemplate
);
router.patch(
  '/templates/:id',
  requirePermission(...manage),
  validate({ params: idParamSchema, body: updateTemplateSchema }),
  controller.updateTemplate
);

router.get(
  '/:id',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.getById
);
router.post(
  '/:id/read',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.markRead
);
router.post(
  '/:id/archive',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.archive
);
router.post(
  '/:id/retry',
  requirePermission(...manage),
  validate({ params: idParamSchema }),
  controller.retry
);

export default router;
