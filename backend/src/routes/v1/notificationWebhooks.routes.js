import { Router } from 'express';
import NotificationWebhookController from '../../controllers/NotificationWebhookController.js';

const router = Router();
const controller = new NotificationWebhookController();

// Public — providers call these directly. Authenticity comes from HMAC signature
// verification (WhatsApp) or a shared-secret verification token (SMS/BulkSenders, Voice/Exotel)
// checked inside the controller, since those providers have no confirmed request-signing scheme.
router.get('/whatsapp', controller.verifyWhatsApp);
router.post('/whatsapp', controller.whatsapp);
router.post('/sms', controller.sms);
router.post('/voice', controller.voice);

export default router;
