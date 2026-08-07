import { Router } from 'express';
import AiController from '../../controllers/AiController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  runAiSchema,
  dispositionSchema,
  setFlagSchema,
  listRunsQuerySchema,
  runIdParamSchema,
  useCaseParamSchema,
} from '../../validators/ai.validator.js';

const router = Router();
const controller = new AiController();

router.use(authenticate);

router.post('/run', requirePermission(PERMISSIONS.AI_USE), validate({ body: runAiSchema }), controller.run);
router.post(
  '/runs/:runId/disposition',
  requirePermission(PERMISSIONS.AI_USE),
  validate({ params: runIdParamSchema, body: dispositionSchema }),
  controller.disposition
);
router.get(
  '/runs',
  requirePermission(PERMISSIONS.AI_GOVERNANCE_VIEW, PERMISSIONS.AI_GOVERNANCE_MANAGE),
  validate({ query: listRunsQuerySchema }),
  controller.listRuns
);
router.get(
  '/governance/summary',
  requirePermission(PERMISSIONS.AI_GOVERNANCE_VIEW, PERMISSIONS.AI_GOVERNANCE_MANAGE),
  controller.governanceSummary
);
router.get(
  '/governance/flags',
  requirePermission(PERMISSIONS.AI_GOVERNANCE_VIEW, PERMISSIONS.AI_GOVERNANCE_MANAGE),
  controller.listFeatureFlags
);
router.post(
  '/governance/flags/:useCase',
  requirePermission(PERMISSIONS.AI_GOVERNANCE_MANAGE),
  validate({ params: useCaseParamSchema, body: setFlagSchema }),
  controller.setFeatureFlag
);

export default router;
