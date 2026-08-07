import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import AuthService from '../services/AuthService.js';
import { setAuthCookies, clearAuthCookies } from '../helpers/cookie.helper.js';
import { COOKIE_NAMES } from '../constants/index.js';

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  login = asyncHandler(async (req, res) => {
    const result = await this.authService.login(
      req.body,
      { userAgent: req.headers['user-agent'], ipAddress: req.ip },
      req
    );

    if (result.mfaRequired) {
      return ApiResponse.success(res, {
        message: 'MFA verification required',
        data: { mfaRequired: true, mfaChallengeToken: result.mfaChallengeToken },
      });
    }

    // SEC-021 — privileged role, not yet MFA-enrolled: no session issued, client must redirect
    // into the MFA setup flow (/auth/mfa/setup/start, /auth/mfa/setup/confirm) using mfaSetupToken.
    if (result.mfaSetupRequired) {
      return ApiResponse.success(res, {
        message: 'MFA enrollment required for this role before you can sign in',
        data: { mfaSetupRequired: true, mfaSetupToken: result.mfaSetupToken },
      });
    }

    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    return ApiResponse.success(res, {
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  });

  verifyMfa = asyncHandler(async (req, res) => {
    const result = await this.authService.verifyMfaChallenge(
      req.body,
      { userAgent: req.headers['user-agent'], ipAddress: req.ip },
      req
    );
    setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    return ApiResponse.success(res, { message: 'Login successful', data: result });
  });

  startMfaSetup = asyncHandler(async (req, res) => {
    const result = await this.authService.startMfaSetup(req.auth.userId);
    return ApiResponse.success(res, { message: 'Scan this into your authenticator app', data: result });
  });

  confirmMfaSetup = asyncHandler(async (req, res) => {
    // SEC-021 — when authenticated via mfaSetupToken (no prior session), confirming enrollment
    // also completes login: AuthService issues real tokens, which we set as cookies here exactly
    // like a normal login response. A real session (voluntary opt-in) just confirms MFA.
    const issueSession = Boolean(req.auth.viaMfaSetupToken);
    const result = await this.authService.confirmMfaSetup(req.auth.userId, req.body.token, req, {
      issueSession,
    });

    if (issueSession && result.accessToken) {
      setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    }

    return ApiResponse.success(res, { message: 'MFA enabled — store your backup codes safely', data: result });
  });

  disableMfa = asyncHandler(async (req, res) => {
    const result = await this.authService.disableMfa(req.auth.userId, req.body.token, req);
    return ApiResponse.success(res, { message: 'MFA disabled', data: result });
  });

  stepUp = asyncHandler(async (req, res) => {
    const result = await this.authService.stepUp(req.auth.userId, req.body, req);
    return ApiResponse.success(res, { message: 'Step-up verified', data: result });
  });

  refresh = asyncHandler(async (req, res) => {
    const refreshToken =
      req.body.refreshToken || req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];

    const result = await this.authService.refresh(refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // SEC-021 — role became MFA-required since the last login; no new tokens were issued.
    if (result.mfaSetupRequired) {
      clearAuthCookies(res);
      return ApiResponse.success(res, {
        message: 'MFA enrollment required for this role before you can continue',
        data: { mfaSetupRequired: true, mfaSetupToken: result.mfaSetupToken },
      });
    }

    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    return ApiResponse.success(res, {
      message: 'Token refreshed',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  });

  logout = asyncHandler(async (req, res) => {
    const refreshToken =
      req.body.refreshToken || req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];

    await this.authService.logout(refreshToken, req.auth?.userId || null, req);
    clearAuthCookies(res);

    return ApiResponse.success(res, { message: 'Logged out' });
  });

  me = asyncHandler(async (req, res) => {
    const user = await this.authService.me(req.auth.userId);
    return ApiResponse.success(res, { data: { user } });
  });

  forgotPassword = asyncHandler(async (req, res) => {
    const result = await this.authService.forgotPassword(req.body);
    return ApiResponse.success(res, { message: result.message, data: null });
  });
}

export default AuthController;
