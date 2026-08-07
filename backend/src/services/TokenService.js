import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { TOKEN_TYPE } from '../enums/index.js';

class TokenService {
  signAccessToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: TOKEN_TYPE.ACCESS,
      },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn }
    );
  }

  signRefreshToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: TOKEN_TYPE.REFRESH,
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  verifyAccessToken(token) {
    const payload = jwt.verify(token, config.jwt.accessSecret);
    if (payload.type !== TOKEN_TYPE.ACCESS) {
      throw new jwt.JsonWebTokenError('Invalid token type');
    }
    return payload;
  }

  verifyRefreshToken(token) {
    const payload = jwt.verify(token, config.jwt.refreshSecret);
    if (payload.type !== TOKEN_TYPE.REFRESH) {
      throw new jwt.JsonWebTokenError('Invalid token type');
    }
    return payload;
  }

  /** Short-lived challenge issued after password verification, before MFA is confirmed. */
  signMfaChallengeToken(userId) {
    return jwt.sign({ sub: userId, type: 'mfa_challenge' }, config.jwt.accessSecret, { expiresIn: '5m' });
  }

  verifyMfaChallengeToken(token) {
    const payload = jwt.verify(token, config.jwt.accessSecret);
    if (payload.type !== 'mfa_challenge') throw new jwt.JsonWebTokenError('Invalid token type');
    return payload;
  }

  /**
   * Short-lived token issued when a privileged role (config.security.mfaRequiredRoles) logs in
   * with a correct password but has not yet enrolled in MFA. Distinct from the mfa_challenge
   * token above: that one proves "password ok, now prove your existing TOTP enrollment"; this
   * one proves "password ok, now go enroll" — it is NOT sufficient to obtain a full session and
   * is only meant to authorize the /mfa/setup/start and /mfa/setup/confirm calls.
   */
  signMfaSetupToken(userId) {
    return jwt.sign({ sub: userId, type: 'mfa_setup_required' }, config.jwt.accessSecret, { expiresIn: '10m' });
  }

  verifyMfaSetupToken(token) {
    const payload = jwt.verify(token, config.jwt.accessSecret);
    if (payload.type !== 'mfa_setup_required') throw new jwt.JsonWebTokenError('Invalid token type');
    return payload;
  }

  /** Step-up token (SEC-002) — proves recent re-authentication for a sensitive action. */
  signStepUpToken(userId, minutes = config.security.stepUpTtlMinutes) {
    return jwt.sign({ sub: userId, type: 'step_up' }, config.jwt.accessSecret, { expiresIn: `${minutes}m` });
  }

  verifyStepUpToken(token) {
    const payload = jwt.verify(token, config.jwt.accessSecret);
    if (payload.type !== 'step_up') throw new jwt.JsonWebTokenError('Invalid token type');
    return payload;
  }
}

export default TokenService;
