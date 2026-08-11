import ApiError from '../libs/ApiError.js';
import TokenService from '../services/TokenService.js';

const tokenService = new TokenService();

/**
 * SEC-002 — requires a recent step-up token (from POST /auth/step-up) for a privileged action:
 * bulk export, role/permission change, break-glass, refund, clinical-photo download, etc.
 */
export const requireStepUp = () => (req, _res, next) => {
  try {
    const token = req.headers['x-step-up-token'];
    if (!token) throw ApiError.forbidden('Step-up re-authentication required', 'STEP_UP_REQUIRED');
    const payload = tokenService.verifyStepUpToken(token);
    if (payload.sub !== req.auth?.userId) {
      throw ApiError.forbidden('Step-up token does not match the authenticated user');
    }
    req.stepUpVerified = true;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(ApiError.forbidden('Step-up re-authentication required or expired', 'STEP_UP_REQUIRED'));
  }
};

/**
 * Non-throwing companion to requireStepUp() — for routes where step-up is only conditionally
 * required (e.g. a loyalty rule edit that turns out, once the payload is inspected, to exceed
 * the approval threshold). The route itself stays open to everyone with the base permission;
 * the calling service decides, after reading the payload, whether to demand a verified token.
 */
export const isStepUpVerified = (req) => {
  try {
    const token = req?.headers?.['x-step-up-token'];
    if (!token) return false;
    const payload = tokenService.verifyStepUpToken(token);
    return payload.sub === req.auth?.userId;
  } catch {
    return false;
  }
};

export default requireStepUp;
