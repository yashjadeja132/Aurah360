import BaseRepository from './BaseRepository.js';
import Invoice from '../models/Invoice.model.js';
import Payment from '../models/Payment.model.js';
import mongoose from 'mongoose';
import { INVOICE_STATUS } from '../enums/billing.js';

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
    limit = 50,
    skip = 0,
  } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (search) {
      filter.invoiceNumber = { $regex: search, $options: 'i' };
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

  async sumRecordedForInvoice(invoiceId) {
    const rows = await this.model.aggregate([
      {
        $match: {
          invoiceId: typeof invoiceId === 'string' ? new (await import('mongoose')).default.Types.ObjectId(invoiceId) : invoiceId,
          deletedAt: null,
          status: 'RECORDED',
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return rows[0]?.total || 0;
  }
}

export { InvoiceRepository, PaymentRepository };
export default InvoiceRepository;
