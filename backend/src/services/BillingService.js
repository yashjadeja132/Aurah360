import ApiError from '../libs/ApiError.js';
import { config } from '../config/index.js';
import { InvoiceRepository, PaymentRepository } from '../repositories/BillingRepository.js';
import TreatmentPlanRepository from '../repositories/TreatmentPlanRepository.js';
import ConsultationRepository from '../repositories/ConsultationRepository.js';
import PatientRepository from '../repositories/PatientRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import {
  generateInvoiceNumber,
  generatePaymentNumber,
  generateReceiptNumber,
  generateCreditNoteNumber,
} from '../helpers/invoiceNumber.helper.js';
import {
  BILLING_EVENTS,
  DISCOUNT_TYPE,
  INVOICE_ITEM_TYPE,
  INVOICE_STATUS,
  PAYMENT_METHOD,
  PAYMENT_RECORD_STATUS,
  PAYMENT_STATUS,
} from '../enums/billing.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import CreditNote from '../models/CreditNote.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import LoyaltyLedgerService from './LoyaltyLedgerService.js';
import { LOYALTY_ENTRY_TYPE, LOYALTY_SOURCE_REF_TYPE } from '../enums/loyalty.js';
import logger from '../libs/logger.js';

/**
 * Billing converts plans/services into invoices.
 * Does not execute treatments, touch inventory, or pharmacy.
 */
class BillingService {
  constructor() {
    this.invoiceRepository = new InvoiceRepository();
    this.paymentRepository = new PaymentRepository();
    this.treatmentPlanRepository = new TreatmentPlanRepository();
    this.consultationRepository = new ConsultationRepository();
    this.patientRepository = new PatientRepository();
    this.branchRepository = new BranchRepository();
    this.auditService = new AuditService();
    this.loyaltyLedgerService = new LoyaltyLedgerService();
  }

  #round(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  #mapInvoice(doc, payments = null) {
    if (!doc) return null;
    const extra = {};
    if (doc.patientId?.firstName) {
      extra.patient = {
        id: doc.patientId._id.toString(),
        mrn: doc.patientId.mrn,
        fullName: [doc.patientId.firstName, doc.patientId.lastName].filter(Boolean).join(' '),
        mobile: doc.patientId.mobile,
        email: doc.patientId.email,
      };
      extra.patientId = doc.patientId._id.toString();
    }
    if (doc.doctorId?.doctorCode) {
      const u = doc.doctorId.userId;
      extra.doctor = {
        id: doc.doctorId._id.toString(),
        doctorCode: doc.doctorId.doctorCode,
        name: u ? `${u.firstName} ${u.lastName}`.trim() : null,
      };
      extra.doctorId = doc.doctorId._id.toString();
    }
    if (doc.branchId?.name || doc.branchId?.displayName) {
      extra.branch = {
        id: doc.branchId._id.toString(),
        name: doc.branchId.displayName || doc.branchId.name,
        branchCode: doc.branchId.branchCode,
        address: doc.branchId.address,
        phone: doc.branchId.phone,
        email: doc.branchId.email,
        currency: doc.branchId.currency || 'INR',
        taxPercent: doc.branchId.settings?.taxPercent ?? 18,
        gstEnabled: doc.branchId.settings?.gstEnabled !== false,
        gstNumber: doc.branchId.settings?.gstNumber || null,
      };
      extra.branchId = doc.branchId._id.toString();
    }
    if (doc.consultationId?.consultationNumber) {
      extra.consultation = {
        id: doc.consultationId._id.toString(),
        consultationNumber: doc.consultationId.consultationNumber,
        status: doc.consultationId.status,
      };
      extra.consultationId = doc.consultationId._id.toString();
    }
    if (doc.treatmentPlanId?.planNumber) {
      extra.treatmentPlan = {
        id: doc.treatmentPlanId._id.toString(),
        planNumber: doc.treatmentPlanId.planNumber,
        title: doc.treatmentPlanId.title,
        status: doc.treatmentPlanId.status,
      };
      extra.treatmentPlanId = doc.treatmentPlanId._id.toString();
    }
    if (payments) {
      extra.payments = payments.map((p) => p.toSafeObject());
    }
    const safe = doc.toSafeObject(extra);
    const progress =
      safe.total > 0 ? Math.min(100, this.#round((safe.paidAmount / safe.total) * 100)) : 0;
    safe.paymentProgress = progress;
    safe.outstanding = safe.balanceAmount > 0 && safe.status === INVOICE_STATUS.FINALIZED;
    return safe;
  }

  #assertDraft(invoice) {
    if (invoice.status !== INVOICE_STATUS.DRAFT) {
      throw ApiError.forbidden('Cannot edit finalized invoice');
    }
  }

  #normalizeItems(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('At least one invoice item is required');
    }
    return items.map((raw) => {
      if (!raw.description?.trim()) throw ApiError.badRequest('Item description is required');
      const quantity = Number(raw.quantity) > 0 ? Number(raw.quantity) : 1;
      const unitPrice = Math.max(0, Number(raw.unitPrice) || 0);
      const discount = Math.max(0, Number(raw.discount) || 0);
      const line = Math.max(0, quantity * unitPrice - discount);
      const tax = Math.max(0, Number(raw.tax) || 0);
      return {
        itemType: raw.itemType || INVOICE_ITEM_TYPE.SERVICE,
        referenceId: raw.referenceId || null,
        description: raw.description.trim(),
        quantity,
        unitPrice,
        discount,
        tax,
        total: this.#round(line + tax),
      };
    });
  }

  /**
   * `loyaltyDiscountInr` (LOY-005) is the INR value of an applied loyalty-points redemption —
   * it is added to the discount total exactly like any other discount, so it flows through
   * the SAME #computeDiscountApproval percent-of-subtotal check below (a large-enough point
   * redemption still requires approval, same as a manual discount would).
   */
  #computeTotals(items, { discountType, discountValue, taxPercent, loyaltyDiscountInr = 0 }) {
    const subtotal = this.#round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
    const itemDiscounts = this.#round(items.reduce((s, i) => s + (i.discount || 0), 0));
    let headerDiscount = 0;
    const dv = Math.max(0, Number(discountValue) || 0);
    if (discountType === DISCOUNT_TYPE.PERCENTAGE) {
      headerDiscount = this.#round((subtotal * Math.min(dv, 100)) / 100);
    } else {
      headerDiscount = this.#round(dv);
    }
    const loyaltyDiscount = Math.max(0, this.#round(Number(loyaltyDiscountInr) || 0));
    const discount = this.#round(itemDiscounts + headerDiscount + loyaltyDiscount);
    const taxable = Math.max(0, subtotal - discount);
    const tax = this.#round((taxable * (Number(taxPercent) || 0)) / 100);
    const total = this.#round(taxable + tax);
    return { subtotal, discount, tax, total };
  }

  /** LOY-005 — the redeemable base for cap calculations excludes categories the loyalty
   *  program settings mark as non-redeemable (e.g. pharmacy/medicine, tax) — matched against
   *  each line item's itemType, case-insensitively. */
  #redeemableBaseAmount(items = [], excludedCategories = []) {
    const excluded = new Set((excludedCategories || []).map((c) => String(c).toUpperCase()));
    return this.#round(
      items.reduce((sum, item) => {
        if (excluded.has(String(item.itemType).toUpperCase())) return sum;
        const line = Math.max(0, (item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0));
        return sum + line;
      }, 0)
    );
  }

  /** LOY-005 — at most one cap is enforced; percent takes priority if both are configured
   *  (mirrors the doc comment on LoyaltyProgramSettings.model.js). */
  #loyaltyRedemptionCapInr(settings, redeemableBase) {
    if (settings.maxRedemptionPercentPerInvoice != null) {
      return this.#round((redeemableBase * settings.maxRedemptionPercentPerInvoice) / 100);
    }
    if (settings.maxRedemptionFlatInrPerInvoice != null) {
      return this.#round(settings.maxRedemptionFlatInrPerInvoice);
    }
    return Infinity;
  }

  /**
   * Effective discount percentage relative to subtotal (before discount).
   * Returns 0 when subtotal is 0 to avoid divide-by-zero false positives.
   */
  #discountPercentOf(subtotal, discount) {
    const sub = Number(subtotal) || 0;
    const disc = Number(discount) || 0;
    if (sub <= 0) return 0;
    return (disc / sub) * 100;
  }

  /**
   * Discount approval is computed server-side from the actual totals — callers cannot
   * set discountApprovalRequired/discountApproved directly via create/updateDraft payloads,
   * which would otherwise let anyone bypass the threshold check in finalize().
   */
  #computeDiscountApproval(subtotal, discount, previouslyApproved = false, discountChanged = true) {
    const threshold = config.billing.discountApprovalThresholdPercent;
    const percent = this.#discountPercentOf(subtotal, discount);
    const approvalRequired = percent > threshold;
    // If the discount changed since it was last approved, approval no longer applies.
    const approved = approvalRequired && !discountChanged ? previouslyApproved : false;
    return { discountApprovalRequired: approvalRequired, discountApproved: approved };
  }

  #paymentStatusFrom(paidAmount, total, status) {
    if (status === INVOICE_STATUS.CANCELLED || status === INVOICE_STATUS.VOID) {
      return PAYMENT_STATUS.CANCELLED;
    }
    if (paidAmount <= 0) return PAYMENT_STATUS.PENDING;
    if (paidAmount + 0.001 >= total) return PAYMENT_STATUS.PAID;
    return PAYMENT_STATUS.PARTIALLY_PAID;
  }

  async #taxPercentForBranch(branchId) {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw ApiError.notFound('Branch not found');
    return {
      branch,
      taxPercent: branch.settings?.taxPercent ?? 18,
      gstEnabled: branch.settings?.gstEnabled !== false,
    };
  }

  async getById(id) {
    const doc = await this.invoiceRepository.findByIdPopulated(id);
    if (!doc) throw ApiError.notFound('Invoice not found');
    const payments = await this.paymentRepository.findByInvoice(doc._id);
    return this.#mapInvoice(doc, payments);
  }

  async list(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const { items, total } = await this.invoiceRepository.list({
      branchId: query.branchId || null,
      patientId: query.patientId || null,
      status: query.status || null,
      paymentStatus: query.paymentStatus || null,
      search: query.search || null,
      limit,
      skip,
    });
    const mapped = await Promise.all(
      items.map(async (row) => {
        const populated = await this.invoiceRepository.findByIdPopulated(row._id);
        return this.#mapInvoice(populated);
      })
    );
    return {
      items: mapped,
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async create(payload, actorId, req = null) {
    if (!payload.patientId) throw ApiError.badRequest('patientId is required');
    if (!payload.branchId) throw ApiError.badRequest('branchId is required');

    const patient = await this.patientRepository.findById(payload.patientId);
    if (!patient || patient.deletedAt) throw ApiError.notFound('Patient not found');

    const { taxPercent, gstEnabled } = await this.#taxPercentForBranch(payload.branchId);
    const items = this.#normalizeItems(payload.items || []);
    const discountType = payload.discountType || DISCOUNT_TYPE.FLAT;
    const discountValue = payload.discountValue || 0;
    const totals = this.#computeTotals(items, {
      discountType,
      discountValue,
      taxPercent: payload.taxPercent ?? taxPercent,
    });

    // Recompute item tax proportionally for display (GST placeholder)
    const taxableBase = Math.max(0, totals.subtotal - totals.discount);
    const itemsWithTax = items.map((item) => {
      const line = item.quantity * item.unitPrice - (item.discount || 0);
      const share = taxableBase > 0 ? line / taxableBase : 0;
      const tax = this.#round(totals.tax * share);
      return { ...item, tax, total: this.#round(line + tax) };
    });

    // discountApprovalRequired/discountApproved are computed server-side from the
    // actual totals — the caller cannot set these directly (would bypass the threshold check).
    const discountApproval = this.#computeDiscountApproval(totals.subtotal, totals.discount);

    const invoice = await this.invoiceRepository.create({
      invoiceNumber: await generateInvoiceNumber(),
      invoiceDate: payload.invoiceDate ? new Date(payload.invoiceDate) : new Date(),
      patientId: payload.patientId,
      branchId: payload.branchId,
      doctorId: payload.doctorId || null,
      consultationId: payload.consultationId || null,
      treatmentPlanId: payload.treatmentPlanId || null,
      appointmentId: payload.appointmentId || null,
      status: INVOICE_STATUS.DRAFT,
      paymentStatus: PAYMENT_STATUS.PENDING,
      items: itemsWithTax,
      packageSnapshot: payload.packageSnapshot || null,
      ...totals,
      discountType,
      discountValue,
      discountApprovalRequired: discountApproval.discountApprovalRequired,
      discountApproved: discountApproval.discountApproved,
      taxPercent: payload.taxPercent ?? taxPercent,
      gstPlaceholder: gstEnabled,
      paidAmount: 0,
      balanceAmount: totals.total,
      notes: payload.notes || null,
      timeline: [{ at: new Date(), action: 'CREATED', note: 'Invoice created', actorId }],
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.INVOICE_CREATED, {
      actorId,
      metadata: {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
      },
      req,
    });

    eventBus.emitDomain(BILLING_EVENTS.INVOICE_CREATED, {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      patientId: payload.patientId,
      total: invoice.total,
    });

    return this.getById(invoice._id.toString());
  }

  async createFromTreatmentPlan(treatmentPlanId, actorId, req = null) {
    const plan = await this.treatmentPlanRepository.findByIdNotDeleted(treatmentPlanId);
    if (!plan) throw ApiError.notFound('Treatment plan not found');

    const snapshot = plan.packageSnapshot
      ? {
          packageId: plan.packageSnapshot.packageId,
          packageName: plan.packageSnapshot.packageName,
          packagePrice: plan.packageSnapshot.packagePrice,
          discount: plan.packageSnapshot.discount || 0,
          validityDays: plan.packageSnapshot.validityDays,
          maximumSessions: plan.packageSnapshot.maximumSessions,
          unusedSessions: plan.packageSnapshot.unusedSessions,
        }
      : null;

    const items = [];
    if (snapshot?.packageName) {
      const price = Number(snapshot.packagePrice) || 0;
      const discount = Number(snapshot.discount) || 0;
      items.push({
        itemType: INVOICE_ITEM_TYPE.PACKAGE,
        referenceId: snapshot.packageId,
        description: snapshot.packageName,
        quantity: 1,
        unitPrice: price,
        discount,
        tax: 0,
        total: Math.max(0, price - discount),
      });
    } else {
      for (const item of plan.items || []) {
        items.push({
          itemType: INVOICE_ITEM_TYPE.SERVICE,
          referenceId: item.serviceId || null,
          description: item.procedureName,
          quantity: item.sessionCount || 1,
          unitPrice: 0,
          discount: 0,
          tax: 0,
          total: 0,
        });
      }
      if (!items.length) {
        items.push({
          itemType: INVOICE_ITEM_TYPE.SERVICE,
          description: plan.title || 'Treatment plan',
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          tax: 0,
          total: 0,
        });
      }
    }

    // Do NOT modify treatment plan — only copy snapshot into invoice
    return this.create(
      {
        patientId: plan.patientId.toString(),
        branchId: plan.branchId.toString(),
        doctorId: plan.doctorId?.toString?.() || plan.doctorId,
        consultationId: plan.consultationId?.toString?.() || plan.consultationId,
        treatmentPlanId: plan._id.toString(),
        notes: `From treatment plan ${plan.planNumber}`,
        packageSnapshot: snapshot,
        items,
        discountType: DISCOUNT_TYPE.FLAT,
        discountValue: 0,
      },
      actorId,
      req
    );
  }

  async updateDraft(id, payload, actorId) {
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);

    const { taxPercent } = await this.#taxPercentForBranch(invoice.branchId);
    const items = payload.items ? this.#normalizeItems(payload.items) : invoice.items;
    const discountType = payload.discountType ?? invoice.discountType ?? DISCOUNT_TYPE.FLAT;
    const discountValue = payload.discountValue ?? invoice.discountValue ?? 0;
    const effectiveTax = payload.taxPercent ?? invoice.taxPercent ?? taxPercent;
    // Preserve any already-applied loyalty redemption's INR value across draft edits so
    // editing items/discount doesn't silently drop it from the discount-approval check.
    const loyaltyDiscountInr = invoice.loyaltyRedemption?.valueInr || 0;
    const totals = this.#computeTotals(
      items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
      })),
      { discountType, discountValue, taxPercent: effectiveTax, loyaltyDiscountInr }
    );

    const taxableBase = Math.max(0, totals.subtotal - totals.discount);
    const itemsWithTax = items.map((item) => {
      const line = item.quantity * item.unitPrice - (item.discount || 0);
      const share = taxableBase > 0 ? line / taxableBase : 0;
      const tax = this.#round(totals.tax * share);
      return {
        itemType: item.itemType,
        referenceId: item.referenceId || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax,
        total: this.#round(line + tax),
      };
    });

    // discountApprovalRequired/discountApproved are computed server-side — the caller
    // cannot set these directly via the payload (would bypass the threshold check in finalize()).
    const discountChanged =
      discountType !== invoice.discountType || Number(discountValue) !== Number(invoice.discountValue || 0);
    const discountApproval = this.#computeDiscountApproval(
      totals.subtotal,
      totals.discount,
      invoice.discountApproved,
      discountChanged
    );

    const updates = {
      items: itemsWithTax,
      ...totals,
      discountType,
      discountValue,
      taxPercent: effectiveTax,
      balanceAmount: totals.total,
      paidAmount: 0,
      paymentStatus: PAYMENT_STATUS.PENDING,
      discountApprovalRequired: discountApproval.discountApprovalRequired,
      discountApproved: discountApproval.discountApproved,
      updatedBy: actorId,
      $push: {
        timeline: { at: new Date(), action: 'UPDATED', note: 'Draft updated', actorId },
      },
    };
    if (payload.notes !== undefined) updates.notes = payload.notes;
    if (payload.doctorId !== undefined) updates.doctorId = payload.doctorId;
    if (payload.consultationId !== undefined) updates.consultationId = payload.consultationId;
    if (payload.appointmentId !== undefined) updates.appointmentId = payload.appointmentId;

    await this.invoiceRepository.updateById(id, updates);
    return this.getById(id);
  }

  async voidDraft(id, payload, actorId, req = null) {
    if (!payload?.reason?.trim()) {
      throw ApiError.badRequest('A reason is required to void an invoice');
    }
    const reason = payload.reason.trim();
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);
    await this.invoiceRepository.updateById(id, {
      status: INVOICE_STATUS.VOID,
      paymentStatus: PAYMENT_STATUS.CANCELLED,
      voidedAt: new Date(),
      voidedBy: actorId,
      updatedBy: actorId,
      $push: { timeline: { at: new Date(), action: 'VOIDED', note: reason, actorId } },
    });

    await this.auditService.record(AUDIT_ACTIONS.INVOICE_VOIDED, {
      actorId,
      metadata: {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        reason,
      },
      req,
    });

    // LOY-006 — best-effort/non-blocking: if this invoice had already earned loyalty points
    // (e.g. an immediate-earn rule fired before the draft was voided), claw them back. Never
    // touches DEBIT_REDEEM entries — only CREDIT (earned) points sourced to this invoice.
    await this.#clawbackEarnedLoyaltyPoints(invoice, `Invoice voided — ${reason}`, actorId, req);

    return this.getById(id);
  }

  /**
   * LOY-006 — sums CREDIT (earned) points sourced to this invoice, subtracts anything already
   * clawed back for it, and claws back the remainder. Deliberately never touches DEBIT_REDEEM
   * entries — a refunded/voided invoice does not auto-reverse points the patient redeemed.
   * Best-effort: logs and swallows failures so it can never block the caller's primary flow
   * (mirrors how other non-critical side effects, e.g. notification dispatch, are handled).
   */
  async #clawbackEarnedLoyaltyPoints(invoice, reasonNote, actorId, req) {
    try {
      const [creditRows, clawedRows] = await Promise.all([
        LoyaltyLedgerEntry.aggregate([
          {
            $match: {
              sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
              sourceRefId: invoice._id,
              entryType: LOYALTY_ENTRY_TYPE.CREDIT,
            },
          },
          { $group: { _id: null, total: { $sum: '$points' } } },
        ]),
        LoyaltyLedgerEntry.aggregate([
          {
            $match: {
              sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
              sourceRefId: invoice._id,
              entryType: LOYALTY_ENTRY_TYPE.DEBIT_CLAWBACK,
            },
          },
          { $group: { _id: null, total: { $sum: '$points' } } },
        ]),
      ]);
      const totalEarned = creditRows[0]?.total || 0;
      const alreadyClawed = clawedRows[0]?.total || 0;
      const remaining = totalEarned - alreadyClawed;
      if (remaining <= 0) return;

      await this.loyaltyLedgerService.clawback({
        branchId: invoice.branchId,
        patientId: invoice.patientId,
        points: remaining,
        sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
        sourceRefId: invoice._id,
        reasonNote,
        createdBy: actorId,
        actorReq: req,
      });
    } catch (err) {
      logger.error('BillingService: loyalty clawback failed (non-blocking)', {
        invoiceId: invoice._id.toString(),
        error: err.message,
      });
    }
  }

  /**
   * LOY-005 — apply a loyalty-points redemption to a DRAFT invoice as a discount. The
   * discount INR value flows through the SAME #computeDiscountApproval threshold check as
   * any manual discount, and is capped by the program's redemption caps computed against the
   * redeemable base (excludedRedemptionCategories line items are excluded from that base).
   *
   * Ledger write happens AFTER invoice-side validation passes but BEFORE the final invoice
   * save; if the invoice save then fails, the ledger debit is compensated with a
   * CREDIT_REVERSAL (this codebase does not use Mongo transactions anywhere — see
   * TreatmentSessionService's sequential-compensation pattern for the same technique).
   */
  async applyLoyaltyRedemption(id, payload, actorId, req = null) {
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);
    if (invoice.loyaltyRedemption) {
      throw ApiError.badRequest(
        'A loyalty redemption is already applied to this invoice. Remove it before applying a new one.'
      );
    }

    const points = Math.floor(Number(payload.points) || 0);
    if (points <= 0) throw ApiError.badRequest('points must be a positive integer.');

    const settings = await this.loyaltyLedgerService.assertProgramEnabled();
    const discountInr = this.#round(points / settings.redemptionPointsPerRupee);
    if (discountInr <= 0) throw ApiError.badRequest('Redemption does not convert to a positive discount.');

    const redeemableBase = this.#redeemableBaseAmount(invoice.items, settings.excludedRedemptionCategories);
    const capInr = this.#loyaltyRedemptionCapInr(settings, redeemableBase);
    if (discountInr > capInr + 0.01) {
      throw ApiError.badRequest(
        `Redemption discount of ₹${discountInr} exceeds the maximum allowed (₹${this.#round(capInr)}) for this invoice.`
      );
    }

    const totals = this.#computeTotals(invoice.items, {
      discountType: invoice.discountType,
      discountValue: invoice.discountValue,
      taxPercent: invoice.taxPercent,
      loyaltyDiscountInr: discountInr,
    });
    // Applying a redemption always changes the discount total, so any prior approval is
    // invalidated — same rule as editing a manual discount.
    const discountApproval = this.#computeDiscountApproval(
      totals.subtotal,
      totals.discount,
      invoice.discountApproved,
      true
    );

    // Ledger write first (source of truth for the points side) — validates
    // minimumPointsToRedeem/redemptionStepPoints/available balance internally.
    const debitEntries = await this.loyaltyLedgerService.redeem({
      branchId: invoice.branchId,
      patientId: invoice.patientId,
      points,
      invoiceId: invoice._id,
      redeemedValueInr: discountInr,
      createdBy: actorId,
      actorReq: req,
    });

    try {
      await this.invoiceRepository.updateById(id, {
        loyaltyRedemption: {
          points,
          valueInr: discountInr,
          ledgerEntryIds: debitEntries.map((e) => e.id),
          patientId: invoice.patientId,
          appliedAt: new Date(),
          appliedBy: actorId,
        },
        ...totals,
        discountApprovalRequired: discountApproval.discountApprovalRequired,
        discountApproved: discountApproval.discountApproved,
        balanceAmount: totals.total,
        updatedBy: actorId,
        $push: {
          timeline: {
            at: new Date(),
            action: 'LOYALTY_REDEMPTION_APPLIED',
            note: `Redeemed ${points} points for ₹${discountInr} discount`,
            actorId,
          },
        },
      });
    } catch (err) {
      // Compensate: the invoice never ended up reflecting the redemption, so reverse the
      // ledger debit rather than leaving the patient's points silently spent.
      try {
        await this.loyaltyLedgerService.credit({
          branchId: invoice.branchId,
          patientId: invoice.patientId,
          points,
          entryType: 'CREDIT_REVERSAL',
          sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
          sourceRefId: invoice._id,
          note: 'Compensating reversal — invoice save failed after loyalty redemption',
          createdBy: actorId,
          actorReq: req,
        });
      } catch (compErr) {
        logger.error(
          'BillingService.applyLoyaltyRedemption: compensating CREDIT_REVERSAL failed after invoice save error',
          { invoiceId: id, points, error: compErr.message }
        );
      }
      throw err;
    }

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_POINTS_REDEEMED, {
      actorId,
      metadata: { invoiceId: id, points, discountInr },
      branchId: invoice.branchId,
      resourceType: 'Invoice',
      resourceId: id,
      req,
    });

    return this.getById(id);
  }

  /**
   * LOY-005 — reverses a draft invoice's applied loyalty redemption: credits the points back
   * via a CREDIT_REVERSAL ledger entry, drops the discount line, and recomputes totals.
   */
  async removeLoyaltyRedemption(id, actorId, req = null) {
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);
    if (!invoice.loyaltyRedemption) {
      throw ApiError.badRequest('No loyalty redemption is applied to this invoice.');
    }

    const { points } = invoice.loyaltyRedemption;

    await this.loyaltyLedgerService.credit({
      branchId: invoice.branchId,
      patientId: invoice.patientId,
      points,
      entryType: 'CREDIT_REVERSAL',
      sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
      sourceRefId: invoice._id,
      note: 'Loyalty redemption removed from draft invoice',
      createdBy: actorId,
      actorReq: req,
    });

    const totals = this.#computeTotals(invoice.items, {
      discountType: invoice.discountType,
      discountValue: invoice.discountValue,
      taxPercent: invoice.taxPercent,
      loyaltyDiscountInr: 0,
    });
    const discountApproval = this.#computeDiscountApproval(
      totals.subtotal,
      totals.discount,
      invoice.discountApproved,
      true
    );

    await this.invoiceRepository.updateById(id, {
      loyaltyRedemption: null,
      ...totals,
      discountApprovalRequired: discountApproval.discountApprovalRequired,
      discountApproved: discountApproval.discountApproved,
      balanceAmount: totals.total,
      updatedBy: actorId,
      $push: {
        timeline: {
          at: new Date(),
          action: 'LOYALTY_REDEMPTION_REMOVED',
          note: `Reversed redemption of ${points} points`,
          actorId,
        },
      },
    });

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_POINTS_CLAWED_BACK, {
      actorId,
      metadata: { invoiceId: id, points, reason: 'Redemption removed from draft' },
      branchId: invoice.branchId,
      resourceType: 'Invoice',
      resourceId: id,
      req,
    });

    return this.getById(id);
  }

  /**
   * Explicit discount approval — required before finalize() when discountApprovalRequired
   * is true (discount exceeds config.billing.discountApprovalThresholdPercent). Permission-gated
   * at the route layer via BILLING_DISCOUNT_APPROVE. A mandatory reason is recorded on the
   * timeline and audit trail.
   */
  async approveDiscount(id, payload, actorId, req = null) {
    if (!payload?.reason?.trim()) {
      throw ApiError.badRequest('A reason is required to approve a discount');
    }
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);
    if (!invoice.discountApprovalRequired) {
      throw ApiError.badRequest('This invoice discount does not require approval');
    }

    await this.invoiceRepository.updateById(id, {
      discountApproved: true,
      updatedBy: actorId,
      $push: {
        timeline: {
          at: new Date(),
          action: 'DISCOUNT_APPROVED',
          note: payload.reason.trim(),
          actorId,
        },
      },
    });

    await this.auditService.record(AUDIT_ACTIONS.DISCOUNT_APPROVED, {
      actorId,
      metadata: {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        discount: invoice.discount,
        subtotal: invoice.subtotal,
        reason: payload.reason.trim(),
      },
      req,
    });

    return this.getById(id);
  }

  async finalize(id, actorId, req = null) {
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);
    if (!invoice.items?.length) throw ApiError.badRequest('Cannot finalize empty invoice');
    if (invoice.total < 0) throw ApiError.badRequest('Invalid invoice total');
    if (invoice.discountApprovalRequired && !invoice.discountApproved) {
      throw ApiError.forbidden(
        'This invoice discount exceeds the approval threshold and must be approved before finalization'
      );
    }

    await this.invoiceRepository.updateById(id, {
      status: INVOICE_STATUS.FINALIZED,
      finalizedAt: new Date(),
      finalizedBy: actorId,
      updatedBy: actorId,
      $push: {
        timeline: { at: new Date(), action: 'FINALIZED', note: 'Invoice finalized', actorId },
      },
    });

    await this.auditService.record(AUDIT_ACTIONS.INVOICE_FINALIZED, {
      actorId,
      metadata: { invoiceId: id, invoiceNumber: invoice.invoiceNumber, total: invoice.total },
      req,
    });

    eventBus.emitDomain(BILLING_EVENTS.INVOICE_FINALIZED, {
      invoiceId: id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      patientId: invoice.patientId.toString(),
    });

    return this.getById(id);
  }

  async recordPayment(id, payload, actorId, req = null) {
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');

    if (
      invoice.status === INVOICE_STATUS.CANCELLED ||
      invoice.status === INVOICE_STATUS.VOID ||
      invoice.paymentStatus === PAYMENT_STATUS.CANCELLED
    ) {
      throw ApiError.forbidden('Cannot create payment for cancelled invoice');
    }
    if (invoice.status !== INVOICE_STATUS.FINALIZED) {
      throw ApiError.badRequest('Only finalized invoices can receive payments');
    }

    let amount = this.#round(Number(payload.amount) || 0);
    let method = payload.method || PAYMENT_METHOD.CASH;
    let splits = Array.isArray(payload.splits) ? payload.splits : [];

    if (method === PAYMENT_METHOD.SPLIT || splits.length > 0) {
      if (!splits.length) throw ApiError.badRequest('Split payments require splits[]');
      amount = this.#round(splits.reduce((s, p) => s + (Number(p.amount) || 0), 0));
      method = PAYMENT_METHOD.SPLIT;
      splits = splits.map((s) => ({
        method: s.method || PAYMENT_METHOD.CASH,
        amount: this.#round(Number(s.amount) || 0),
        reference: s.reference || null,
      }));
    }

    if (amount <= 0) throw ApiError.badRequest('Payment amount must be greater than zero');

    const isAdvance = Boolean(payload.isAdvance);
    const balance = this.#round(invoice.balanceAmount);
    if (!isAdvance && amount > balance + 0.001) {
      throw ApiError.badRequest('Cannot overpay invoice');
    }
    if (isAdvance && amount > balance + 0.001) {
      throw ApiError.badRequest('Cannot overpay invoice');
    }

    const payment = await this.paymentRepository.create({
      paymentNumber: await generatePaymentNumber(),
      receiptNumber: await generateReceiptNumber(),
      invoiceId: invoice._id,
      patientId: invoice.patientId,
      branchId: invoice.branchId,
      amount,
      method,
      splits,
      isAdvance,
      isPartial: amount + 0.001 < balance,
      reference: payload.reference || null,
      notes: payload.notes || null,
      status: PAYMENT_RECORD_STATUS.RECORDED,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
      createdBy: actorId,
      updatedBy: actorId,
    });

    const paidAmount = this.#round((invoice.paidAmount || 0) + amount);
    const balanceAmount = this.#round(Math.max(0, invoice.total - paidAmount));
    const paymentStatus = this.#paymentStatusFrom(paidAmount, invoice.total, invoice.status);

    await this.invoiceRepository.updateById(id, {
      paidAmount,
      balanceAmount,
      paymentStatus,
      advanceApplied: isAdvance
        ? this.#round((invoice.advanceApplied || 0) + amount)
        : invoice.advanceApplied,
      updatedBy: actorId,
      $push: {
        timeline: {
          at: new Date(),
          action: 'PAYMENT',
          note: `${method} ₹${amount}${isAdvance ? ' (advance)' : ''}`,
          actorId,
        },
      },
    });

    await this.auditService.record(AUDIT_ACTIONS.PAYMENT_RECORDED, {
      actorId,
      metadata: {
        invoiceId: id,
        paymentId: payment._id.toString(),
        amount,
        method,
      },
      branchId: payment.branchId,
      resourceType: 'Payment',
      resourceId: payment._id.toString(),
      req,
    });

    eventBus.emitDomain(BILLING_EVENTS.PAYMENT_RECORDED, {
      invoiceId: id,
      paymentId: payment._id.toString(),
      amount,
      method,
      paymentStatus,
    });

    if (paymentStatus === PAYMENT_STATUS.PAID) {
      eventBus.emitDomain(BILLING_EVENTS.INVOICE_PAID, {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        patientId: invoice.patientId.toString(),
      });
    }

    return this.getById(id);
  }

  /**
   * Real refund (BIL-002) — replaces the RC1 placeholder. Posts to the invoice ledger,
   * optionally issues a credit note, and requires an approval reason (permission-gated
   * at the route layer via BILLING_REFUND).
   */
  async refund(paymentId, payload, actorId, req = null) {
    const payment = await this.paymentRepository.findByIdNotDeleted(paymentId);
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.status === PAYMENT_RECORD_STATUS.REFUNDED) {
      throw ApiError.badRequest('Payment has already been refunded');
    }
    if (!payload.reason) throw ApiError.badRequest('Refund reason is required');

    const refundAmount = this.#round(Number(payload.amount) || payment.amount);
    if (refundAmount > payment.amount) {
      throw ApiError.badRequest('Refund amount cannot exceed the original payment');
    }
    const refundMethod = payload.method || 'ORIGINAL_MODE';

    let creditNote = null;
    if (refundMethod === 'CREDIT_NOTE') {
      creditNote = await CreditNote.create({
        creditNoteNumber: await generateCreditNoteNumber(),
        patientId: payment.patientId,
        branchId: payment.branchId,
        sourcePaymentId: payment._id,
        sourceInvoiceId: payment.invoiceId,
        amount: refundAmount,
        balance: refundAmount,
        reason: payload.reason,
        expiresAt: payload.creditNoteExpiresAt || null,
        issuedBy: actorId,
      });
    }

    await this.paymentRepository.updateById(paymentId, {
      refundedAmount: refundAmount,
      refundedAt: new Date(),
      refundNotes: payload.notes || null,
      refundMethod,
      refundReason: payload.reason,
      refundApprovedBy: actorId,
      creditNoteId: creditNote?._id || null,
      status: PAYMENT_RECORD_STATUS.REFUNDED,
      updatedBy: actorId,
    });

    const invoice = await this.invoiceRepository.findByIdNotDeleted(payment.invoiceId);
    if (invoice) {
      const paidAmount = this.#round(Math.max(0, (invoice.paidAmount || 0) - refundAmount));
      const balanceAmount = this.#round(Math.max(0, invoice.total - paidAmount));
      await this.invoiceRepository.updateById(invoice._id, {
        paidAmount,
        balanceAmount,
        paymentStatus: paidAmount <= 0 ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_PAID,
        updatedBy: actorId,
        $push: {
          timeline: {
            at: new Date(),
            action: 'PAYMENT_REFUNDED',
            note: `Refunded ₹${refundAmount} via ${refundMethod} — ${payload.reason}`,
            actorId,
          },
        },
      });
    }

    await this.auditService.record(AUDIT_ACTIONS.PAYMENT_REFUNDED, {
      actorId,
      metadata: { paymentId, refundAmount, refundMethod, reason: payload.reason, creditNoteId: creditNote?._id?.toString() },
      branchId: payment.branchId,
      resourceType: 'Payment',
      resourceId: paymentId,
      req,
    });

    eventBus.emitDomain(BILLING_EVENTS.PAYMENT_REFUNDED, { paymentId, refundAmount, refundMethod });

    // LOY-006 — best-effort/non-blocking: claw back only points EARNED (CREDIT) from this
    // invoice, never REDEEMED (DEBIT_REDEEM) points — a refund does not auto-reverse a
    // redemption the patient already made.
    if (invoice) {
      await this.#clawbackEarnedLoyaltyPoints(
        invoice,
        `Refund of payment ${paymentId} — ${payload.reason}`,
        actorId,
        req
      );
    }

    return {
      invoice: await this.getById(payment.invoiceId.toString()),
      creditNote: creditNote?.toSafeObject() || null,
    };
  }

  /** @deprecated use refund() — kept so any un-migrated caller does not hard-crash. */
  async refundPlaceholder(paymentId, payload, actorId, req = null) {
    return this.refund(paymentId, { ...payload, reason: payload.notes || 'Refund' }, actorId, req);
  }

  async applyCreditNote(creditNoteId, invoiceId, amount, actorId, req = null) {
    const creditNote = await CreditNote.findById(creditNoteId);
    if (!creditNote) throw ApiError.notFound('Credit note not found');
    if (creditNote.balance < amount) throw ApiError.badRequest('Amount exceeds credit note balance');

    const invoice = await this.invoiceRepository.findByIdNotDeleted(invoiceId);
    if (!invoice) throw ApiError.notFound('Invoice not found');

    creditNote.balance = this.#round(creditNote.balance - amount);
    creditNote.appliedTo.push({ invoiceId, amount, appliedAt: new Date() });
    creditNote.status = creditNote.balance <= 0 ? 'FULLY_USED' : 'PARTIALLY_USED';
    await creditNote.save();

    const paidAmount = this.#round((invoice.paidAmount || 0) + amount);
    const balanceAmount = this.#round(Math.max(0, invoice.total - paidAmount));
    await this.invoiceRepository.updateById(invoiceId, {
      paidAmount,
      balanceAmount,
      paymentStatus: balanceAmount <= 0 ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PARTIALLY_PAID,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.CREDIT_NOTE_APPLIED, {
      actorId,
      metadata: { creditNoteId, invoiceId, amount },
      req,
    });

    return { creditNote: creditNote.toSafeObject(), invoice: await this.getById(invoiceId) };
  }

  async listPayments(invoiceId) {
    const invoice = await this.invoiceRepository.findByIdNotDeleted(invoiceId);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    const rows = await this.paymentRepository.findByInvoice(invoiceId);
    return rows.map((r) => r.toSafeObject());
  }

  async getPrintData(id, actorId, req = null) {
    const invoice = await this.getById(id);
    const current = await this.invoiceRepository.findByIdNotDeleted(id);
    await this.invoiceRepository.updateById(id, {
      printedAt: new Date(),
      printCount: (current?.printCount || 0) + 1,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.RECEIPT_PRINTED, {
      actorId,
      metadata: { invoiceId: id, invoiceNumber: invoice.invoiceNumber },
      req,
    });

    return {
      invoice: await this.getById(id),
      printMeta: {
        printedAt: new Date().toISOString(),
        clinicLogoPlaceholder: true,
        qrPlaceholder: true,
        emailPlaceholder: true,
        whatsappPlaceholder: true,
      },
    };
  }

  async getPaymentReceipt(paymentId, actorId, req = null) {
    const payment = await this.paymentRepository.findByIdNotDeleted(paymentId);
    if (!payment) throw ApiError.notFound('Payment not found');
    await this.paymentRepository.updateById(paymentId, {
      printedAt: new Date(),
      printCount: (payment.printCount || 0) + 1,
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.RECEIPT_PRINTED, {
      actorId,
      metadata: { paymentId, receiptNumber: payment.receiptNumber },
      req,
    });
    const invoice = await this.getById(payment.invoiceId.toString());
    return {
      payment: (await this.paymentRepository.findByIdNotDeleted(paymentId)).toSafeObject(),
      invoice,
      printMeta: {
        printedAt: new Date().toISOString(),
        qrPlaceholder: true,
      },
    };
  }

  async markEmailPlaceholder(id, actorId) {
    await this.invoiceRepository.updateById(id, {
      emailPlaceholderSent: true,
      updatedBy: actorId,
      $push: {
        timeline: {
          at: new Date(),
          action: 'EMAIL_PLACEHOLDER',
          note: 'Email placeholder marked',
          actorId,
        },
      },
    });
    return this.getById(id);
  }

  async markWhatsappPlaceholder(id, actorId) {
    await this.invoiceRepository.updateById(id, {
      whatsappPlaceholderSent: true,
      updatedBy: actorId,
      $push: {
        timeline: {
          at: new Date(),
          action: 'WHATSAPP_PLACEHOLDER',
          note: 'WhatsApp placeholder marked',
          actorId,
        },
      },
    });
    return this.getById(id);
  }
}

export default BillingService;
