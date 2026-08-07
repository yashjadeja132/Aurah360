import { Router } from 'express';
import v1Routes from './v1/index.js';
import config from '../config/index.js';

const router = Router();

router.use(config.app.apiPrefix, v1Routes);

export default router;
