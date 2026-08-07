import crypto from 'crypto';
import Patient from '../models/Patient.model.js';
import PatientRefreshToken from '../models/PatientRefreshToken.model.js';
import OtpCode from '../models/OtpCode.model.js';
import PatientTokenService from './PatientTokenService.js';
import AuditService from './AuditService.js';
import ApiError from '../libs/ApiError.js';
import { comparePassword, hashPassword, generateOpaqueToken, sha256 } from '../helpers/crypto.helper.js';
import { ENTITY_STATUS } from '../constants/index.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { PATIENT_PORTAL_EVENTS } from '../enums/patientPortal.js';
import { eventBus } from '../events/eventBus.js';
import { createDefaultProviders } from '../notifications/providers.js';
import config from '../config/index.js';

const OTP_TTL_MINUTES = 5;
const OTP_MAX_REQUESTS_PER_HOUR = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

class PatientAuthService {
  constructor() {
    this.tokenService = new PatientTokenService();
    this.audit = new AuditService();
  }

  async #issueTokenPair(patient, meta = {}) {
    const accessToken = this.tokenService.signAccessToken({
      sub: patient._id.toString(),
      mrn: patient.mrn,
      email: patient.email,
    });

    const refreshRaw = generateOpaqueToken();
    const refreshToken = this.tokenService.signRefreshToken({
      sub: patient._id.toString(),
      jti: refreshRaw.slice(0, 32),
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await PatientRefreshToken.create({
      patientId: patient._id,
      tokenHash: sha256(refreshToken),
      expiresAt,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    });

    return { accessToken, refreshToken, expiresAt };
  }

  async login({ email, password, mobile }, meta = {}, req = null) {
    const emailNorm = email ? String(email).trim().toLowerCase() : null;
    const mobileNorm = mobile ? String(mobile).trim() : null;
    if ((!emailNorm && !mobileNorm) || !password) {
      throw ApiError.badRequest('Email/mobile and password are required');
    }

    const or = [];
    if (emailNorm) or.push({ email: emailNorm });
    if (mobileNorm) or.push({ mobile: mobileNorm });

    const patient = await Patient.findOne({
      deletedAt: null,
      portalEnabled: true,
      $or: or,
    }).select('+passwordHash');

    if (!patient || !patient.passwordHash) {
      await this.audit.record(AUDIT_ACTIONS.PATIENT_LOGIN_FAILED, {
        metadata: { email: emailNorm, mobile: mobileNorm },
        req,
      });
      throw ApiError.unauthorized('Invalid credentials');
    }

    if (!patient.isActive || patient.status !== ENTITY_STATUS.ACTIVE || patient.isBlacklisted) {
      throw ApiError.forbidden('Account is not active');
    }

    const valid = await comparePassword(password, patient.passwordHash);
    if (!valid) {
      await this.audit.record(AUDIT_ACTIONS.PATIENT_LOGIN_FAILED, {
        metadata: {
          patientId: patient._id.toString(),
          email: emailNorm,
          mobile: mobileNorm,
        },
        req,
      });
      throw ApiError.unauthorized('Invalid credentials');
    }

    patient.lastPortalLogin = new Date();
    await patient.save();

    const tokens = await this.#issueTokenPair(patient, meta);

    await this.audit.record(AUDIT_ACTIONS.PATIENT_LOGIN, {
      metadata: { patientId: patient._id.toString(), mrn: patient.mrn },
      req,
    });

    eventBus.emitDomain(PATIENT_PORTAL_EVENTS.PATIENT_LOGGED_IN, {
      patientId: patient._id.toString(),
      mrn: patient.mrn,
    });

    return {
      patient: patient.toSafeObject(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken, meta = {}) {
    if (!refreshToken) throw ApiError.unauthorized('Refresh token required');

    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token', 'TOKEN_INVALID');
    }

    const stored = await PatientRefreshToken.findOne({
      tokenHash: sha256(refreshToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!stored) throw ApiError.unauthorized('Refresh token revoked or expired', 'TOKEN_REVOKED');

    const patient = await Patient.findOne({
      _id: payload.sub,
      deletedAt: null,
      portalEnabled: true,
      isActive: true,
    });
    if (!patient) throw ApiError.unauthorized('Patient not found');

    stored.revokedAt = new Date();
    await stored.save();

    const tokens = await this.#issueTokenPair(patient, meta);
    return {
      patient: patient.toSafeObject(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken, patientId = null, req = null) {
    if (refreshToken) {
      await PatientRefreshToken.updateOne(
        { tokenHash: sha256(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    await this.audit.record(AUDIT_ACTIONS.PATIENT_LOGOUT, {
      metadata: { patientId },
      req,
    });
    return { success: true };
  }

  async me(patientId) {
    const patient = await Patient.findOne({ _id: patientId, deletedAt: null });
    if (!patient) throw ApiError.notFound('Patient not found');
    return patient.toSafeObject();
  }

  async forgotPassword({ email }) {
    // Placeholder — never reveal whether email exists
    return {
      message: 'If an account exists, password reset instructions will be sent.',
      placeholder: true,
      email: email || null,
    };
  }

  /** APP-002 — request an OTP for the primary mobile. Rate-limited; never reveals whether the mobile is registered. */
  async requestOtp(mobile, req = null) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await OtpCode.countDocuments({ mobile, createdAt: { $gte: oneHourAgo } });
    if (recentCount >= OTP_MAX_REQUESTS_PER_HOUR) {
      throw ApiError.tooManyRequests('Too many OTP requests — please try again later.');
    }

    const patient = await Patient.findOne({ mobile, deletedAt: null, portalEnabled: true }).exec();

    // Always generate/store an OTP row and return the same response, whether or not the
    // mobile is registered — anti-enumeration (§16.6).
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await OtpCode.create({
      mobile,
      codeHash: sha256(code),
      purpose: 'LOGIN',
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });

    if (patient) {
      const provider = createDefaultProviders(config).SMS;
      try {
        await provider.send({
          to: mobile,
          body: `${code} is your Aurah 360 ClinicOS verification code. Valid for ${OTP_TTL_MINUTES} minutes.`,
          meta: {
            otpCode: code,
            validityMinutes: OTP_TTL_MINUTES,
            // Required by HttpDltSmsProvider — locks the send to the registered OTP template
            // shape; ignored by providers (e.g. BulkSendersSmsProvider) that build their own text.
            templateId: 'OTP',
            templateParams: { otpCode: code, validityMinutes: OTP_TTL_MINUTES },
          },
        });
      } catch {
        // Delivery failure never blocks the flow (NFR-020 safe-failure); the code still verifies.
      }
      await this.audit.record(AUDIT_ACTIONS.PATIENT_LOGIN, {
        targetUserId: patient._id,
        metadata: { channel: 'OTP_REQUESTED' },
        req,
      });
    }

    return {
      message: 'If this number is registered, a verification code has been sent.',
      expiresInMinutes: OTP_TTL_MINUTES,
      // Only ever present outside production, to make local/dev testing possible without a real SMS vendor.
      devCode: config.app.env !== 'production' ? code : undefined,
    };
  }

  /** Verifies the OTP and issues a normal session — the app's primary sign-in path. */
  async otpLogin({ mobile, code }, meta = {}, req = null) {
    const otp = await OtpCode.findOne({ mobile, consumedAt: null, purpose: 'LOGIN' }).sort({ createdAt: -1 }).exec();
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      throw ApiError.unauthorized('Code expired or not found — request a new one.');
    }
    if (otp.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      throw ApiError.tooManyRequests('Too many incorrect attempts — request a new code.');
    }
    if (otp.codeHash !== sha256(code)) {
      otp.attempts += 1;
      await otp.save();
      throw ApiError.unauthorized('Incorrect code.');
    }

    otp.consumedAt = new Date();
    await otp.save();

    const patient = await Patient.findOne({ mobile, deletedAt: null, portalEnabled: true, isActive: true }).exec();
    if (!patient) {
      throw ApiError.unauthorized('This mobile number is not registered for app access. Please contact your clinic.');
    }

    const tokens = await this.#issueTokenPair(patient, meta);
    await this.audit.record(AUDIT_ACTIONS.PATIENT_LOGIN, { targetUserId: patient._id, metadata: { channel: 'OTP' }, req });
    eventBus.emitDomain(PATIENT_PORTAL_EVENTS.PATIENT_LOGGED_IN, { patientId: patient._id.toString(), channel: 'OTP' });

    return {
      patient: patient.toSafeObject(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async verifyEmail() {
    return {
      message: 'Email verification is not enabled yet (placeholder).',
      placeholder: true,
    };
  }

  async changePassword(patientId, { currentPassword, newPassword }, req = null) {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw ApiError.badRequest('Current password and a new password (min 8 chars) are required');
    }

    const patient = await Patient.findOne({ _id: patientId, deletedAt: null }).select('+passwordHash');
    if (!patient?.passwordHash) throw ApiError.notFound('Patient not found');

    const valid = await comparePassword(currentPassword, patient.passwordHash);
    if (!valid) throw ApiError.unauthorized('Current password is incorrect');

    patient.passwordHash = await hashPassword(newPassword);
    await patient.save();

    await PatientRefreshToken.updateMany(
      { patientId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    await this.audit.record(AUDIT_ACTIONS.PATIENT_PASSWORD_CHANGED, {
      metadata: { patientId: patient._id.toString() },
      req,
    });

    return { success: true };
  }
}

export default PatientAuthService;
