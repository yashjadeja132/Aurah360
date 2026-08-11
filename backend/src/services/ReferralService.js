import crypto from 'crypto';
import Referral, { REFERRAL_STATUS } from '../models/Referral.model.js';
import Patient from '../models/Patient.model.js';
import LoyaltyProgramSettings from '../models/LoyaltyProgramSettings.model.js';
import LoyaltyEarningEngineService from './LoyaltyEarningEngineService.js';
import AuditService from './AuditService.js';
import logger from '../libs/logger.js';
import { LOYALTY_EARNING_EVENT, LOYALTY_SOURCE_REF_TYPE } from '../enums/loyalty.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids misread codes
const CODE_LENGTH = 6;

function randomCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * LOY Flow C — patient-referral tracking. Fills the gap eventSubscriptions.js documents at
 * E5 (REFERRAL_REFERRER/REFERRAL_REFEREE): pairs an existing patient (referrer) with a new
 * patient (referee) via a Referral document, applies anti-abuse checks at creation time, and
 * credits both sides through the SAME LoyaltyEarningEngineService.resolveAndCredit() call every
 * other event (E1-E4/E8) already uses — see #creditBothSides.
 */
class ReferralService {
  constructor() {
    this.engine = new LoyaltyEarningEngineService();
    this.auditService = new AuditService();
  }

  /** Returns this patient's stable referral code, generating+persisting one on first call. */
  async codeForPatient(patientId) {
    const patient = await Patient.findById(patientId).select('referralCode').lean();
    if (!patient) return null;
    if (patient.referralCode) return patient.referralCode;

    // Retry on the rare collision — the unique index on Patient.referralCode is the real guard.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomCode();
      try {
        await Patient.updateOne(
          { _id: patientId, referralCode: null },
          { $set: { referralCode: code } }
        );
        const updated = await Patient.findById(patientId).select('referralCode').lean();
        if (updated?.referralCode) return updated.referralCode;
      } catch (err) {
        if (err?.code !== 11000) throw err;
        // duplicate key on the generated code — try again
      }
    }
    throw new Error('Could not generate a unique referral code');
  }

  /**
   * Resolves a referral code to its owning (referrer) patient. Returns null for an unknown code
   * rather than throwing — callers treat "no referral" and "bad code" the same way (silently
   * skip referral tracking; registration itself must never fail because of a typo'd code).
   */
  async #resolveReferrer(referralCode) {
    if (!referralCode) return null;
    const code = String(referralCode).trim().toUpperCase();
    if (!code) return null;
    return Patient.findOne({ referralCode: code, deletedAt: null }).select('_id').lean();
  }

  async #monthlyCountForReferrer(referrerPatientId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return Referral.countDocuments({
      referrerPatientId,
      createdAt: { $gte: monthStart },
    });
  }

  /**
   * Called right after a new patient is created (self-registration, reception registration, or
   * CRM lead-to-patient conversion) when a referral code was supplied. Creates the Referral
   * document with the correct PENDING/BLOCKED_* status. Never throws — a referral-tracking
   * failure must not block patient registration.
   *
   * @param {object} params
   *   refereePatientId, referralCode, branchId, createdBy (staff userId, null for self-service), req
   */
  async registerReferral({ refereePatientId, referralCode, branchId = null, createdBy = null, req = null }) {
    try {
      if (!referralCode || !refereePatientId) return null;

      const referrer = await this.#resolveReferrer(referralCode);
      if (!referrer) return null; // unknown/typo'd code — silently skip, do not fail registration

      const referrerPatientId = referrer._id.toString();
      const refereeId = refereePatientId.toString();

      // Self-referral block.
      if (referrerPatientId === refereeId) {
        return Referral.create({
          referrerPatientId,
          refereePatientId: refereeId,
          referralCode: String(referralCode).trim().toUpperCase(),
          branchId,
          createdBy,
          status: REFERRAL_STATUS.BLOCKED_SELF_REFERRAL,
          blockedReason: 'Referrer and referee resolve to the same patient',
        });
      }

      // Monthly cap block. GAP: same-device/IP anti-abuse is NOT implemented — this codebase
      // captures no device fingerprint or IP hash anywhere in patient registration or auth
      // (PatientService.create, PatientAuthService OTP login) for this to compare against.
      // Referral.model.js keeps deviceFingerprint/ipHash fields for when that capture exists.
      const settings = await LoyaltyProgramSettings.findOne().sort({ effectiveFrom: -1 }).lean();
      const cap = settings?.referralMonthlyCapPerPatient ?? 10;
      const monthlyCount = await this.#monthlyCountForReferrer(referrerPatientId);
      const status =
        monthlyCount >= cap ? REFERRAL_STATUS.BLOCKED_MONTHLY_CAP : REFERRAL_STATUS.PENDING;

      const referral = await Referral.create({
        referrerPatientId,
        refereePatientId: refereeId,
        referralCode: String(referralCode).trim().toUpperCase(),
        branchId,
        createdBy,
        status,
        blockedReason: status === REFERRAL_STATUS.BLOCKED_MONTHLY_CAP
          ? `Referrer already created ${monthlyCount} referrals this month (cap ${cap})`
          : null,
      });

      if (createdBy) {
        await this.auditService.record(AUDIT_ACTIONS.REFERRAL_STAFF_CREATED, {
          actorId: createdBy,
          metadata: {
            referralId: referral._id.toString(),
            referrerPatientId,
            refereePatientId: refereeId,
            referralCode: referral.referralCode,
            status,
          },
          resourceType: 'Referral',
          resourceId: referral._id.toString(),
          branchId,
          req,
        });
      }

      return referral;
    } catch (err) {
      logger.warn('ReferralService.registerReferral failed', { message: err.message });
      return null;
    }
  }

  /**
   * Called from the INVOICE_PAID handler (same event E2 SPEND_BASED already listens on) once an
   * invoice for the referee is paid. Qualifies+credits a PENDING referral on the referee's FIRST
   * completed+paid visit only — subsequent visits/invoices are no-ops because the Referral is no
   * longer PENDING.
   */
  async qualifyAndCreditIfPending({ refereePatientId, invoiceId, branchId, occurredAt }) {
    try {
      if (!refereePatientId) return;
      const referral = await Referral.findOne({
        refereePatientId,
        status: REFERRAL_STATUS.PENDING,
      });
      if (!referral) return;

      referral.status = REFERRAL_STATUS.QUALIFIED;
      referral.qualifyingInvoiceId = invoiceId || null;
      await referral.save();

      await this.#creditBothSides(referral, { branchId, occurredAt, invoiceId });

      referral.status = REFERRAL_STATUS.CREDITED;
      referral.creditedAt = new Date();
      await referral.save();
    } catch (err) {
      logger.warn('ReferralService.qualifyAndCreditIfPending failed', { message: err.message });
    }
  }

  /**
   * Mirrors the exact resolveAndCredit() call shape eventSubscriptions.js uses for every other
   * event (E1-E4/E8) — point VALUES come entirely from whatever LoyaltyEarningRule rows exist
   * for REFERRAL_REFERRER/REFERRAL_REFEREE; if none are configured, resolveAndCredit() is a
   * documented no-op (empty rules list) and nothing is credited. That is a data/seed gap, not a
   * code gap — see ReferralService's module comment / final report.
   */
  async #creditBothSides(referral, { branchId, occurredAt, invoiceId }) {
    const effectiveBranchId = branchId || referral.branchId;
    if (!effectiveBranchId) return;

    await this.engine.resolveAndCredit(LOYALTY_EARNING_EVENT.REFERRAL_REFERRER, {
      patientId: referral.referrerPatientId,
      branchId: effectiveBranchId,
      occurredAt,
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.REFERRAL,
      sourceRefId: referral._id,
      idempotencyKey: `referral-referrer:${referral._id}`,
    });

    await this.engine.resolveAndCredit(LOYALTY_EARNING_EVENT.REFERRAL_REFEREE, {
      patientId: referral.refereePatientId,
      branchId: effectiveBranchId,
      occurredAt,
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.REFERRAL,
      sourceRefId: referral._id,
      idempotencyKey: `referral-referee:${referral._id}`,
    });
  }

  /** Patient-portal "my referrals" view — generic status labels, no PHI/financial detail about
   *  the referee ever exposed (first name/initial + status only). */
  async myReferrals(patientId) {
    const code = await this.codeForPatient(patientId);
    const referrals = await Referral.find({ referrerPatientId: patientId })
      .sort({ createdAt: -1 })
      .populate('refereePatientId', 'firstName')
      .lean();

    return {
      referralCode: code,
      referrals: referrals.map((r) => ({
        id: r._id.toString(),
        refereeFirstName: r.refereePatientId?.firstName || null,
        status: r.status,
        createdAt: r.createdAt,
        creditedAt: r.creditedAt || null,
      })),
    };
  }
}

export default ReferralService;
