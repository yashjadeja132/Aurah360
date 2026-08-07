import { Router } from 'express';
import QueueController from '../../controllers/QueueController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  queueIdParamSchema,
  branchQueueQuerySchema,
  doctorQueueQuerySchema,
  callNextSchema,
  transferQueueSchema,
  reorderQueueSchema,
} from '../../validators/queue.validator.js';

const router = Router();
const controller = new QueueController();

router.use(authenticate);

router.get(
  '/summary',
  requirePermission(PERMISSIONS.QUEUE_VIEW, PERMISSIONS.QUEUE_ALL),
  validate({ query: branchQueueQuerySchema }),
  controller.summary
);

router.get(
  '/branch',
  requirePermission(PERMISSIONS.QUEUE_VIEW, PERMISSIONS.QUEUE_ALL),
  validate({ query: branchQueueQuerySchema }),
  controller.branchQueue
);

router.get(
  '/doctor',
  requirePermission(PERMISSIONS.QUEUE_VIEW, PERMISSIONS.QUEUE_ALL),
  validate({ query: doctorQueueQuerySchema }),
  controller.doctorQueue
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.QUEUE_VIEW, PERMISSIONS.QUEUE_ALL),
  validate({ params: queueIdParamSchema }),
  controller.getById
);

router.post(
  '/call-next',
  requirePermission(PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL),
  validate({ body: callNextSchema }),
  controller.callNext
);

router.post(
  '/:id/call',
  requirePermission(PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL),
  validate({ params: queueIdParamSchema }),
  controller.call
);

router.post(
  '/:id/recall',
  requirePermission(PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL),
  validate({ params: queueIdParamSchema }),
  controller.recall
);

router.post(
  '/:id/skip',
  requirePermission(PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL),
  validate({ params: queueIdParamSchema }),
  controller.skip
);

router.post(
  '/:id/start-consultation',
  requirePermission(PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL),
  validate({ params: queueIdParamSchema }),
  controller.startConsultation
);

router.post(
  '/:id/complete',
  requirePermission(PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL),
  validate({ params: queueIdParamSchema }),
  controller.complete
);

router.post(
  '/:id/transfer',
  requirePermission(PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL),
  validate({ params: queueIdParamSchema, body: transferQueueSchema }),
  controller.transfer
);

router.post(
  '/:id/reorder',
  requirePermission(PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL),
  validate({ params: queueIdParamSchema, body: reorderQueueSchema }),
  controller.reorder
);

export default router;
