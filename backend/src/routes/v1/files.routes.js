import { Router } from 'express';
import FileAccessController from '../../controllers/FileAccessController.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authenticatePatient } from '../../middlewares/patientAuth.middleware.js';
import { idParamSchema } from '../../validators/common.js';
import { validate } from '../../middlewares/validate.middleware.js';

const router = Router();
const controller = new FileAccessController();

/**
 * Additive (Task #24): if the request carries `?token=`, let it through here and leave
 * verification to the controller (which checks the token against the specific file id).
 * Without a token, session auth is enforced exactly as before — this never weakens the
 * existing check, it only adds an alternative path for short-lived signed links.
 */
function authenticateOrFileToken(req, res, next) {
  if (req.query?.token) {
    return authenticate(req, res, () => next());
  }
  return authenticate(req, res, next);
}

// Staff — permission-checked and audited per read. Malware-scan gated (Task #23).
router.get('/documents/:id', authenticateOrFileToken, validate({ params: idParamSchema }), controller.document);
router.get('/photos/:id', authenticateOrFileToken, validate({ params: idParamSchema }), controller.photo);

// Issue a short-lived signed token for the file above (Task #24) — session-auth only.
router.get('/documents/:id/token', authenticate, validate({ params: idParamSchema }), controller.documentToken);
router.get('/photos/:id/token', authenticate, validate({ params: idParamSchema }), controller.photoToken);

/**
 * Task #46 (mirrors staff's Task #24): if the request carries `?token=`, let it through here
 * and leave verification to the controller (checked against the specific file id, and only
 * ever issued for a file the requesting patient already owned). Without a token, patient
 * session auth is enforced exactly as before — this never weakens the existing check.
 */
function authenticatePatientOrFileToken(req, res, next) {
  if (req.query?.token) return next();
  return authenticatePatient(req, res, next);
}

// Patient portal — only serves records explicitly released to that patient.
router.get(
  '/patient/documents/:id',
  authenticatePatientOrFileToken,
  validate({ params: idParamSchema }),
  controller.patientDocument
);
router.get(
  '/patient/photos/:id',
  authenticatePatientOrFileToken,
  validate({ params: idParamSchema }),
  controller.patientPhoto
);

// Issue a short-lived signed token for the file above (Task #46) — patient session-auth only.
router.get(
  '/patient/documents/:id/token',
  authenticatePatient,
  validate({ params: idParamSchema }),
  controller.patientDocumentToken
);
router.get(
  '/patient/photos/:id/token',
  authenticatePatient,
  validate({ params: idParamSchema }),
  controller.patientPhotoToken
);

export default router;
