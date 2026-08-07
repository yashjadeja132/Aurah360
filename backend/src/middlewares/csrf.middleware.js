import ApiError from '../libs/ApiError.js';
import { COOKIE_NAMES } from '../constants/index.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Double-submit-cookie CSRF protection (Task #41).
 *
 * `setAuthCookies` (backend/src/helpers/cookie.helper.js) issues a non-httpOnly
 * `csrf_token` cookie alongside the httpOnly access/refresh cookies whenever a
 * session is established (login/verifyMfa/refresh). The SPA reads that cookie's
 * value and echoes it back as the `X-CSRF-Token` header on every state-changing
 * request; a same-site attacker's forged cross-site request can make the browser
 * attach the cookie automatically, but has no way to read it, so it cannot supply
 * a matching header.
 *
 * This check only applies to requests authenticated via cookie. Requests carrying
 * an `Authorization: Bearer ...` header (mobile app, service/API-key style access)
 * are not automatically sent cross-site by browsers, so they are exempt — mirrors
 * the same bearer-vs-cookie distinction `authenticate` (auth.middleware.js) makes,
 * duplicated here (cheaply, without verifying the JWT) since this middleware runs
 * globally in app.js before route-level `authenticate` has had a chance to run.
 */
// Endpoints that establish or tear down a cookie session cannot be gated by a CSRF
// pairing that only exists once a session is already live — a stale/expired access_token
// cookie left over from before this middleware existed (or from a prior expired session)
// would otherwise permanently lock a real user out of ever logging in again, since they
// could never have a matching csrf_token cookie for a session they don't yet have.
const CSRF_EXEMPT_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/mfa/verify',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/forgot-password',
]);

export const csrfProtection = (req, _res, next) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const isBearerAuth = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
  if (isBearerAuth) {
    // Bearer-token auth is immune to CSRF; browsers never attach it automatically.
    return next();
  }

  const hasCookieSession = Boolean(
    req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] || req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN]
  );
  if (!hasCookieSession) {
    // No cookie-based session in play (e.g. public/unauthenticated endpoint) — nothing to protect.
    return next();
  }

  const csrfCookie = req.cookies?.[COOKIE_NAMES.CSRF_TOKEN];
  const csrfHeader = req.headers['x-csrf-token'];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return next(ApiError.forbidden('Invalid or missing CSRF token', 'CSRF_TOKEN_INVALID'));
  }

  next();
};

export default csrfProtection;
