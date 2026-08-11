import BaseRepository from './BaseRepository.js';
import Invoice from '../models/Invoice.model.js';
import Payment from '../models/Payment.model.js';
import mongoose from 'mongoose';
import { INVOICE_STATUS, PAYMENT_RECORD_STATUS, PAYMENT_STATUS } from '../enums/billing.js';

/** Aggregate $match does no schema casting — ids must already be ObjectIds. */
const toObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

class InvoiceRepository extends BaseRepository {
  constructor() {
    super(Invoice);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  /**
   * LOY-005 — conditionally claims the invoice's single loyalty-redemption slot. Returns null
   * when the invoice is no longer a redeemable draft or another request already holds the slot,
   * which is what stops two concurrent apply-redemption calls from both passing a
   * read-then-write "is one already applied?" check and debiting the ledger twice.
   */
  async claimLoyaltyRedemptionSlot(id, updates) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null, status: INVOICE_STATUS.DRAFT, loyaltyRedemption: null },
        { $set: updates },
        { new: true }
      )
      .exec();
  }

  /**
   * MON-001 — conditionally claims headroom on the invoice for a payment of `amount`.
   *
   * The predicate `paidAmount <= maxPaid` (where maxPaid = total - amount) is what makes
   * concurrent collection safe: it is evaluated by the server as part of the same atomic update
   * that applies the `$inc`, so two cashiers cannot both read a stale `paidAmount`, both pass an
   * in-process overpay check, and both write. Whoever arrives second either sees the first
   * writer's committed increment and fails the predicate, or (inside a transaction) hits a write
   * conflict on this very document and re-evaluates on retry.
   *
   * Returns null when the invoice is no longer a finalized, payable invoice or the payment would
   * overpay it. The `$inc` here is a provisional claim only — the caller rewrites `paidAmount`
   * from the payment ledger afterwards, so float drift from repeated increments never accrues.
   */
  async claimPaymentHeadroom(id, { amount, maxPaid, isAdvance = false, session = null }) {
    const inc = { paidAmount: amount };
    if (isAdvance) inc.advanceApplied = amount;
    return this.model
      .findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          status: INVOICE_STATUS.FINALIZED,
          paymentStatus: { $nin: [PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.WRITTEN_OFF] },
          // Half-paise tolerance, matching the 0.001 rupee tolerance used throughout billing:
          // the stored figure is a rounded rupee value, not an exact one.
          paidAmount: { $lte: maxPaid + 0.005 },
        },
        { $inc: inc },
        { new: true, session }
      )
      .exec();
  }

  /** Session-aware update, for callers running inside a transaction. */
  async updateByIdInSession(id, update, session = null) {
    return this.model.findByIdAndUpdate(id, update, { new: true, session }).exec();
  }

  /** MON-002 — conditionally moves a FINALIZED invoice to CANCELLED. Conditional so a second
   *  cancel (or a race with a payment) cannot annul an invoice that has since been settled. */
  async cancelFinalized(id, updates) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null, status: INVOICE_STATUS.FINALIZED },
        updates,
        { new: true }
      )
      .exec();
  }

  /** MON-002 — conditionally records a write-off. `writeOffAmount: 0` in the predicate makes the
   *  operation single-shot: a balance cannot be written off twice. */
  async claimWriteOff(id, updates) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null, status: INVOICE_STATUS.FINALIZED, writeOffAmount: { $lte: 0 } },
        updates,
        { new: true }
      )
      .exec();
  }

  /**
   * MON-004 — conditionally applies credit-note money to a finalized invoice. The
   * `balanceAmount >= amount` predicate is evaluated server-side, so two concurrent applications
   * of the same (or different) credit notes cannot both settle the last rupee of one invoice.
   */
  async claimCreditApplication(id, { amount, session = null, ...updates }) {
    return this.model
      .findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          status: INVOICE_STATUS.FINALIZED,
          balanceAmount: { $gte: amount - 0.005 },
        },
        { $inc: { creditApplied: amount }, ...updates },
        { new: true, session }
      )
      .exec();
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'mrn firstName lastName mobile email gender')
      .populate({
        path: 'doctorId',
        select: 'doctorCode specialization userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('branchId', 'name displayName branchCode address phone email settings currency')
      .populate('consultationId', 'consultationNumber status')
      .populate('treatmentPlanId', 'planNumber title status packageSnapshot')
      .populate('appointmentId', 'appointmentNumber status scheduledStart')
      .exec();
  }

  async list({
    branchId = null,
    patientId = null,
    status = null,
    paymentStatus = null,
    search = null,
    // Command palette / search-by-patient-name support: the invoice model itself has no
    // patient name snapshot, so the caller (BillingService) resolves matching patient ids
    // via PatientRepository's own scoped search first and hands them in here. We OR that set
    // against the invoiceNumber regex rather than filtering by it directly, so a search still
    // matches on invoice number alone even when it matches no patient name.
    patientIds = null,
    limit = 50,
    skip = 0,
  } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (search) {
      const or = [{ invoiceNumber: { $regex: search, $options: 'i' } }];
      if (patientIds && patientIds.length) {
        or.push({ patientId: { $in: patientIds.map(toObjectId) } });
      }
      filter.$or = or;
    }
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  /**
   * A.5 — draft invoices sitting in a given discount-approval state, oldest-decision-first is
   * unhelpful for a worklist so newest-request-first, matching the loyalty adjustment queue.
   */
  async listByDiscountApprovalStatus({ status, branchId = null, limit = 50, skip = 0 } = {}) {
    const filter = { deletedAt: null, discountApprovalStatus: status };
    // A voided/cancelled invoice keeps whatever discountApprovalStatus it had, so without this
    // it would sit in the approver's queue forever — and it cannot be cleared, because
    // approve/reject both refuse to edit a non-draft invoice. Nothing is decidable about a
    // dead invoice, so it never belongs in a decision queue.
    filter.status = { $nin: [INVOICE_STATUS.VOID, INVOICE_STATUS.CANCELLED] };
    if (branchId) filter.branchId = branchId;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  /**
   * A.4 — finalized invoices still carrying a balance, OLDEST FIRST (the collection worklist is
   * driven by age, unlike the newest-first browse list). `patientIds` narrows the set to the
   * patients checked in today when that filter is on.
   */
  async listOutstanding({
    branchId = null,
    patientId = null,
    patientIds = null,
    search = null,
    invoiceDateFrom = null,
    invoiceDateTo = null,
    limit = 50,
    skip = 0,
  } = {}) {
    const filter = {
      deletedAt: null,
      status: 'FINALIZED',
      balanceAmount: { $gt: 0 },
    };
    if (branchId) filter.branchId = branchId;
    if (patientId) filter.patientId = patientId;
    if (patientIds) filter.patientId = { $in: patientIds };
    if (search) filter.invoiceNumber = { $regex: search, $options: 'i' };
    if (invoiceDateFrom || invoiceDateTo) {
      filter.invoiceDate = {};
      if (invoiceDateFrom) filter.invoiceDate.$gte = invoiceDateFrom;
      if (invoiceDateTo) filter.invoiceDate.$lte = invoiceDateTo;
    }
    // find()/countDocuments() get their string ids cast to ObjectId by Mongoose, but aggregate()
    // does NOT — an uncast string in $match matches nothing, which silently returned
    // totalOutstanding: 0 whenever a branch/patient filter was applied. Cast explicitly for the
    // aggregate rather than reusing `filter` as-is.
    const aggregateMatch = { ...filter };
    if (filter.branchId) aggregateMatch.branchId = toObjectId(filter.branchId);
    if (filter.patientId) {
      aggregateMatch.patientId = filter.patientId.$in
        ? { $in: filter.patientId.$in.map(toObjectId) }
        : toObjectId(filter.patientId);
    }

    const [items, total, totals] = await Promise.all([
      this.model.find(filter).sort({ invoiceDate: 1, createdAt: 1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
      this.model
        .aggregate([{ $match: aggregateMatch }, { $group: { _id: null, outstanding: { $sum: '$balanceAmount' } } }])
        .exec(),
    ]);
    return { items, total, totalOutstanding: totals[0]?.outstanding || 0 };
  }
}

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByInvoice(invoiceId) {
    return this.model
      .find({ invoiceId, deletedAt: null })
      .sort({ paidAt: -1 })
      .exec();
  }

  /**
   * MON-001 — THE reconciliation primitive: what this invoice has actually been paid, in integer
   * PAISE, derived from the payment rows themselves rather than from a denormalised counter.
   *
   * Net of refunds and blind to VOID rows, so it is the single true answer to "how much money is
   * on this invoice" no matter how many payments, retries or partial refunds preceded it. Summed
   * in paise inside the aggregation because summing rupee floats across many rows is exactly how
   * a ledger acquires a stray paisa.
   */
  async sumRecordedPaiseForInvoice(invoiceId, { session = null } = {}) {
    const rows = await this.model
      .aggregate([
        {
          $match: {
            invoiceId: toObjectId(invoiceId),
            deletedAt: null,
            status: { $ne: PAYMENT_RECORD_STATUS.VOID },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $round: [
                  {
                    $multiply: [
                      { $subtract: ['$amount', { $ifNull: ['$refundedAmount', 0] }] },
                      100,
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      ])
      .session(session)
      .exec();
    return rows[0]?.total || 0;
  }

  /** Rupee-denominated view of sumRecordedPaiseForInvoice, for callers reporting money rather
   *  than reconciling it. */
  async sumRecordedForInvoice(invoiceId, options = {}) {
    return (await this.sumRecordedPaiseForInvoice(invoiceId, options)) / 100;
  }

  /** Session-aware insert — `Model.create` only accepts a session when handed an array. */
  async createInSession(data, session = null) {
    const [doc] = await this.model.create([data], { session });
    return doc;
  }

  /** MON-001 — replay lookup for a retried payment request. */
  async findByIdempotencyKey(invoiceId, idempotencyKey, { session = null } = {}) {
    return this.model
      .findOne({ invoiceId, idempotencyKey, deletedAt: null })
      .session(session)
      .exec();
  }

  /**
   * MON-003 — conditionally accumulates a refund onto a payment. The predicate pins the
   * `refundedAmount` the caller validated against, so two concurrent refunds of the same payment
   * cannot both be computed from the same starting figure and each be allowed the full balance.
   */
  async claimRefund(paymentId, { expectedRefundedAmount, updates }) {
    return this.model
      .findOneAndUpdate(
        {
          _id: paymentId,
          deletedAt: null,
          status: { $ne: PAYMENT_RECORD_STATUS.VOID },
          // A payment refunded exactly zero times may carry `refundedAmount: 0`, null or absent.
          $or:
            expectedRefundedAmount === 0
              ? [{ refundedAmount: { $in: [0, null] } }, { refundedAmount: { $exists: false } }]
              : [{ refundedAmount: expectedRefundedAmount }],
        },
        updates,
        { new: true }
      )
      .exec();
  }
}

export { InvoiceRepository, PaymentRepository };
export default InvoiceRepository;
