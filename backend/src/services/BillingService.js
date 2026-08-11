import mongoose from 'mongoose';
import ApiError from '../libs/ApiError.js';
import { config } from '../config/index.js';
import { InvoiceRepository, PaymentRepository } from '../repositories/BillingRepository.js';
import TreatmentPlanRepository from '../repositories/TreatmentPlanRepository.js';
import ConsultationRepository from '../repositories/ConsultationRepository.js';
import PatientRepository from '../repositories/PatientRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import FeeScheduleService from './FeeScheduleService.js';
import OrganizationService from './OrganizationService.js';
import InventoryItem from '../models/InventoryItem.model.js';
import { fromPaise, priceInvoice, taxBreakdown, toPaise } from '../helpers/invoiceTax.helper.js';
import { eventBus } from '../events/eventBus.js';
import {
  generateInvoiceNumber,
  generatePaymentNumber,
  generateReceiptNumber,
  generateCreditNoteNumber,
} from '../helpers/invoiceNumber.helper.js';
import {
  AGING_BUCKET,
  AGING_BUCKET_LIST,
  AGING_BUCKET_MAX_DAYS,
  agingBucketForDays,
  BILLING_EVENTS,
  CREDIT_NOTE_REDEEMABLE_STATUSES,
  CREDIT_NOTE_STATUS,
  DISCOUNT_APPROVAL_STATUS,
  DISCOUNT_TYPE,
  INVOICE_CANCEL_REASON_LIST,
  INVOICE_ITEM_TYPE,
  INVOICE_STATUS,
  PAYMENT_METHOD,
  PAYMENT_RECORD_STATUS,
  PAYMENT_STATUS,
  paymentMethodRequiresReference,
  REFUND_APPROVAL_STATUS,
  REFUND_APPROVAL_STATUS_LIST,
  WRITE_OFF_REASON_LIST,
} from '../enums/billing.js';
import RefundRequest from '../models/RefundRequest.model.js';
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
    this.feeScheduleService = new FeeScheduleService();
    this.organizationService = new OrganizationService();
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
    // A.5 — surfaced so the billing UI can warn about (and collect a reason for) an
    // above-threshold discount live, without hardcoding the server's threshold.
    safe.discountThresholdPercent = config.billing.discountApprovalThresholdPercent;
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
      // NOTE: `raw.tax` / `raw.taxPercent` / `raw.total` are deliberately DROPPED. Tax is derived
      // server-side from the item or service master (#resolveLineTaxRates) — a client that could
      // name its own GST rate could under-declare tax on any invoice.
      return {
        itemType: raw.itemType || INVOICE_ITEM_TYPE.SERVICE,
        referenceId: raw.referenceId || null,
        description: raw.description.trim(),
        quantity,
        unitPrice,
        discount,
      };
    });
  }

  /**
   * GST rate resolution, in strict precedence order, per line:
   *
   *   1. GST disabled for the branch  → 0% on everything.
   *   2. MEDICINE / CONSUMABLES with a referenceId → `InventoryItem.gstPercent` (+ `hsnCode`).
   *      This is the item master's own rate: pharmacy items are commonly 5% or 12% where
   *      services are 18%, and that difference is the entire point.
   *   3. CONSULTATION / SERVICE / PACKAGE with a referenceId → the effective `FeeSchedule`
   *      row's `taxPercent`, when that row sets one (it is nullable, meaning "no opinion").
   *   4. Otherwise → the branch's `settings.taxPercent` (default 18), i.e. the old behaviour,
   *      which stays correct for ad-hoc lines that reference no master record.
   *
   * The client's input is never consulted at any step.
   */
  async #resolveLineTaxRates(items, { branchId, doctorId = null, gstEnabled, branchTaxPercent, date }) {
    if (!gstEnabled) {
      return items.map((item) => ({ ...item, taxPercent: 0, hsnCode: null }));
    }

    return Promise.all(
      items.map(async (item) => {
        const type = item.itemType;
        if (item.referenceId
          && (type === INVOICE_ITEM_TYPE.MEDICINE || type === INVOICE_ITEM_TYPE.CONSUMABLES)) {
          const inventoryItem = await InventoryItem.findById(item.referenceId)
            .select('gstPercent hsnCode')
            .lean()
            .exec();
          if (inventoryItem && inventoryItem.gstPercent != null) {
            return {
              ...item,
              taxPercent: Number(inventoryItem.gstPercent),
              hsnCode: inventoryItem.hsnCode || null,
            };
          }
        }

        if (item.referenceId
          && (type === INVOICE_ITEM_TYPE.SERVICE
            || type === INVOICE_ITEM_TYPE.CONSULTATION
            || type === INVOICE_ITEM_TYPE.PACKAGE)) {
          const fee = await this.feeScheduleService.resolvePrice(item.referenceId, {
            branchId,
            doctorId,
            date,
          });
          if (fee && fee.taxPercent != null) {
            return { ...item, taxPercent: Number(fee.taxPercent), hsnCode: item.hsnCode || null };
          }
        }

        return { ...item, taxPercent: Number(branchTaxPercent) || 0, hsnCode: item.hsnCode || null };
      })
    );
  }

  /**
   * Re-price stored invoice lines WITHOUT re-resolving rates from the masters.
   *
   * Used by the loyalty apply/remove paths, which change only the discount. Rates must come from
   * what is on the invoice (`item.taxPercent`), because a later edit to an item master must not
   * change an invoice that was already priced. Lines written before per-line GST existed have no
   * rate; they fall back to the invoice's header rate, which is precisely what they were charged.
   */
  #repriceStoredItems(invoice, { loyaltyDiscountInr = 0 } = {}) {
    const items = (invoice.items || []).map((item) => ({
      itemType: item.itemType,
      referenceId: item.referenceId || null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      taxPercent: item.taxPercent ?? invoice.taxPercent ?? 0,
      hsnCode: item.hsnCode ?? null,
    }));
    return priceInvoice(items, {
      discountType: invoice.discountType,
      discountValue: invoice.discountValue,
      loyaltyDiscountInr,
    });
  }

  /** Strip the priced result into the exact field set persisted on `Invoice.items`. */
  #toInvoiceItems(pricedItems) {
    return pricedItems.map((item) => ({
      itemType: item.itemType,
      referenceId: item.referenceId || null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxPercent: item.taxPercent,
      hsnCode: item.hsnCode ?? null,
      taxableAmount: item.taxableAmount,
      tax: item.tax,
      total: item.total,
    }));
  }

  /** The invoice-level money fields derived from a priced result. */
  #totalsOf(priced) {
    return {
      subtotal: priced.subtotal,
      discount: priced.discount,
      tax: priced.tax,
      total: priced.total,
      taxPercent: priced.taxPercent,
    };
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
   * A.5 — the STAFF-GRANTED discount only: line-item discounts plus the header discount.
   *
   * A loyalty redemption (LOY-005) is deliberately excluded. It is not a revenue concession
   * granted at a cashier's discretion — it is a system-computed conversion of points the patient
   * already earned, and it carries its own independent controls (minimumPointsToRedeem,
   * redemptionStepPoints, per-invoice caps, available-balance validation and a full ledger audit
   * trail in LoyaltyLedgerService). Routing it through the manual-discount approval queue would
   * double-govern it and, worse, block a cashier from letting a patient spend their own points
   * until a manager intervenes. Approval therefore gates only what a human chose to give away.
   */
  #manualDiscountTotal(items = [], { discountType, discountValue } = {}) {
    const subtotal = this.#round(
      items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0)
    );
    const itemDiscounts = this.#round(items.reduce((s, i) => s + (i.discount || 0), 0));
    const dv = Math.max(0, Number(discountValue) || 0);
    const headerDiscount =
      discountType === DISCOUNT_TYPE.PERCENTAGE
        ? this.#round((subtotal * Math.min(dv, 100)) / 100)
        : this.#round(dv);
    return this.#round(itemDiscounts + headerDiscount);
  }

  /**
   * Discount approval is computed server-side from the actual totals — callers cannot
   * set discountApprovalStatus/discountApprovalRequired/discountApproved directly via
   * create/updateDraft payloads, which would otherwise let anyone bypass the finalize() gate.
   *
   * An existing APPROVED/REJECTED decision survives an edit only while the manual discount
   * amount is unchanged; changing the amount is a new ask and returns the invoice to
   * PENDING_APPROVAL (so an approver can never be bound by a decision on different numbers).
   */
  #computeDiscountApproval(subtotal, manualDiscount, previousStatus = null, previousManualDiscount = null) {
    const threshold = config.billing.discountApprovalThresholdPercent;
    const percent = this.#discountPercentOf(subtotal, manualDiscount);
    if (percent <= threshold) {
      return {
        discountApprovalStatus: DISCOUNT_APPROVAL_STATUS.NOT_REQUIRED,
        discountApprovalRequired: false,
        discountApproved: false,
      };
    }
    const unchanged =
      previousManualDiscount !== null &&
      Math.abs(Number(previousManualDiscount) - Number(manualDiscount)) < 0.005;
    const decided =
      previousStatus === DISCOUNT_APPROVAL_STATUS.APPROVED ||
      previousStatus === DISCOUNT_APPROVAL_STATUS.REJECTED;
    const status =
      unchanged && decided ? previousStatus : DISCOUNT_APPROVAL_STATUS.PENDING_APPROVAL;
    return {
      discountApprovalStatus: status,
      discountApprovalRequired: true,
      discountApproved: status === DISCOUNT_APPROVAL_STATUS.APPROVED,
    };
  }

  /**
   * A.5 — a manual discount above the threshold is a control event, so it must carry the
   * requester's justification. Enforced here (not only in the validator) so every caller path,
   * including internal ones, captures it.
   */
  #assertDiscountReason(subtotal, manualDiscount, reason) {
    const threshold = config.billing.discountApprovalThresholdPercent;
    if (this.#discountPercentOf(subtotal, manualDiscount) <= threshold) return null;
    if (!String(reason ?? '').trim()) {
      throw ApiError.badRequest(
        `A discount reason is required when the discount exceeds ${threshold}% of the subtotal`
      );
    }
    return String(reason).trim();
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
    const normalized = this.#normalizeItems(payload.items || []);
    const discountType = payload.discountType || DISCOUNT_TYPE.FLAT;
    const discountValue = payload.discountValue || 0;
    const invoiceDate = payload.invoiceDate ? new Date(payload.invoiceDate) : new Date();

    // GST is derived from the item/service master — `payload.taxPercent` and any per-line `tax`
    // the caller sent are ignored entirely.
    const rated = await this.#resolveLineTaxRates(normalized, {
      branchId: payload.branchId,
      doctorId: payload.doctorId || null,
      gstEnabled,
      branchTaxPercent: taxPercent,
      date: invoiceDate,
    });
    const priced = priceInvoice(rated, { discountType, discountValue });
    const totals = this.#totalsOf(priced);
    const itemsWithTax = this.#toInvoiceItems(priced.items);
    const items = normalized;

    // The discount-approval fields are computed server-side from the actual totals — the caller
    // cannot set these directly (would bypass the finalize() threshold gate).
    const manualDiscount = this.#manualDiscountTotal(items, { discountType, discountValue });
    // Mandatory above the threshold; still recorded when volunteered below it.
    const discountReason =
      this.#assertDiscountReason(totals.subtotal, manualDiscount, payload.discountReason) ??
      (String(payload.discountReason ?? '').trim() || null);
    const discountApproval = this.#computeDiscountApproval(totals.subtotal, manualDiscount);

    const invoice = await this.invoiceRepository.create({
      invoiceNumber: await generateInvoiceNumber(),
      invoiceDate,
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
      ...discountApproval,
      discountReason,
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

    const { taxPercent, gstEnabled } = await this.#taxPercentForBranch(invoice.branchId);
    const discountType = payload.discountType ?? invoice.discountType ?? DISCOUNT_TYPE.FLAT;
    const discountValue = payload.discountValue ?? invoice.discountValue ?? 0;
    // Preserve any already-applied loyalty redemption's INR value across draft edits so
    // editing items/discount doesn't silently drop it from the discount-approval check.
    const loyaltyDiscountInr = invoice.loyaltyRedemption?.valueInr || 0;

    // New lines are re-rated from the masters; untouched lines keep the rate already on the
    // invoice, so an edit to the notes never silently re-prices what was already agreed.
    const items = payload.items ? this.#normalizeItems(payload.items) : invoice.items;
    const rated = payload.items
      ? await this.#resolveLineTaxRates(items, {
          branchId: invoice.branchId,
          doctorId: payload.doctorId ?? invoice.doctorId ?? null,
          gstEnabled,
          branchTaxPercent: taxPercent,
          date: invoice.invoiceDate || new Date(),
        })
      : items.map((i) => ({
          itemType: i.itemType,
          referenceId: i.referenceId || null,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount || 0,
          taxPercent: i.taxPercent ?? invoice.taxPercent ?? 0,
          hsnCode: i.hsnCode ?? null,
        }));
    const priced = priceInvoice(rated, { discountType, discountValue, loyaltyDiscountInr });
    const totals = this.#totalsOf(priced);
    const effectiveTax = totals.taxPercent;

    const itemsWithTax = this.#toInvoiceItems(priced.items);

    // The discount-approval fields are computed server-side — the caller cannot set them
    // directly via the payload (would bypass the finalize() threshold gate).
    const manualDiscount = this.#manualDiscountTotal(items, { discountType, discountValue });
    const previousManualDiscount = this.#manualDiscountTotal(invoice.items, {
      discountType: invoice.discountType,
      discountValue: invoice.discountValue,
    });
    // An edit may keep an already-captured reason; it only has to be supplied afresh when the
    // invoice crosses the threshold without one on file. Dropping below the threshold does not
    // erase the reason already recorded — only an explicit new value replaces it.
    const suppliedReason =
      payload.discountReason !== undefined ? payload.discountReason : invoice.discountReason;
    const discountReason =
      this.#assertDiscountReason(totals.subtotal, manualDiscount, suppliedReason) ??
      (String(suppliedReason ?? '').trim() || null);
    const discountApproval = this.#computeDiscountApproval(
      totals.subtotal,
      manualDiscount,
      invoice.discountApprovalStatus,
      previousManualDiscount
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
      ...discountApproval,
      discountReason,
      updatedBy: actorId,
      $push: {
        timeline: { at: new Date(), action: 'UPDATED', note: 'Draft updated', actorId },
      },
    };
    // A superseded request carries no decision: clear the approver's note/stamp whenever the
    // invoice is back to PENDING_APPROVAL or no longer needs approval at all.
    if (discountApproval.discountApprovalStatus !== invoice.discountApprovalStatus) {
      updates.discountDecisionNote = null;
      updates.discountApprovalDecidedBy = null;
      updates.discountApprovalDecidedAt = null;
    }
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
   * MON-002 — a control event that destroys a receivable must say why, in a word the business
   * can report on plus (for OTHER, which says nothing on its own) free text. Mirrors
   * #assertDiscountReason: enforced in the service, not only the validator, so every caller path
   * captures it.
   */
  #assertControlReason(payload, allowedReasons, verb) {
    const reason = String(payload?.reason ?? '').trim();
    if (!reason) throw ApiError.badRequest(`A reason is required to ${verb}`);
    if (!allowedReasons.includes(reason)) {
      throw ApiError.badRequest(
        `Unknown reason "${reason}" — expected one of: ${allowedReasons.join(', ')}`
      );
    }
    const note = String(payload?.note ?? payload?.notes ?? '').trim() || null;
    if (reason === 'OTHER' && !note) {
      throw ApiError.badRequest(`A note is required to ${verb} with reason OTHER`);
    }
    return { reason, note };
  }

  /**
   * MON-002 — cancel a FINALIZED (issued) invoice.
   *
   * `voidDraft` refuses anything that is not a draft, and no code path ever set
   * INVOICE_STATUS.CANCELLED, so a finalized invoice raised in error was permanently
   * uncorrectable: it sat in the dues worklist forever, overstating receivables, with no way out
   * of the system at all.
   *
   * Preconditions, in order of how much money they protect:
   *  - The invoice must still be FINALIZED (the conditional update, not just this read, decides).
   *  - It must carry NO money. Money that was actually collected is reversed by REFUNDING it —
   *    cancelling an invoice out from under a payment would leave the payment pointing at an
   *    annulled document and the cash unaccounted for. Same for credit notes already spent on it.
   *
   * Dependent effects are reversed the way the draft-void path reverses them — by writing
   * COUNTER-ENTRIES, never by editing history: earned loyalty points are clawed back, and any
   * redemption the patient spent on this invoice is credited back, because the invoice it bought
   * no longer exists and those points would otherwise simply be destroyed. The finalized invoice
   * document itself is left completely intact and readable; only its status changes.
   */
  async cancelFinalized(id, payload, actorId, req = null) {
    const { reason, note } = this.#assertControlReason(
      payload,
      INVOICE_CANCEL_REASON_LIST,
      'cancel a finalized invoice'
    );

    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === INVOICE_STATUS.DRAFT) {
      throw ApiError.badRequest('This invoice is still a draft — void it instead');
    }
    if (invoice.status !== INVOICE_STATUS.FINALIZED) {
      throw ApiError.badRequest(`This invoice is already ${invoice.status}`);
    }

    // Derived from the payment rows, not from the invoice's own counter: the whole point of this
    // gate is that it must not be fooled by a stale denormalised figure.
    const settledPaise =
      (await this.paymentRepository.sumRecordedPaiseForInvoice(invoice._id))
      + toPaise(invoice.creditApplied || 0);
    if (settledPaise > 0) {
      throw ApiError.badRequest(
        `₹${fromPaise(settledPaise)} has been collected against this invoice — refund the payments before cancelling it`
      );
    }

    const cancelled = await this.invoiceRepository.cancelFinalized(id, {
      status: INVOICE_STATUS.CANCELLED,
      paymentStatus: PAYMENT_STATUS.CANCELLED,
      balanceAmount: 0,
      cancelReason: reason,
      cancelNote: note,
      cancelledAt: new Date(),
      cancelledBy: actorId,
      // The draft-void path stamps voidedAt/By; keep them in step so "when did this invoice stop
      // being live" has one answer regardless of which path retired it.
      voidedAt: new Date(),
      voidedBy: actorId,
      updatedBy: actorId,
      $push: {
        timeline: {
          at: new Date(),
          action: 'CANCELLED',
          note: note ? `${reason} — ${note}` : reason,
          actorId,
        },
      },
    });
    if (!cancelled) {
      throw ApiError.badRequest('This invoice changed while it was being cancelled — reload it and retry');
    }

    await this.auditService.record(AUDIT_ACTIONS.INVOICE_CANCELLED, {
      actorId,
      metadata: {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        reason,
        note,
      },
      branchId: invoice.branchId,
      resourceType: 'Invoice',
      resourceId: id,
      req,
    });

    // Same clawback the draft-void path performs, for the same reason: points earned from an
    // invoice that no longer stands were never earned.
    await this.#clawbackEarnedLoyaltyPoints(invoice, `Invoice cancelled — ${reason}`, actorId, req);
    await this.#reverseRedemptionOnCancel(invoice, reason, actorId, req);

    return this.getById(id);
  }

  /**
   * MON-002 — returns points the patient redeemed against a now-cancelled invoice, as a
   * CREDIT_REVERSAL counter-entry (the ledger is append-only, so nothing is edited).
   *
   * `voidDraft` never needed this — a draft's redemption is removed with
   * removeLoyaltyRedemption before voiding — but a FINALIZED invoice can carry one that no
   * longer buys anything. Best-effort/non-blocking, matching #clawbackEarnedLoyaltyPoints:
   * the cancellation itself has already committed and must not be undone by a loyalty failure.
   */
  async #reverseRedemptionOnCancel(invoice, reason, actorId, req) {
    if (!invoice.loyaltyRedemption?.points) return;
    try {
      await this.loyaltyLedgerService.credit({
        branchId: invoice.branchId,
        patientId: invoice.patientId,
        points: invoice.loyaltyRedemption.points,
        entryType: 'CREDIT_REVERSAL',
        sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
        sourceRefId: invoice._id,
        note: `Invoice cancelled — ${reason}`,
        createdBy: actorId,
        actorReq: req,
      });
    } catch (err) {
      logger.error('BillingService: loyalty redemption reversal failed (non-blocking)', {
        invoiceId: invoice._id.toString(),
        error: err.message,
      });
    }
  }

  /**
   * MON-002 — write off an uncollectable balance on a FINALIZED invoice.
   *
   * There was no bad-debt path at all, so a balance that will never be collected could only be
   * left outstanding forever (permanently overstating receivables and clogging the dues
   * worklist) or faked as a payment (overstating collections). Neither is acceptable, hence a
   * state of its own: the invoice keeps its total and its revenue, the receivable is retired,
   * and PAYMENT_STATUS.WRITTEN_OFF says which of the two happened.
   *
   * The amount is DERIVED — the outstanding balance implied by the payment ledger — never taken
   * from the caller, so a client cannot write off more (or less) than is actually owed.
   */
  async writeOff(id, payload, actorId, req = null) {
    const { reason, note } = this.#assertControlReason(
      payload,
      WRITE_OFF_REASON_LIST,
      'write off an invoice balance'
    );

    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status !== INVOICE_STATUS.FINALIZED) {
      throw ApiError.badRequest('Only a finalized invoice can have its balance written off');
    }
    if ((invoice.writeOffAmount || 0) > 0) {
      throw ApiError.badRequest('This invoice balance has already been written off');
    }

    const totalPaise = toPaise(invoice.total);
    const settledPaise =
      (await this.paymentRepository.sumRecordedPaiseForInvoice(invoice._id))
      + toPaise(invoice.creditApplied || 0);
    const outstandingPaise = totalPaise - settledPaise;
    if (outstandingPaise <= 0) {
      throw ApiError.badRequest('This invoice has no outstanding balance to write off');
    }

    const written = await this.invoiceRepository.claimWriteOff(id, {
      writeOffAmount: fromPaise(outstandingPaise),
      writeOffReason: reason,
      writeOffNote: note,
      writeOffAt: new Date(),
      writeOffBy: actorId,
      // The receivable is gone, so the invoice leaves the dues worklist (which filters on
      // balanceAmount > 0). `paidAmount` is deliberately NOT touched: no money was received.
      balanceAmount: 0,
      paymentStatus: PAYMENT_STATUS.WRITTEN_OFF,
      updatedBy: actorId,
      $push: {
        timeline: {
          at: new Date(),
          action: 'WRITTEN_OFF',
          note: `₹${fromPaise(outstandingPaise)} — ${note ? `${reason} — ${note}` : reason}`,
          actorId,
        },
      },
    });
    if (!written) {
      throw ApiError.badRequest('This invoice changed while it was being written off — reload it and retry');
    }

    await this.auditService.record(AUDIT_ACTIONS.INVOICE_WRITTEN_OFF, {
      actorId,
      metadata: {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        writeOffAmount: fromPaise(outstandingPaise),
        reason,
        note,
      },
      branchId: invoice.branchId,
      resourceType: 'Invoice',
      resourceId: id,
      req,
    });

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
   * LOY-006 — the missing counterpart to #clawbackEarnedLoyaltyPoints: when a paid invoice that
   * had a loyalty redemption is refunded, the points the patient spent on it are re-credited as
   * CREDIT_REVERSAL, not left gone forever. Restores each DEBIT_REDEEM row's ORIGINAL earn-lot
   * expiry (via `consumesEntryId`) if that lot is still open; a lot that already expired is
   * handled per `LoyaltyProgramSettings.expiredRedemptionRestorePolicy` — RESTORE_SHORT_EXPIRY
   * grants a fresh short window instead of the full standard period (a refund should not hand
   * back MORE runway than the points ever had), FORFEIT re-credits nothing for that lot.
   *
   * One CREDIT_REVERSAL per DEBIT_REDEEM row (not a lump sum) because different rows can trace
   * to different earn lots with different original expiries. Idempotent per debit row via
   * `refund-recredit:<debitEntryId>` so repeated/partial refunds on the same invoice never
   * double-restore a row already reversed. Best-effort/non-blocking, same try/catch shape as
   * #clawbackEarnedLoyaltyPoints — a re-credit failure must never fail the refund itself.
   */
  async #recreditRedeemedLoyaltyPoints(invoice, reasonNote, actorId, req) {
    try {
      const debitEntries = await LoyaltyLedgerEntry.find({
        sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
        sourceRefId: invoice._id,
        entryType: LOYALTY_ENTRY_TYPE.DEBIT_REDEEM,
      }).lean();
      if (!debitEntries.length) return;

      const settings = await this.loyaltyLedgerService.getSettings();
      const restorePolicy = settings?.expiredRedemptionRestorePolicy || 'RESTORE_SHORT_EXPIRY';
      const now = new Date();

      for (const debit of debitEntries) {
        const idempotencyKey = `refund-recredit:${debit._id}`;
        const already = await LoyaltyLedgerEntry.exists({ patientId: invoice.patientId, idempotencyKey });
        if (already) continue;

        let earnLotExpiryDateOverride; // undefined = let credit() compute a fresh standard expiry
        if (debit.consumesEntryId) {
          const originalLot = await LoyaltyLedgerEntry.findById(debit.consumesEntryId)
            .select('earnLotExpiryDate')
            .lean();
          const originalExpiry = originalLot?.earnLotExpiryDate || null;
          if (!originalExpiry || originalExpiry > now) {
            // Never expires, or still open — hand back exactly what the patient had.
            earnLotExpiryDateOverride = originalExpiry;
          } else if (restorePolicy === 'FORFEIT') {
            continue; // that lot's window is gone and policy says don't restore it
          } else {
            const shortExpiry = new Date(now);
            shortExpiry.setDate(shortExpiry.getDate() + 30);
            earnLotExpiryDateOverride = shortExpiry;
          }
        }

        await this.loyaltyLedgerService.credit({
          branchId: invoice.branchId,
          patientId: invoice.patientId,
          points: debit.points,
          entryType: LOYALTY_ENTRY_TYPE.CREDIT_REVERSAL,
          sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
          sourceRefId: invoice._id,
          note: reasonNote,
          idempotencyKey,
          createdBy: actorId,
          actorReq: req,
          earnLotExpiryDateOverride,
        });
      }
    } catch (err) {
      logger.error('BillingService: loyalty redeemed-points re-credit failed (non-blocking)', {
        invoiceId: invoice._id.toString(),
        error: err.message,
      });
    }
  }

  /**
   * LOY-005 — apply a loyalty-points redemption to a DRAFT invoice as a discount, capped by the
   * program's redemption caps computed against the redeemable base
   * (excludedRedemptionCategories line items are excluded from that base).
   *
   * A redemption never changes the discount-approval state: it is not a manual discount (see
   * #manualDiscountTotal), so it cannot push an invoice into the approval queue, and it cannot
   * invalidate an approval already granted on the staff-granted portion.
   *
   * Ledger write happens AFTER invoice-side validation passes but BEFORE the final invoice
   * save; if the invoice save then fails, the ledger debit is compensated with a
   * CREDIT_REVERSAL (see TreatmentSessionService's sequential-compensation pattern).
   *
   * Double-apply control: the "already redeemed?" check below is a CONDITIONAL claim on the
   * invoice, not a read-then-write — two concurrent applies to the same invoice cannot both
   * pass it. Client retries are handled by `payload.idempotencyKey`, which is replayed against
   * both the invoice claim (here) and the ledger (LoyaltyLedgerService.redeem).
   */
  async applyLoyaltyRedemption(id, payload, actorId, req = null) {
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);

    const idempotencyKey = String(payload.idempotencyKey ?? '').trim() || null;
    if (invoice.loyaltyRedemption) {
      // A replay of the request that applied THIS redemption is a benign no-op, not a 400.
      if (idempotencyKey && invoice.loyaltyRedemption.idempotencyKey === idempotencyKey) {
        return this.getById(id);
      }
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

    // Re-price at the invoice's OWN stored per-line rates: a redemption changes the discount,
    // which changes each line's taxable base and therefore its tax. The lines are rewritten too,
    // so sum(line.tax) still equals invoice.tax after a redemption.
    const pricedRedeemed = this.#repriceStoredItems(invoice, { loyaltyDiscountInr: discountInr });
    const totals = {
      ...this.#totalsOf(pricedRedeemed),
      items: this.#toInvoiceItems(pricedRedeemed.items),
    };
    // Deliberately no #computeDiscountApproval call here — the manual discount is untouched, so
    // the approval state carries over as-is.

    // Claim the invoice's single redemption slot BEFORE debiting the ledger. Whoever loses this
    // conditional write never spends the patient's points at all, so a concurrent double-apply
    // has nothing to compensate — unlike the old read-then-write check, which both callers passed.
    const operationKey = idempotencyKey || `invoice-redeem:${id}:${Date.now()}`;
    const claimed = await this.invoiceRepository.claimLoyaltyRedemptionSlot(id, {
      loyaltyRedemption: {
        points,
        valueInr: discountInr,
        ledgerEntryIds: [],
        patientId: invoice.patientId,
        appliedAt: new Date(),
        appliedBy: actorId,
        idempotencyKey: operationKey,
      },
      ...totals,
      balanceAmount: totals.total,
      updatedBy: actorId,
    });
    if (!claimed) {
      throw ApiError.badRequest(
        'A loyalty redemption is already applied to this invoice. Remove it before applying a new one.'
      );
    }

    let debitEntries;
    try {
      // Validates minimumPointsToRedeem/redemptionStepPoints/available balance internally, and
      // is itself transactional and idempotent on operationKey.
      debitEntries = await this.loyaltyLedgerService.redeem({
        branchId: invoice.branchId,
        patientId: invoice.patientId,
        points,
        invoiceId: invoice._id,
        redeemedValueInr: discountInr,
        idempotencyKey: operationKey,
        createdBy: actorId,
        actorReq: req,
        // LOY-005 — front-desk/portal must positively confirm patient identity (and, in OTP mode,
        // that the OTP was verified) before points leave the balance; redeem() throws if the
        // configured LoyaltyProgramSettings.redemptionIdentityConfirmation mode requires it and
        // this wasn't supplied.
        identityConfirmed: Boolean(payload.identityConfirmed),
        otpVerified: Boolean(payload.otpVerified),
      });
    } catch (err) {
      // Release the claim: no points were spent, so the invoice must not keep showing a
      // redemption. Nothing to reverse on the ledger side — redeem() is all-or-nothing.
      try {
        const pricedRestored = this.#repriceStoredItems(invoice, { loyaltyDiscountInr: 0 });
        const restored = {
          ...this.#totalsOf(pricedRestored),
          items: this.#toInvoiceItems(pricedRestored.items),
        };
        await this.invoiceRepository.updateById(id, {
          loyaltyRedemption: null,
          ...restored,
          balanceAmount: restored.total,
          updatedBy: actorId,
        });
      } catch (releaseErr) {
        logger.error('BillingService.applyLoyaltyRedemption: failed to release the redemption claim', {
          invoiceId: id,
          points,
          error: releaseErr.message,
        });
      }
      throw err;
    }

    await this.invoiceRepository.updateById(id, {
      'loyaltyRedemption.ledgerEntryIds': debitEntries.map((e) => e.id),
      $push: {
        timeline: {
          at: new Date(),
          action: 'LOYALTY_REDEMPTION_APPLIED',
          note: `Redeemed ${points} points for ₹${discountInr} discount`,
          actorId,
        },
      },
    });

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

    const pricedRemoved = this.#repriceStoredItems(invoice, { loyaltyDiscountInr: 0 });
    const totals = {
      ...this.#totalsOf(pricedRemoved),
      items: this.#toInvoiceItems(pricedRemoved.items),
    };
    // As with applying one, removing a redemption leaves the manual discount — and therefore the
    // approval state — untouched.

    await this.invoiceRepository.updateById(id, {
      loyaltyRedemption: null,
      ...totals,
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
   * A.5 — the approver's worklist: draft invoices whose manual discount is waiting on a
   * decision. Defaults to PENDING_APPROVAL; pass another status to review past decisions.
   * Permission-gated at the route layer via BILLING_DISCOUNT_APPROVE.
   */
  async listDiscountApprovalQueue(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.invoiceRepository.listByDiscountApprovalStatus({
      status: query.status || DISCOUNT_APPROVAL_STATUS.PENDING_APPROVAL,
      branchId: query.branchId || null,
      limit,
      skip: (page - 1) * limit,
    });
    // Populated so the approver sees patient/branch names, not raw ObjectIds.
    const mapped = await Promise.all(
      items.map(async (row) => {
        const populated = await this.invoiceRepository.findByIdPopulated(row._id);
        const safe = this.#mapInvoice(populated);
        return {
          ...safe,
          discountPercent: this.#round(
            this.#discountPercentOf(
              safe.subtotal,
              this.#manualDiscountTotal(populated.items, {
                discountType: populated.discountType,
                discountValue: populated.discountValue,
              })
            )
          ),
          thresholdPercent: config.billing.discountApprovalThresholdPercent,
        };
      })
    );
    return {
      items: mapped,
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Start-of-day N days ago, in server-local time. */
  #daysAgo(days) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return d;
  }

  /** End-of-day N days ago. */
  #endOfDaysAgo(days) {
    const d = this.#daysAgo(days);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /** A bucket key -> the invoiceDate window that produces it. */
  #agingWindow(bucket) {
    if (bucket === AGING_BUCKET.CURRENT) {
      return { invoiceDateFrom: this.#daysAgo(AGING_BUCKET_MAX_DAYS[AGING_BUCKET.CURRENT]) };
    }
    if (bucket === AGING_BUCKET.DAYS_8_30) {
      return {
        invoiceDateFrom: this.#daysAgo(AGING_BUCKET_MAX_DAYS[AGING_BUCKET.DAYS_8_30]),
        invoiceDateTo: this.#endOfDaysAgo(AGING_BUCKET_MAX_DAYS[AGING_BUCKET.CURRENT] + 1),
      };
    }
    if (bucket === AGING_BUCKET.DAYS_31_60) {
      return {
        invoiceDateFrom: this.#daysAgo(AGING_BUCKET_MAX_DAYS[AGING_BUCKET.DAYS_31_60]),
        invoiceDateTo: this.#endOfDaysAgo(AGING_BUCKET_MAX_DAYS[AGING_BUCKET.DAYS_8_30] + 1),
      };
    }
    if (bucket === AGING_BUCKET.DAYS_60_PLUS) {
      return { invoiceDateTo: this.#endOfDaysAgo(AGING_BUCKET_MAX_DAYS[AGING_BUCKET.DAYS_31_60] + 1) };
    }
    return {};
  }

  /**
   * A.4 — the cashier's due-payments worklist: every finalized invoice still carrying a balance,
   * OLDEST FIRST, each row annotated with its age in days and aging bucket. Bucket totals cover
   * the whole filtered set (not just the current page) so the header numbers are the real
   * exposure. `checkedInToday` narrows to patients who have a CHECKED_IN appointment today —
   * the highest-yield collection list, because the patient is physically at the desk.
   */
  async listDuePayments(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);

    let patientIds = null;
    if (query.checkedInToday) {
      const { default: Appointment } = await import('../models/Appointment.model.js');
      const apptFilter = {
        deletedAt: null,
        status: 'CHECKED_IN',
        appointmentDate: { $gte: this.#daysAgo(0), $lte: this.#endOfDaysAgo(0) },
      };
      if (query.branchId) apptFilter.branchId = query.branchId;
      patientIds = await Appointment.distinct('patientId', apptFilter);
      // No one checked in yet: an explicitly empty worklist, not an unfiltered one.
      if (!patientIds.length) {
        return {
          items: [],
          meta: { page, limit, total: 0, pages: 1, totalOutstanding: 0, buckets: this.#emptyBuckets() },
        };
      }
    }

    const bucket = AGING_BUCKET_LIST.includes(query.bucket) ? query.bucket : null;
    const baseFilter = {
      branchId: query.branchId || null,
      patientId: query.patientId || null,
      patientIds,
      search: query.search || null,
    };

    const { items, total, totalOutstanding } = await this.invoiceRepository.listOutstanding({
      ...baseFilter,
      ...this.#agingWindow(bucket),
      limit,
      skip: (page - 1) * limit,
    });

    // Bucket totals: one narrow count/sum per bucket over the same filter set.
    const buckets = this.#emptyBuckets();
    await Promise.all(
      AGING_BUCKET_LIST.map(async (key) => {
        const res = await this.invoiceRepository.listOutstanding({
          ...baseFilter,
          ...this.#agingWindow(key),
          limit: 1,
          skip: 0,
        });
        buckets[key] = { count: res.total, outstanding: this.#round(res.totalOutstanding) };
      })
    );

    const now = Date.now();
    const mapped = await Promise.all(
      items.map(async (row) => {
        const populated = await this.invoiceRepository.findByIdPopulated(row._id);
        const safe = this.#mapInvoice(populated);
        const invoiceDate = populated.invoiceDate || populated.createdAt;
        const ageDays = Math.max(0, Math.floor((now - new Date(invoiceDate).getTime()) / 86400000));
        return { ...safe, ageDays, agingBucket: agingBucketForDays(ageDays) };
      })
    );

    return {
      items: mapped,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        totalOutstanding: this.#round(totalOutstanding),
        buckets,
      },
    };
  }

  #emptyBuckets() {
    return AGING_BUCKET_LIST.reduce((acc, key) => {
      acc[key] = { count: 0, outstanding: 0 };
      return acc;
    }, {});
  }

  /**
   * Shared approve/reject body — both decisions require a note, are recorded on the invoice
   * timeline, and are audited. Mirrors LoyaltyAdminService.approveAdjustment/rejectAdjustment.
   */
  async #decideDiscount(id, payload, actorId, req, { approve }) {
    const verb = approve ? 'approve' : 'reject';
    // `reason` is the long-standing field name on this endpoint; `decisionNote` matches the
    // approval-queue vocabulary used elsewhere (loyalty). Accept either.
    const note = String(payload?.decisionNote ?? payload?.reason ?? '').trim();
    if (!note) throw ApiError.badRequest(`A reason is required to ${verb} a discount`);

    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);
    if (invoice.discountApprovalStatus !== DISCOUNT_APPROVAL_STATUS.PENDING_APPROVAL) {
      throw ApiError.badRequest(
        invoice.discountApprovalStatus === DISCOUNT_APPROVAL_STATUS.NOT_REQUIRED
          ? 'This invoice discount does not require approval'
          : `Only pending discount approvals can be ${approve ? 'approved' : 'rejected'}`
      );
    }

    const action = approve ? 'DISCOUNT_APPROVED' : 'DISCOUNT_REJECTED';
    await this.invoiceRepository.updateById(id, {
      discountApprovalStatus: approve
        ? DISCOUNT_APPROVAL_STATUS.APPROVED
        : DISCOUNT_APPROVAL_STATUS.REJECTED,
      discountApproved: approve,
      discountDecisionNote: note,
      discountApprovalDecidedBy: actorId,
      discountApprovalDecidedAt: new Date(),
      updatedBy: actorId,
      $push: { timeline: { at: new Date(), action, note, actorId } },
    });

    await this.auditService.record(
      approve ? AUDIT_ACTIONS.DISCOUNT_APPROVED : AUDIT_ACTIONS.DISCOUNT_REJECTED,
      {
        actorId,
        metadata: {
          invoiceId: id,
          invoiceNumber: invoice.invoiceNumber,
          discount: invoice.discount,
          subtotal: invoice.subtotal,
          discountReason: invoice.discountReason,
          reason: note,
        },
        branchId: invoice.branchId,
        resourceType: 'Invoice',
        resourceId: id,
        req,
      }
    );

    return this.getById(id);
  }

  /**
   * Explicit discount approval — required before finalize() when the manual discount exceeds
   * config.billing.discountApprovalThresholdPercent. Permission-gated at the route layer via
   * BILLING_DISCOUNT_APPROVE. A mandatory note is recorded on the timeline and audit trail.
   */
  async approveDiscount(id, payload, actorId, req = null) {
    return this.#decideDiscount(id, payload, actorId, req, { approve: true });
  }

  /**
   * Rejecting leaves the invoice unfinalizable until the cashier edits the discount down (which
   * returns it to PENDING_APPROVAL if still above threshold, or clears the gate entirely).
   */
  async rejectDiscount(id, payload, actorId, req = null) {
    return this.#decideDiscount(id, payload, actorId, req, { approve: false });
  }

  async finalize(id, actorId, req = null) {
    const invoice = await this.invoiceRepository.findByIdNotDeleted(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    this.#assertDraft(invoice);
    if (!invoice.items?.length) throw ApiError.badRequest('Cannot finalize empty invoice');
    if (invoice.total < 0) throw ApiError.badRequest('Invalid invoice total');
    // A.5 — the hard stop. Only NOT_REQUIRED and APPROVED may proceed.
    if (invoice.discountApprovalStatus === DISCOUNT_APPROVAL_STATUS.PENDING_APPROVAL) {
      throw ApiError.forbidden(
        `This invoice discount exceeds the ${config.billing.discountApprovalThresholdPercent}% approval threshold and is awaiting approval — it cannot be finalized yet`
      );
    }
    if (invoice.discountApprovalStatus === DISCOUNT_APPROVAL_STATUS.REJECTED) {
      throw ApiError.forbidden(
        `This invoice discount was rejected${invoice.discountDecisionNote ? ` — ${invoice.discountDecisionNote}` : ''}. Reduce the discount to at or below ${config.billing.discountApprovalThresholdPercent}% or request approval again before finalizing.`
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

  /**
   * MON-001 — collect money against a finalized invoice.
   *
   * Two independent controls, because they defend different failures (same shape as
   * LoyaltyLedgerService.redeem, which this deliberately mirrors):
   *
   *  1. RETRY — `payload.idempotencyKey`. A replayed request returns the ORIGINAL payment
   *     instead of creating a second one. The pre-flight lookup is only a fast path; the unique
   *     partial (invoiceId, idempotencyKey) index on Payment is the actual guarantee, because
   *     two simultaneous retries would both pass a read-then-write check.
   *
   *  2. CONCURRENCY — the whole settlement runs in a transaction whose FIRST write is a
   *     conditional claim of payment headroom on the invoice document
   *     (`paidAmount <= total - amount`). Two cashiers therefore contend on one document: the
   *     loser either takes a write conflict (retried by withTransaction, re-evaluating a
   *     now-higher paidAmount) or fails the predicate outright. The payment row is written
   *     inside the same transaction, so a rejected settlement leaves no orphan payment and a
   *     recorded payment is never missing from the invoice.
   *
   * `paidAmount` is then DERIVED from the payment rows (PaymentRepository
   * .sumRecordedPaiseForInvoice, in integer paise) rather than left as an accumulated counter —
   * the invoice's money fields are a projection of the ledger, so they cannot drift away from it.
   */
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
    if (invoice.paymentStatus === PAYMENT_STATUS.WRITTEN_OFF) {
      throw ApiError.badRequest(
        'This invoice balance has been written off — reverse the write-off before collecting against it'
      );
    }

    const idempotencyKey = String(payload.idempotencyKey ?? '').trim() || null;
    if (idempotencyKey) {
      const replay = await this.paymentRepository.findByIdempotencyKey(invoice._id, idempotencyKey);
      // A retried request is a benign no-op that answers with the invoice as the original
      // payment left it — never a second collection, and never a 409 the cashier must interpret.
      if (replay) return this.getById(id);
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

    // PAY-04 — non-cash modes are unreconcilable without a reference number.
    if (method === PAYMENT_METHOD.SPLIT) {
      const unreferenced = splits.find(
        (s) => paymentMethodRequiresReference(s.method) && !String(s.reference ?? '').trim()
      );
      if (unreferenced) {
        throw ApiError.badRequest(`Reference is required for ${unreferenced.method} payments`);
      }
    } else if (paymentMethodRequiresReference(method) && !String(payload.reference ?? '').trim()) {
      throw ApiError.badRequest(`Reference is required for ${method} payments`);
    }

    const isAdvance = Boolean(payload.isAdvance);
    const balance = this.#round(invoice.balanceAmount);
    if (!isAdvance && amount > balance + 0.001) {
      throw ApiError.badRequest('Cannot overpay invoice');
    }
    if (isAdvance && amount > balance + 0.001) {
      throw ApiError.badRequest('Cannot overpay invoice');
    }

    // Numbers are drawn OUTSIDE the transaction on purpose: the sequence counter is not
    // transactional, and re-drawing inside a retried callback would burn a receipt number per
    // write conflict. Re-using the same pair on a retry is safe because the losing attempt's
    // insert was rolled back.
    const paymentNumber = await generatePaymentNumber();
    const receiptNumber = await generateReceiptNumber();

    const totalPaise = toPaise(invoice.total);
    const amountPaise = toPaise(amount);
    // The most the invoice may already have been paid for this payment to still fit.
    const maxPaid = fromPaise(totalPaise - amountPaise);

    let payment = null;
    let paymentStatus = invoice.paymentStatus;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        payment = null;
        const claimed = await this.invoiceRepository.claimPaymentHeadroom(id, {
          amount,
          maxPaid,
          isAdvance,
          session,
        });
        if (!claimed) {
          // Either another cashier took the headroom first, or the invoice stopped being payable
          // between the read above and this write. Both are "this money must not be taken".
          throw ApiError.badRequest('Cannot overpay invoice');
        }

        payment = await this.paymentRepository.createInSession(
          {
            paymentNumber,
            receiptNumber,
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
            idempotencyKey,
            status: PAYMENT_RECORD_STATUS.RECORDED,
            paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
            createdBy: actorId,
            updatedBy: actorId,
          },
          session
        );

        // Rewrite the invoice's money fields from the ledger rather than trusting the $inc above.
        // Credit-note settlement lives outside the payment rows, so it is added back in.
        const settledPaise =
          (await this.paymentRepository.sumRecordedPaiseForInvoice(invoice._id, { session }))
          + toPaise(claimed.creditApplied || 0);
        const paidAmount = fromPaise(settledPaise);
        const balanceAmount = fromPaise(Math.max(0, totalPaise - settledPaise));
        paymentStatus = this.#paymentStatusFrom(paidAmount, invoice.total, claimed.status);

        await this.invoiceRepository.updateByIdInSession(
          id,
          {
            paidAmount,
            balanceAmount,
            paymentStatus,
            updatedBy: actorId,
            $push: {
              timeline: {
                at: new Date(),
                action: 'PAYMENT',
                note: `${method} ₹${amount}${isAdvance ? ' (advance)' : ''}`,
                actorId,
              },
            },
          },
          session
        );
      });
    } catch (error) {
      // The unique (invoiceId, idempotencyKey) index caught a retry that raced past the
      // pre-flight lookup — answer with the original payment's invoice, not an error.
      if (error?.code === 11000 && idempotencyKey) {
        const replay = await this.paymentRepository.findByIdempotencyKey(invoice._id, idempotencyKey);
        if (replay) return this.getById(id);
      }
      throw error;
    } finally {
      await session.endSession();
    }

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
    if (payment.status === PAYMENT_RECORD_STATUS.VOID) {
      throw ApiError.badRequest('A voided payment cannot be refunded');
    }
    if (!payload.reason) throw ApiError.badRequest('Refund reason is required');

    /**
     * MON-003 — refunds ACCUMULATE.
     *
     * The old code overwrote `refundedAmount` with the latest refund and flipped the payment to
     * REFUNDED regardless of how much was actually returned, so a ₹100 refund against a ₹1000
     * payment both understated the refund and made the remaining ₹900 permanently unrefundable
     * through the app. What is refundable is the payment less everything already returned, and
     * the payment only reaches REFUNDED once that reaches zero. Paise throughout: a sequence of
     * partial refunds is exactly where accumulated float error would leave a stranded paisa.
     */
    const paymentPaise = toPaise(payment.amount);
    const alreadyRefundedPaise = toPaise(payment.refundedAmount || 0);
    const refundablePaise = paymentPaise - alreadyRefundedPaise;
    if (refundablePaise <= 0) {
      throw ApiError.badRequest('Payment has already been refunded');
    }

    const refundPaise = payload.amount === undefined || payload.amount === null
      ? refundablePaise
      : toPaise(payload.amount);
    if (refundPaise <= 0) throw ApiError.badRequest('Refund amount must be greater than zero');
    if (refundPaise > refundablePaise) {
      throw ApiError.badRequest(
        alreadyRefundedPaise > 0
          ? `Refund amount cannot exceed the ₹${fromPaise(refundablePaise)} still refundable on this payment`
          : 'Refund amount cannot exceed the original payment'
      );
    }
    const refundAmount = fromPaise(refundPaise);
    const totalRefundedPaise = alreadyRefundedPaise + refundPaise;
    const fullyRefunded = totalRefundedPaise >= paymentPaise;
    const refundMethod = payload.method || 'ORIGINAL_MODE';

    // Claim the refund on the payment BEFORE minting any instrument: the conditional update is
    // what stops two concurrent refunds from each being sized against the same starting figure,
    // and issuing the credit note first would leave a spendable orphan behind when it loses.
    const claimed = await this.paymentRepository.claimRefund(paymentId, {
      expectedRefundedAmount: fromPaise(alreadyRefundedPaise),
      updates: {
        // ACCUMULATE. Overwriting with just this refund's amount is the original defect: after a
        // ₹100 refund on a ₹1000 payment the record claimed ₹100 returned in total, so the next
        // refund was sized against ₹900 again and the payment could be drained repeatedly.
        refundedAmount: fromPaise(totalRefundedPaise),
        refundedAt: new Date(),
        refundNotes: payload.notes || null,
        refundMethod,
        refundReason: payload.reason,
        refundApprovedBy: actorId,
        // Only a fully-returned payment is REFUNDED; a partially-refunded one is still a
        // RECORDED payment carrying a balance, and must stay refundable.
        status: fullyRefunded ? PAYMENT_RECORD_STATUS.REFUNDED : PAYMENT_RECORD_STATUS.RECORDED,
        updatedBy: actorId,
      },
    });
    if (!claimed) {
      throw ApiError.badRequest(
        'This payment was refunded concurrently — reload the payment and retry with the remaining refundable amount'
      );
    }

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
      await this.paymentRepository.updateById(paymentId, { creditNoteId: creditNote._id });
    }

    const invoice = await this.invoiceRepository.findByIdNotDeleted(payment.invoiceId);
    if (invoice) {
      // Derived from the payment rows (net of refunds) plus credit-note settlement, for the same
      // reason recordPayment derives it: the invoice's money fields are a projection of the
      // ledger, so a partial refund can never leave them disagreeing with it.
      const totalPaise = toPaise(invoice.total);
      const settledPaise =
        (await this.paymentRepository.sumRecordedPaiseForInvoice(invoice._id))
        + toPaise(invoice.creditApplied || 0);
      const paidAmount = fromPaise(Math.max(0, settledPaise));
      const balanceAmount = fromPaise(Math.max(0, totalPaise - settledPaise));
      await this.invoiceRepository.updateById(invoice._id, {
        paidAmount,
        balanceAmount,
        paymentStatus: settledPaise <= 0 ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_PAID,
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

    // LOY-006 — best-effort/non-blocking, both halves of a refund's loyalty impact:
    //  1. claw back points EARNED (CREDIT) from this invoice — the invoice being refunded no
    //     longer justifies the reward it paid for.
    //  2. re-credit points REDEEMED (DEBIT_REDEEM) against it — the patient's own points that
    //     paid part of this invoice are given back, since the invoice they bought is now
    //     (partially) unwound. See #recreditRedeemedLoyaltyPoints for expiry-restoration rules.
    if (invoice) {
      const reasonNote = `Refund of payment ${paymentId} — ${payload.reason}`;
      await this.#clawbackEarnedLoyaltyPoints(invoice, reasonNote, actorId, req);
      await this.#recreditRedeemedLoyaltyPoints(invoice, reasonNote, actorId, req);
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

  /**
   * A.8 — the front door for a refund. Below config.billing.refundApprovalThresholdAmount (or
   * for an actor who already holds BILLING_REFUND_APPROVE), the refund applies immediately via
   * refund() — same behaviour as before this queue existed. Above it, a RefundRequest is created
   * PENDING_APPROVAL instead and no money moves until an approver decides. Mirrors
   * LoyaltyAdminService#createPatientAdjustment's canAutoApply split.
   */
  async requestRefund(paymentId, payload, actor, req = null, canAutoApply = false) {
    const actorId = actor?.userId || actor;
    const payment = await this.paymentRepository.findByIdNotDeleted(paymentId);
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.status === PAYMENT_RECORD_STATUS.VOID) {
      throw ApiError.badRequest('A voided payment cannot be refunded');
    }
    if (!payload.reason) throw ApiError.badRequest('Refund reason is required');

    const paymentPaise = toPaise(payment.amount);
    const alreadyRefundedPaise = toPaise(payment.refundedAmount || 0);
    const refundablePaise = paymentPaise - alreadyRefundedPaise;
    if (refundablePaise <= 0) throw ApiError.badRequest('Payment has already been refunded');
    const refundPaise = payload.amount === undefined || payload.amount === null
      ? refundablePaise
      : toPaise(payload.amount);
    if (refundPaise <= 0) throw ApiError.badRequest('Refund amount must be greater than zero');
    if (refundPaise > refundablePaise) {
      throw ApiError.badRequest('Refund amount cannot exceed the amount still refundable on this payment');
    }
    const amount = fromPaise(refundPaise);

    const threshold = Number(config.billing.refundApprovalThresholdAmount) || 0;
    if (canAutoApply || amount <= threshold) {
      const result = await this.refund(paymentId, payload, actorId, req);
      return { status: 'APPLIED', ...result };
    }

    const request = await RefundRequest.create({
      branchId: payment.branchId,
      invoiceId: payment.invoiceId,
      paymentId: payment._id,
      patientId: payment.patientId || null,
      amount,
      method: payload.method || 'ORIGINAL_MODE',
      reason: payload.reason,
      notes: payload.notes || null,
      creditNoteExpiresAt: payload.creditNoteExpiresAt || null,
      requestedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PAYMENT_REFUND_REQUESTED || AUDIT_ACTIONS.PAYMENT_REFUNDED, {
      actorId,
      metadata: { paymentId, amount, reason: payload.reason, refundRequestId: request._id.toString() },
      branchId: payment.branchId,
      resourceType: 'RefundRequest',
      resourceId: request._id,
      req,
    });

    return { status: 'PENDING_APPROVAL', refundRequest: request.toSafeObject() };
  }

  /**
   * A.8 — the approver's worklist: refund requests above threshold, awaiting a decision.
   * Permission-gated at the route layer via BILLING_REFUND_APPROVE.
   */
  async listRefundApprovalQueue(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const status = REFUND_APPROVAL_STATUS_LIST.includes(query.status)
      ? query.status
      : REFUND_APPROVAL_STATUS.PENDING_APPROVAL;
    const filter = { status };
    if (query.branchId) filter.branchId = query.branchId;

    const [items, total] = await Promise.all([
      RefundRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('patientId', 'firstName lastName mobile')
        .populate('requestedBy', 'name email')
        .populate('invoiceId', 'invoiceNumber')
        .lean(),
      RefundRequest.countDocuments(filter),
    ]);

    const mapped = items.map((row) => ({
      id: row._id.toString(),
      branchId: row.branchId?.toString?.() || row.branchId,
      invoiceId: row.invoiceId?._id?.toString?.() || row.invoiceId?.toString?.() || row.invoiceId,
      invoiceNumber: row.invoiceId?.invoiceNumber || null,
      paymentId: row.paymentId?.toString?.() || row.paymentId,
      patientId: row.patientId?._id?.toString?.() || null,
      patientName: row.patientId ? `${row.patientId.firstName || ''} ${row.patientId.lastName || ''}`.trim() : null,
      amount: row.amount,
      method: row.method,
      reason: row.reason,
      notes: row.notes,
      status: row.status,
      requestedBy: row.requestedBy?._id?.toString?.() || null,
      requestedByName: row.requestedBy?.name || null,
      decidedBy: row.decidedBy?.toString?.() || null,
      decidedAt: row.decidedAt,
      decisionNote: row.decisionNote,
      thresholdAmount: config.billing.refundApprovalThresholdAmount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return { items: mapped, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
  }

  /** Shared approve/reject body for a refund request — mirrors #decideDiscount. */
  async #decideRefund(id, payload, actorId, req, { approve, scopedBranchId = null }) {
    const verb = approve ? 'approve' : 'reject';
    const note = String(payload?.decisionNote ?? payload?.reason ?? '').trim();
    if (!note) throw ApiError.badRequest(`A reason is required to ${verb} a refund`);

    const request = await RefundRequest.findById(id);
    if (!request) throw ApiError.notFound('Refund request not found');
    if (scopedBranchId && request.branchId?.toString() !== scopedBranchId.toString()) {
      throw ApiError.notFound('Refund request not found');
    }
    if (request.status !== REFUND_APPROVAL_STATUS.PENDING_APPROVAL) {
      throw ApiError.badRequest('Only pending refund requests can be decided');
    }

    if (approve) {
      const result = await this.refund(
        request.paymentId.toString(),
        {
          amount: request.amount,
          method: request.method,
          reason: request.reason,
          notes: request.notes,
          creditNoteExpiresAt: request.creditNoteExpiresAt,
        },
        actorId,
        req
      );
      request.status = REFUND_APPROVAL_STATUS.APPROVED;
      request.resultPaymentId = request.paymentId;
      request.resultCreditNoteId = result.creditNote?.id || null;
      request.decisionNote = note;
      request.decidedBy = actorId;
      request.decidedAt = new Date();
      await request.save();

      await this.auditService.record(AUDIT_ACTIONS.PAYMENT_REFUNDED, {
        actorId,
        metadata: { refundRequestId: id, amount: request.amount, decisionNote: note },
        branchId: request.branchId,
        resourceType: 'RefundRequest',
        resourceId: id,
        req,
      });

      return { refundRequest: request.toSafeObject(), ...result };
    }

    request.status = REFUND_APPROVAL_STATUS.REJECTED;
    request.decisionNote = note;
    request.decidedBy = actorId;
    request.decidedAt = new Date();
    await request.save();

    await this.auditService.record(AUDIT_ACTIONS.PAYMENT_REFUNDED, {
      actorId,
      metadata: { refundRequestId: id, amount: request.amount, decisionNote: note, rejected: true },
      branchId: request.branchId,
      resourceType: 'RefundRequest',
      resourceId: id,
      req,
    });

    return { refundRequest: request.toSafeObject() };
  }

  async approveRefund(id, payload, actorId, req = null, scopedBranchId = null) {
    return this.#decideRefund(id, payload, actorId, req, { approve: true, scopedBranchId });
  }

  async rejectRefund(id, payload, actorId, req = null, scopedBranchId = null) {
    return this.#decideRefund(id, payload, actorId, req, { approve: false, scopedBranchId });
  }

  /**
   * MON-004 — spend a credit note against an invoice.
   *
   * Every one of these guards was previously absent, and each of them is money: an expired,
   * revoked or already-spent note could be applied; it could be applied to a DRAFT invoice
   * (whose totals are still editable, and which resets `paidAmount` on the next edit) or to a
   * cancelled one; it could be applied to another patient's invoice; and it could be applied for
   * more than the invoice owed, manufacturing a credit out of an overpayment.
   */
  async applyCreditNote(creditNoteId, invoiceId, amount, actorId, req = null) {
    const creditNote = await CreditNote.findById(creditNoteId);
    if (!creditNote) throw ApiError.notFound('Credit note not found');

    const amountPaise = toPaise(amount);
    if (amountPaise <= 0) throw ApiError.badRequest('Amount must be greater than zero');

    // Expiry is checked against the note's own date, and a lapsed note is marked EXPIRED on the
    // way past so it stops appearing as spendable in every later listing too.
    if (creditNote.expiresAt && new Date(creditNote.expiresAt).getTime() < Date.now()) {
      if (creditNote.status !== CREDIT_NOTE_STATUS.EXPIRED) {
        await CreditNote.updateOne(
          { _id: creditNote._id, status: { $in: CREDIT_NOTE_REDEEMABLE_STATUSES } },
          { $set: { status: CREDIT_NOTE_STATUS.EXPIRED } }
        );
      }
      throw ApiError.badRequest('This credit note has expired');
    }
    if (!CREDIT_NOTE_REDEEMABLE_STATUSES.includes(creditNote.status)) {
      throw ApiError.badRequest(`A ${creditNote.status} credit note cannot be applied`);
    }
    if (toPaise(creditNote.balance) < amountPaise) {
      throw ApiError.badRequest('Amount exceeds credit note balance');
    }

    const invoice = await this.invoiceRepository.findByIdNotDeleted(invoiceId);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status !== INVOICE_STATUS.FINALIZED) {
      throw ApiError.badRequest(
        invoice.status === INVOICE_STATUS.DRAFT
          ? 'Only finalized invoices can be settled with a credit note'
          : `A ${invoice.status} invoice cannot be settled with a credit note`
      );
    }
    if (invoice.paymentStatus === PAYMENT_STATUS.WRITTEN_OFF) {
      throw ApiError.badRequest('This invoice balance has been written off');
    }
    // A credit note is issued to a patient, not to the clinic — spending it on someone else's
    // invoice moves money between patients' accounts.
    if (String(creditNote.patientId) !== String(invoice.patientId)) {
      throw ApiError.badRequest("This credit note belongs to a different patient");
    }
    const outstandingPaise = toPaise(invoice.balanceAmount);
    if (amountPaise > outstandingPaise) {
      throw ApiError.badRequest(
        `Amount exceeds the invoice's outstanding balance of ₹${fromPaise(outstandingPaise)}`
      );
    }

    // Conditional claim on the invoice first: it is the thing that can be over-settled, and a
    // failed claim must not have already debited the note.
    const settledPaise = toPaise(invoice.paidAmount || 0) + amountPaise;
    const claimedInvoice = await this.invoiceRepository.claimCreditApplication(invoiceId, {
      amount,
      $set: {
        paidAmount: fromPaise(settledPaise),
        balanceAmount: fromPaise(Math.max(0, toPaise(invoice.total) - settledPaise)),
        paymentStatus:
          settledPaise >= toPaise(invoice.total) ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PARTIALLY_PAID,
        updatedBy: actorId,
      },
      $push: {
        timeline: {
          at: new Date(),
          action: 'CREDIT_NOTE_APPLIED',
          note: `Applied ₹${fromPaise(amountPaise)} from credit note ${creditNote.creditNoteNumber}`,
          actorId,
        },
      },
    });
    if (!claimedInvoice) {
      throw ApiError.badRequest(
        'The invoice was settled concurrently — reload it and reapply for the remaining balance'
      );
    }

    // Debit the note conditionally too, so the same note cannot be spent twice in parallel. If
    // this loses, the invoice claim above is rolled back rather than left settled for free.
    const debited = await CreditNote.findOneAndUpdate(
      {
        _id: creditNote._id,
        status: { $in: CREDIT_NOTE_REDEEMABLE_STATUSES },
        balance: { $gte: fromPaise(amountPaise) - 0.005 },
      },
      {
        $inc: { balance: -fromPaise(amountPaise) },
        $push: { appliedTo: { invoiceId, amount: fromPaise(amountPaise), appliedAt: new Date() } },
      },
      { new: true }
    );
    if (!debited) {
      await this.invoiceRepository.claimCreditApplication(invoiceId, {
        amount: -fromPaise(amountPaise),
        $set: {
          paidAmount: invoice.paidAmount || 0,
          balanceAmount: invoice.balanceAmount,
          paymentStatus: invoice.paymentStatus,
          updatedBy: actorId,
        },
      });
      throw ApiError.badRequest('This credit note was spent concurrently — reload it and retry');
    }
    if (toPaise(debited.balance) <= 0 && debited.status !== CREDIT_NOTE_STATUS.FULLY_USED) {
      debited.status = CREDIT_NOTE_STATUS.FULLY_USED;
      await debited.save();
    } else if (toPaise(debited.balance) > 0 && debited.status === CREDIT_NOTE_STATUS.ISSUED) {
      debited.status = CREDIT_NOTE_STATUS.PARTIALLY_USED;
      await debited.save();
    }
    const balanceAmount = fromPaise(Math.max(0, toPaise(invoice.total) - settledPaise));

    await this.auditService.record(AUDIT_ACTIONS.CREDIT_NOTE_APPLIED, {
      actorId,
      metadata: { creditNoteId, invoiceId, amount },
      req,
    });

    // Loyalty accrual keys off InvoicePaid, so an invoice settled entirely by a credit note has
    // to announce itself the same way one settled by cash does.
    if (balanceAmount <= 0) {
      eventBus.emitDomain(BILLING_EVENTS.INVOICE_PAID, {
        invoiceId: invoiceId.toString(),
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        patientId: invoice.patientId.toString(),
      });
    }

    return { creditNote: debited.toSafeObject(), invoice: await this.getById(invoiceId) };
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

    const printed = await this.getById(id);
    // ORG-001 — the configured footer note is part of the printed document, not decoration.
    const { invoiceFooterNote } = await this.organizationService.getInvoiceSettings();

    return {
      invoice: printed,
      // GST grouped by rate: what a mixed-rate invoice must show and what GSTR-1 needs. It sums
      // back to `invoice.tax` exactly, because both come from the same per-line figures.
      taxBreakdown: taxBreakdown(printed.items || []),
      footerNote: invoiceFooterNote,
      printMeta: {
        printedAt: new Date().toISOString(),
        invoiceFooterNote,
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
    const { invoiceFooterNote } = await this.organizationService.getInvoiceSettings();
    return {
      payment: (await this.paymentRepository.findByIdNotDeleted(paymentId)).toSafeObject(),
      invoice,
      taxBreakdown: taxBreakdown(invoice.items || []),
      footerNote: invoiceFooterNote,
      printMeta: {
        printedAt: new Date().toISOString(),
        invoiceFooterNote,
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
