import ApiError from '../libs/ApiError.js';
import UserRepository from '../repositories/UserRepository.js';
import RefreshTokenRepository from '../repositories/RefreshTokenRepository.js';
import TokenService from './TokenService.js';
import RoleService from './RoleService.js';
import AuditService from './AuditService.js';
import { comparePassword, generateOpaqueToken, sha256 } from '../helpers/crypto.helper.js';
import { USER_STATUS } from '../enums/userStatus.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { ROLES } from '../constants/roles.js';
import User from '../models/User.model.js';
import config from '../config/index.js';
import { generateTotpSecret, verifyTotpToken, generateBackupCodes } from '../helpers/totp.helper.js';

class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
    this.refreshTokenRepository = new RefreshTokenRepository();
    this.tokenService = new TokenService();
    this.roleService = new RoleService();
    this.auditService = new AuditService();
  }

  async #effectivePermissions(user) {
    if (user.role === ROLES.OWNER) {
      return ['*'];
    }
    return this.roleService.getEffectivePermissions(user.role, user.permissions || []);
  }

  async #buildAccessPayload(user) {
    const permissions = await this.#effectivePermissions(user);
    return {
      sub: user._id.toString(),
      role: user.role,
      permissions,
      branch: user.branch ? user.branch.toString() : null,
    };
  }

  /** True when the user's role is in config.security.mfaRequiredRoles and they haven't enrolled yet. */
  #mfaSetupRequired(user) {
    return config.security.mfaRequiredRoles.includes(user.role) && !user.mfaEnabled;
  }

  async #issueTokenPair(user, meta = {}) {
    const accessPayload = await this.#buildAccessPayload(user);
    const accessToken = this.tokenService.signAccessToken(accessPayload);

    const refreshRaw = generateOpaqueToken();
    const refreshToken = this.tokenService.signRefreshToken({
      sub: user._id.toString(),
      jti: refreshRaw.slice(0, 32),
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepository.create({
      userId: user._id,
      tokenHash: sha256(refreshToken),
      expiresAt,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    });

    return { accessToken, refreshToken, expiresAt, permissions: accessPayload.permissions };
  }

  async login({ email, password }, meta = {}, req = null) {
    const user = await this.userRepository.findByEmail(email, { withPassword: true });

    if (!user) {
      await this.auditService.record(AUDIT_ACTIONS.LOGIN_FAILED, {
        metadata: { email },
        req,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive || user.status !== USER_STATUS.ACTIVE || user.deletedAt) {
      throw ApiError.forbidden('Account is not active');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await this.auditService.record(AUDIT_ACTIONS.LOGIN_FAILED, {
        actorId: user._id,
        targetUserId: user._id,
        metadata: { email },
        req,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    // SEC-002 — MFA-enrolled staff get a short-lived challenge instead of a session.
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        mfaChallengeToken: this.tokenService.signMfaChallengeToken(user._id.toString()),
      };
    }

    // SEC-021 — password alone is not enough for a privileged role (config.security.mfaRequiredRoles)
    // that hasn't personally enrolled in MFA yet. Do NOT issue full session tokens here; instead
    // return a distinct "must enroll" response so the client can redirect into the existing MFA
    // setup flow (POST /auth/mfa/setup/start then /auth/mfa/setup/confirm), authenticated with the
    // mfaSetupToken below rather than a normal access token.
    //
    // Response shape:
    //   { mfaSetupRequired: true, mfaSetupToken: <short-lived JWT, type: 'mfa_setup_required'> }
    //
    // This is enforced at login (and again at refresh — see refresh() below) only. Resetting
    // MFA_REQUIRED_ROLES at runtime is intentionally NOT retroactive via a background sweep: an
    // already-issued session/refresh token keeps working until it is next refreshed or expires,
    // at which point this same check re-applies and the user is routed into enrollment.
    if (this.#mfaSetupRequired(user)) {
      return {
        mfaSetupRequired: true,
        mfaSetupToken: this.tokenService.signMfaSetupToken(user._id.toString()),
      };
    }

    await this.userRepository.updateById(user._id, { lastLogin: new Date() });
    const tokens = await this.#issueTokenPair(user, meta);

    await this.auditService.record(AUDIT_ACTIONS.LOGIN, {
      actorId: user._id,
      targetUserId: user._id,
      req,
    });

    return {
      user: user.toSafeObject({ permissions: tokens.permissions }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /** Completes login after MFA challenge with a TOTP code or a one-time backup code. */
  async verifyMfaChallenge({ challengeToken, token }, meta = {}, req = null) {
    let payload;
    try {
      payload = this.tokenService.verifyMfaChallengeToken(challengeToken);
    } catch {
      throw ApiError.unauthorized('MFA challenge expired or invalid — please log in again');
    }

    const user = await User.findById(payload.sub).select('+mfaSecret +mfaBackupCodes').exec();
    if (!user || !user.mfaEnabled) throw ApiError.unauthorized('MFA is not enabled for this account');

    const isValidTotp = verifyTotpToken(user.mfaSecret, token);
    const backupIndex = (user.mfaBackupCodes || []).indexOf(token);
    const isValidBackup = backupIndex !== -1;

    if (!isValidTotp && !isValidBackup) {
      await this.auditService.record(AUDIT_ACTIONS.MFA_CHALLENGE_FAILED, {
        actorId: user._id,
        targetUserId: user._id,
        req,
      });
      throw ApiError.unauthorized('Invalid MFA code');
    }

    if (isValidBackup) {
      user.mfaBackupCodes.splice(backupIndex, 1);
      await user.save();
    }

    await this.userRepository.updateById(user._id, { lastLogin: new Date() });
    const tokens = await this.#issueTokenPair(user, meta);

    await this.auditService.record(AUDIT_ACTIONS.LOGIN, {
      actorId: user._id,
      targetUserId: user._id,
      req,
    });

    return {
      user: user.toSafeObject({ permissions: tokens.permissions }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /** Begin MFA enrollment — returns a pending secret + manual-entry URI (no QR lib dependency). */
  async startMfaSetup(userId) {
    const secret = generateTotpSecret();
    await this.userRepository.updateById(userId, { mfaPendingSecret: secret });
    const user = await this.userRepository.findByIdNotDeleted(userId);
    const label = encodeURIComponent(`${config.security.mfaIssuer}:${user.email}`);
    const issuer = encodeURIComponent(config.security.mfaIssuer);
    return {
      secret,
      otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`,
    };
  }

  /**
   * Confirms enrollment with one valid code, activates MFA and issues one-time backup codes.
   *
   * SEC-021 — when `issueSession` is true (the request was authenticated via mfaSetupToken
   * rather than a real session, i.e. enrollment was forced mid-login/refresh), completes login
   * right here: issues a real access/refresh token pair through the same #issueTokenPair path
   * used by login()/verifyMfaChallenge(), so the response looks like a normal successful login.
   * When false (voluntary opt-in from an already-authenticated user), behavior is unchanged —
   * just confirms MFA, since a session already exists.
   */
  async confirmMfaSetup(userId, token, req = null, { issueSession = false } = {}) {
    const user = await User.findById(userId).select('+mfaPendingSecret').exec();
    if (!user?.mfaPendingSecret) throw ApiError.badRequest('No pending MFA setup — call startMfaSetup first');
    if (!verifyTotpToken(user.mfaPendingSecret, token)) throw ApiError.badRequest('Invalid MFA code');

    const backupCodes = generateBackupCodes();
    user.mfaSecret = user.mfaPendingSecret;
    user.mfaPendingSecret = null;
    user.mfaEnabled = true;
    user.mfaEnabledAt = new Date();
    user.mfaBackupCodes = backupCodes;
    await user.save();

    await this.auditService.record(AUDIT_ACTIONS.MFA_ENABLED, { actorId: userId, targetUserId: userId, req });

    if (!issueSession) {
      return { enabled: true, backupCodes };
    }

    await this.userRepository.updateById(user._id, { lastLogin: new Date() });
    const tokens = await this.#issueTokenPair(user, {
      userAgent: req?.headers?.['user-agent'],
      ipAddress: req?.ip,
    });

    await this.auditService.record(AUDIT_ACTIONS.LOGIN, { actorId: user._id, targetUserId: user._id, req });

    return {
      enabled: true,
      backupCodes,
      user: user.toSafeObject({ permissions: tokens.permissions }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async disableMfa(userId, token, req = null) {
    const user = await User.findById(userId).select('+mfaSecret').exec();
    if (!user?.mfaEnabled) throw ApiError.badRequest('MFA is not enabled');
    if (!verifyTotpToken(user.mfaSecret, token)) throw ApiError.badRequest('Invalid MFA code');

    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.mfaBackupCodes = [];
    await user.save();

    await this.auditService.record(AUDIT_ACTIONS.MFA_DISABLED, { actorId: userId, targetUserId: userId, req });
    return { enabled: false };
  }

  /** SEC-002 — step-up re-authentication before a privileged action (export/refund/role-change/etc.). */
  async stepUp(userId, { password, mfaToken }, req = null) {
    const user = await User.findById(userId).select('+passwordHash +mfaSecret').exec();
    if (!user) throw ApiError.notFound('User not found');

    const passwordOk = password ? await comparePassword(password, user.passwordHash) : false;
    const mfaOk = user.mfaEnabled && mfaToken ? verifyTotpToken(user.mfaSecret, mfaToken) : false;

    if (!passwordOk && !mfaOk) {
      throw ApiError.unauthorized('Re-authentication failed');
    }

    await this.auditService.record(AUDIT_ACTIONS.STEP_UP_VERIFIED, { actorId: userId, targetUserId: userId, req });
    return { stepUpToken: this.tokenService.signStepUpToken(userId.toString()) };
  }

  async refresh(refreshToken, meta = {}) {
    if (!refreshToken) {
      throw ApiError.unauthorized('Refresh token required');
    }

    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token', 'TOKEN_INVALID');
    }

    const stored = await this.refreshTokenRepository.findValidByHash(sha256(refreshToken));
    if (!stored) {
      throw ApiError.unauthorized('Refresh token revoked or expired', 'TOKEN_REVOKED');
    }

    const user = await this.userRepository.findActiveById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    // SEC-021 — re-checked on every refresh (not just login) so that a role becoming MFA-required
    // at runtime is picked up the next time this user's session is refreshed, without a background
    // sweep forcibly killing already-active sessions. The old refresh token is revoked either way,
    // matching normal rotation, but no new tokens are issued until MFA is enrolled.
    if (this.#mfaSetupRequired(user)) {
      await this.refreshTokenRepository.revokeByHash(sha256(refreshToken));
      return {
        mfaSetupRequired: true,
        mfaSetupToken: this.tokenService.signMfaSetupToken(user._id.toString()),
      };
    }

    // Token rotation — revoke old, issue new
    await this.refreshTokenRepository.revokeByHash(sha256(refreshToken));
    const tokens = await this.#issueTokenPair(user, meta);

    return {
      user: user.toSafeObject({ permissions: tokens.permissions }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken, actorId = null, req = null) {
    if (refreshToken) {
      await this.refreshTokenRepository.revokeByHash(sha256(refreshToken));
    }

    await this.auditService.record(AUDIT_ACTIONS.LOGOUT, {
      actorId,
      targetUserId: actorId,
      req,
    });

    return true;
  }

  async me(userId) {
    const user = await this.userRepository.findActiveById(userId);
    if (!user) {
      throw ApiError.unauthorized('User not found or inactive');
    }
    const permissions = await this.#effectivePermissions(user);
    return user.toSafeObject({ permissions });
  }

  /** Placeholder — email delivery wired in communications module later */
  async forgotPassword({ email }) {
    const user = await this.userRepository.findByEmail(email);
    // Always return success to avoid email enumeration
    if (user) {
      // Placeholder: would enqueue reset email job
    }
    return {
      message: 'If an account exists for this email, password reset instructions will be sent.',
    };
  }
}

export default AuthService;
