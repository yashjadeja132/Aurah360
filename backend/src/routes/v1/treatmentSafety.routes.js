import { Router } from 'express';
import TreatmentSafetyController from '../../controllers/TreatmentSafetyController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  recordPatchTestSchema,
  reviewPatchTestSchema,
  reportAdverseEventSchema,
  updateAdverseEventSchema,
  closeAdverseEventSchema,
  patientIdParamSchema,
  idParamSchema,
} from '../../validators/treatmentSafety.validator.js';

const router = Router();
const controller = new TreatmentSafetyController();

router.use(authenticate);

router.post(
  '/patch-tests',
  requirePermission(PERMISSIONS.PATCH_TEST_RECORD),
  validate({ body: recordPatchTestSchema }),
  controller.recordPatchTest
);
router.post(
  '/patch-tests/:id/review',
  requirePermission(PERMISSIONS.PATCH_TEST_RECORD),
  validate({ params: idParamSchema, body: reviewPatchTestSchema }),
  controller.reviewPatchTest
);
router.get(
  '/patch-tests/patients/:patientId',
  requirePermission(PERMISSIONS.PATCH_TEST_VIEW, PERMISSIONS.PATCH_TEST_RECORD),
  validate({ params: patientIdParamSchema }),
  controller.listPatchTestsForPatient
);

router.post(
  '/adverse-events',
  requirePermission(PERMISSIONS.ADVERSE_EVENT_CREATE),
  validate({ body: reportAdverseEventSchema }),
  controller.reportAdverseEvent
);
router.get(
  '/adverse-events',
  requirePermission(PERMISSIONS.ADVERSE_EVENT_VIEW, PERMISSIONS.ADVERSE_EVENT_CREATE),
  controller.listAdverseEvents
);
router.patch(
  '/adverse-events/:id',
  requirePermission(PERMISSIONS.ADVERSE_EVENT_RESOLVE),
  validate({ params: idParamSchema, body: updateAdverseEventSchema }),
  controller.updateAdverseEvent
);
router.post(
  '/adverse-events/:id/close',
  requirePermission(PERMISSIONS.ADVERSE_EVENT_RESOLVE),
  validate({ params: idParamSchema, body: closeAdverseEventSchema }),
  controller.closeAdverseEvent
);

export default router;
