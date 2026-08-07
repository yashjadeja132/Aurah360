import { Router } from 'express';
import HealthController from '../../controllers/HealthController.js';

const router = Router();
const healthController = new HealthController();

router.get('/', healthController.check);
router.get('/livez', healthController.livez);
router.get('/readyz', healthController.readyz);
router.get('/healthz', healthController.healthz);

export default router;
