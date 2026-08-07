import { Router } from 'express';
import PatientImportController from '../../controllers/PatientImportController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { dryRunSchema, commitSchema, batchIdParamSchema } from '../../validators/patientImport.validator.js';

const router = Router();
const controller = new PatientImportController();

const manage = [PERMISSIONS.PATIENTS_MERGE, PERMISSIONS.PATIENTS_ALL];

router.use(authenticate);
router.use(requirePermission(...manage));

router.post('/dry-run', validate({ body: dryRunSchema }), controller.dryRun);
router.post('/:batchId/commit', validate({ params: batchIdParamSchema, body: commitSchema }), controller.commit);
router.get('/:batchId', validate({ params: batchIdParamSchema }), controller.getBatch);

export default router;
