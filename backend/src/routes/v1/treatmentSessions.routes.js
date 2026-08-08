import { Router } from 'express';
import TreatmentSessionController from '../../controllers/TreatmentSessionController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { uploadPatientDocument } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createSessionSchema,
  updateSessionSchema,
  startSessionSchema,
  completeSessionSchema,
  rescheduleSchema,
  reverseCompletionSchema,
  sessionPhotoMetaSchema,
  sessionIdParamSchema,
  planIdParamSchema,
  sessionListQuerySchema,
  dashboardQuerySchema,
} from '../../validators/treatmentSession.validator.js';

const router = Router();
const controller = new TreatmentSessionController();

const view = [PERMISSIONS.TREATMENT_SESSION_VIEW, PERMISSIONS.TREATMENT_SESSION_ALL];
const create = [PERMISSIONS.TREATMENT_SESSION_CREATE, PERMISSIONS.TREATMENT_SESSION_ALL];
const edit = [PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL];
const complete = [PERMISSIONS.TREATMENT_SESSION_COMPLETE, PERMISSIONS.TREATMENT_SESSION_ALL];
const reverse = [PERMISSIONS.TREATMENT_SESSION_REVERSE, PERMISSIONS.TREATMENT_SESSION_ALL];

router.use(authenticate);

router.get(
  '/dashboard',
  requirePermission(...view),
  validate({ query: dashboardQuerySchema }),
  controller.dashboard
);

router.get(
  '/progress/:planId',
  requirePermission(...view),
  validate({ params: planIdParamSchema }),
  controller.progress
);

router.get(
  '/',
  requirePermission(...view),
  validate({ query: sessionListQuerySchema }),
  controller.list
);

router.post(
  '/',
  requirePermission(...create),
  validate({ body: createSessionSchema }),
  controller.create
);

router.get(
  '/:id',
  requirePermission(...view),
  validate({ params: sessionIdParamSchema }),
  controller.getById
);

router.patch(
  '/:id',
  requirePermission(...edit),
  validate({ params: sessionIdParamSchema, body: updateSessionSchema }),
  controller.update
);

router.post(
  '/:id/check-in',
  requirePermission(...edit),
  validate({ params: sessionIdParamSchema }),
  controller.checkIn
);

router.get(
  '/:id/preflight',
  requirePermission(...view),
  validate({ params: sessionIdParamSchema }),
  controller.preflight
);

router.post(
  '/:id/start',
  requirePermission(...edit, ...complete),
  validate({ params: sessionIdParamSchema, body: startSessionSchema }),
  controller.start
);

router.post(
  '/:id/complete',
  requirePermission(...complete),
  validate({ params: sessionIdParamSchema, body: completeSessionSchema }),
  controller.complete
);

router.post(
  '/:id/reverse-completion',
  requirePermission(...reverse),
  validate({ params: sessionIdParamSchema, body: reverseCompletionSchema }),
  controller.reverseCompletion
);

router.post(
  '/:id/cancel',
  requirePermission(...edit),
  validate({ params: sessionIdParamSchema }),
  controller.cancel
);

router.post(
  '/:id/skip',
  requirePermission(...edit),
  validate({ params: sessionIdParamSchema }),
  controller.skip
);

router.post(
  '/:id/reschedule',
  requirePermission(...edit),
  validate({ params: sessionIdParamSchema, body: rescheduleSchema }),
  controller.reschedule
);

router.post(
  '/:id/photos',
  requirePermission(...edit),
  uploadPatientDocument,
  // Multipart: multer must populate req.body before the metadata can be validated (same ordering
  // as the consultation photo route).
  validate({ params: sessionIdParamSchema, body: sessionPhotoMetaSchema }),
  controller.uploadPhoto
);

router.get(
  '/:id/print',
  requirePermission(...view),
  validate({ params: sessionIdParamSchema }),
  controller.print
);

export default router;
