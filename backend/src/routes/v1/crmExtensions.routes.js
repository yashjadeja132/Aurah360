import { Router } from 'express';
import CrmExtensionsController from '../../controllers/CrmExtensionsController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createRecallEntrySchema,
  recallOutcomeSchema,
  createOfferSchema,
  updateOfferSchema,
  escalateFeedbackSchema,
  resolveFeedbackSchema,
  idParamSchema,
} from '../../validators/crmExtensions.validator.js';

const router = Router();
const controller = new CrmExtensionsController();

router.use(authenticate);

router.post(
  '/recall',
  requirePermission(PERMISSIONS.CRM_RECALL, PERMISSIONS.CRM_ALL),
  validate({ body: createRecallEntrySchema }),
  controller.createRecallEntry
);
router.get(
  '/recall',
  requirePermission(PERMISSIONS.CRM_RECALL, PERMISSIONS.CRM_ALL),
  controller.listRecallWorklist
);
router.post(
  '/recall/:id/outcome',
  requirePermission(PERMISSIONS.CRM_RECALL, PERMISSIONS.CRM_ALL),
  validate({ params: idParamSchema, body: recallOutcomeSchema }),
  controller.recordRecallOutcome
);

router.post(
  '/offers',
  requirePermission(PERMISSIONS.CRM_OFFERS_MANAGE, PERMISSIONS.CRM_ALL),
  validate({ body: createOfferSchema }),
  controller.createOffer
);
router.patch(
  '/offers/:id',
  requirePermission(PERMISSIONS.CRM_OFFERS_MANAGE, PERMISSIONS.CRM_ALL),
  validate({ params: idParamSchema, body: updateOfferSchema }),
  controller.updateOffer
);
router.get(
  '/offers',
  requirePermission(PERMISSIONS.CRM_OFFERS_VIEW, PERMISSIONS.CRM_OFFERS_MANAGE, PERMISSIONS.CRM_ALL),
  controller.listOffers
);

router.get(
  '/feedback',
  requirePermission(PERMISSIONS.CRM_FEEDBACK_VIEW, PERMISSIONS.CRM_ALL),
  controller.listFeedback
);
router.post(
  '/feedback/:id/escalate',
  requirePermission(PERMISSIONS.CRM_FEEDBACK_VIEW, PERMISSIONS.CRM_ALL),
  validate({ params: idParamSchema, body: escalateFeedbackSchema }),
  controller.escalateFeedback
);
router.post(
  '/feedback/:id/resolve',
  requirePermission(PERMISSIONS.CRM_FEEDBACK_VIEW, PERMISSIONS.CRM_ALL),
  validate({ params: idParamSchema, body: resolveFeedbackSchema }),
  controller.resolveFeedback
);

export default router;
