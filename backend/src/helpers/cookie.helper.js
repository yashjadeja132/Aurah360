import crypto from 'crypto';
import config from '../config/index.js';
import { COOKIE_NAMES } from '../constants/index.js';

/**
 * Cookie helpers for access/refresh tokens.
 */
export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const common = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/',
  };

  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
    ...common,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
    ...common,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Double-submit-cookie CSRF pattern: readable by the SPA JS so it can echo the value
  // back as an X-CSRF-Token header on state-changing requests. Not httpOnly by design —
  // it carries no secret, its only purpose is to prove the request wasn't cross-site.
  res.cookie(COOKIE_NAMES.CSRF_TOKEN, crypto.randomBytes(32).toString('hex'), {
    httpOnly: false,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearAuthCookies = (res) => {
  const common = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/',
  };
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, common);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, common);
  res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, {
    ...common,
    httpOnly: false,
  });
};

export default { setAuthCookies, clearAuthCookies };
