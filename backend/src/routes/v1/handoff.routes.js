import { Router } from 'express';
import HandoffController from '../../controllers/HandoffController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { idParamSchema } from '../../validators/common.js';
import {
  createHandoffSchema,
  acknowledgeHandoffSchema,
  amendHandoffSchema,
  patientIdParamSchema,
  doctorIdParamSchema,
} from '../../validators/handoff.validator.js';

const router = Router();
const controller = new HandoffController();

const view = [PERMISSIONS.HANDOFF_VIEW, PERMISSIONS.HANDOFF_ALL];
const create = [PERMISSIONS.HANDOFF_CREATE, PERMISSIONS.HANDOFF_ALL];
const ack = [PERMISSIONS.HANDOFF_ACKNOWLEDGE, PERMISSIONS.HANDOFF_ALL];

router.use(authenticate);

router.post('/', requirePermission(...create), validate({ body: createHandoffSchema }), controller.create);
router.get('/patients/:patientId', requirePermission(...view), validate({ params: patientIdParamSchema }), controller.listForPatient);
router.get('/doctors/:doctorId/unacknowledged', requirePermission(...view), validate({ params: doctorIdParamSchema }), controller.listUnacknowledgedForDoctor);
router.post('/:id/acknowledge', requirePermission(...ack), validate({ params: idParamSchema, body: acknowledgeHandoffSchema }), controller.acknowledge);
router.post('/:id/amend', requirePermission(...create), validate({ params: idParamSchema, body: amendHandoffSchema }), controller.amend);

export default router;
