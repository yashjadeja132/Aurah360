import ApiError from '../libs/ApiError.js';
import TokenService from '../services/TokenService.js';
import UserRepository from '../repositories/UserRepository.js';
import { COOKIE_NAMES } from '../constants/index.js';
import { USER_STATUS } from '../enums/userStatus.js';

const tokenService = new TokenService();
const userRepository = new UserRepository();

/**
 * Verifies JWT access token and attaches req.auth payload.
 */
export const authenticate = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
    const token = bearer || cookieToken;

    if (!token) {
      throw ApiError.unauthorized('Access token required');
    }

    const payload = tokenService.verifyAccessToken(token);

    // §16.6 termination — "revoke sessions/tokens... immediately". A signature+expiry check alone
    // lets an already-issued access token keep working for its full lifetime after a staff member
    // is deactivated. Re-checking isActive/status per request closes that window; the query is a
    // lean, indexed lookup on _id so the added cost is small relative to a full user hydration.
    const user = await userRepository.findByIdNotDeleted(payload.sub, {
      select: 'isActive status',
      lean: true,
    });
    if (!user || !user.isActive || user.status !== USER_STATUS.ACTIVE) {
      throw ApiError.unauthorized('User not found or inactive', 'USER_INACTIVE');
    }

    req.auth = {
      userId: payload.sub,
      role: payload.role,
      permissions: payload.permissions || [],
      branch: payload.branch || null,
      // Distinguishes cookie-based sessions (subject to CSRF, since browsers auto-attach
      // cookies cross-site) from Bearer-token auth (mobile app / API keys), which is not.
      viaCookie: !bearer && Boolean(cookieToken),
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Access token expired', 'TOKEN_EXPIRED'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('Invalid access token', 'TOKEN_INVALID'));
    }
    next(error);
  }
};

/**
 * SEC-021 — gates /auth/mfa/setup/start and /auth/mfa/setup/confirm, which must be reachable
 * both by a normally-authenticated user opting into MFA voluntarily (real Bearer/cookie session)
 * AND by a user who was routed straight into enrollment from login/refresh with mfaSetupRequired
 * (no session yet — only a short-lived mfaSetupToken, passed in the request body).
 *
 * Falls back to the normal `authenticate` check when a Bearer/cookie access token is present;
 * otherwise verifies req.body.mfaSetupToken and resolves req.auth.userId from its subject,
 * mirroring what `authenticate` would have set. Marks req.auth.viaMfaSetupToken so the controller
 * can tell the two cases apart (voluntary opt-in vs. forced enrollment mid-login).
 */
export const authenticateOrMfaSetupToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];

    if (bearer || cookieToken) {
      return authenticate(req, res, next);
    }

    const setupToken = req.body?.mfaSetupToken;
    if (!setupToken) {
      throw ApiError.unauthorized('Access token or mfaSetupToken required');
    }

    let payload;
    try {
      payload = tokenService.verifyMfaSetupToken(setupToken);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('MFA setup token expired — please log in again', 'TOKEN_EXPIRED');
      }
      throw ApiError.unauthorized('Invalid or expired MFA setup token', 'TOKEN_INVALID');
    }

    req.auth = {
      userId: payload.sub,
      role: null,
      permissions: [],
      branch: null,
      viaCookie: false,
      viaMfaSetupToken: true,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Loads authenticated user onto req.user. Must run after authenticate.
 */
export const currentUser = async (req, _res, next) => {
  try {
    if (!req.auth?.userId) {
      throw ApiError.unauthorized();
    }

    const user = await userRepository.findByIdNotDeleted(req.auth.userId);
    if (!user || !user.isActive || user.status !== USER_STATUS.ACTIVE) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
