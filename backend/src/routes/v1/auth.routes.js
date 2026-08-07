import { Router } from 'express';
import AuthController from '../../controllers/AuthController.js';
import UserController from '../../controllers/UserController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authenticateOrMfaSetupToken } from '../../middlewares/auth.middleware.js';
import { authRateLimiter } from '../../middlewares/security.middleware.js';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  verifyMfaSchema,
  mfaTokenSchema,
  stepUpSchema,
} from '../../validators/auth.validator.js';
import {
  changePasswordSchema,
  updateProfileSchema,
} from '../../validators/user.validator.js';

const router = Router();
const authController = new AuthController();
const userController = new UserController();
const authLimit = authRateLimiter();

router.post('/login', authLimit, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authLimit, validate({ body: refreshSchema }), authController.refresh);
router.post('/logout', validate({ body: logoutSchema }), authController.logout);
router.post(
  '/forgot-password',
  authLimit,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);
router.post('/mfa/verify', authLimit, validate({ body: verifyMfaSchema }), authController.verifyMfa);

// SEC-021 — reachable either with a real session or with the mfaSetupToken issued by
// login()/refresh() when a privileged role must enroll in MFA before a session exists.
router.post('/mfa/setup/start', authenticateOrMfaSetupToken, authController.startMfaSetup);
router.post(
  '/mfa/setup/confirm',
  authenticateOrMfaSetupToken,
  validate({ body: mfaTokenSchema }),
  authController.confirmMfaSetup
);
router.post('/mfa/disable', authenticate, validate({ body: mfaTokenSchema }), authController.disableMfa);
router.post('/step-up', authenticate, validate({ body: stepUpSchema }), authController.stepUp);

router.get('/me', authenticate, authController.me);
router.patch(
  '/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  userController.updateProfile
);
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  userController.changePassword
);

export default router;
