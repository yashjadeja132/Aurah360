import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { sanitizeRequest } from './sanitize.middleware.js';

/** Helmet with CSP tuned for API + Swagger UI. */
export function securityHeaders() {
  const isProd = config.app.env === 'production';
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", ...config.cors.origins],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
  });
}

export function mongoInjectionProtection() {
  return mongoSanitize({
    replaceWith: '_',
    allowDots: true,
  });
}

export function parameterPollutionProtection() {
  return hpp({
    whitelist: [
      'status',
      'branchId',
      'doctorId',
      'departmentId',
      'serviceId',
      'tags',
      'roles',
      'sort',
      'fields',
    ],
  });
}

export function globalRateLimiter() {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMITED',
    },
  });
}

/** Stricter limiter for auth endpoints (login/refresh/forgot). */
export function authRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.app.env === 'production' ? 30 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMITED',
    },
  });
}

export { sanitizeRequest };

export default {
  securityHeaders,
  mongoInjectionProtection,
  parameterPollutionProtection,
  globalRateLimiter,
  authRateLimiter,
  sanitizeRequest,
};
