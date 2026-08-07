import { Router } from 'express';
import ConsentController from '../../controllers/ConsentController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  grantConsentSchema,
  withdrawConsentSchema,
  publishDefinitionSchema,
  patientIdParamSchema,
} from '../../validators/consent.validator.js';

const router = Router();
const controller = new ConsentController();

const view = [PERMISSIONS.CONSENT_VIEW, PERMISSIONS.CONSENT_ALL];
const manage = [PERMISSIONS.CONSENT_MANAGE, PERMISSIONS.CONSENT_ALL];

router.use(authenticate);

router.get('/definitions', requirePermission(...view), controller.listDefinitions);
router.post('/definitions', requirePermission(...manage), validate({ body: publishDefinitionSchema }), controller.publishDefinition);

router.get('/patients/:patientId', requirePermission(...view), validate({ params: patientIdParamSchema }), controller.currentStates);
router.get('/patients/:patientId/history', requirePermission(...view), validate({ params: patientIdParamSchema }), controller.history);

router.post('/grant', requirePermission(...manage), validate({ body: grantConsentSchema }), controller.grant);
router.post('/withdraw', requirePermission(...manage), validate({ body: withdrawConsentSchema }), controller.withdraw);

export default router;
