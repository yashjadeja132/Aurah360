import ApiError from '../libs/ApiError.js';
import CashClose from '../models/CashClose.model.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { CASH_CLOSE_STATUS } from '../enums/billing.js';

/** Daily branch cash close (BIL-003, §11.3). */
class CashCloseService {
  constructor() {
    this.auditService = new AuditService();
  }

  #round(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  /**
   * SEC-030 — a CASHIER/BRANCH_MANAGER submits the close for the till they actually worked, so a
   * client-supplied `branchId` is overwritten with the caller's own branch rather than trusted.
   * Without this, any BILLING_CASH_CLOSE holder could write (and, via the upsert, overwrite)
   * another branch's daily close.
   */
  async submit(rawPayload, actorId, req = null, scopedBranchId = null) {
    const payload = scopedBranchId ? { ...rawPayload, branchId: scopedBranchId } : rawPayload;
    const expectedCash = this.#round(
      (Number(payload.openingCash) || 0) +
        (Number(payload.cashCollected) || 0) -
        (Number(payload.cashRefunded) || 0)
    );
    const variance = this.#round(payload.countedCash - expectedCash);

    // CC-06 — a reason is mandatory on any non-zero variance, checked against the server-computed
    // variance so a client cannot skip it by supplying its own figure.
    const varianceReason = String(payload.varianceReason ?? '').trim();
    if (variance !== 0 && !varianceReason) {
      throw ApiError.badRequest('A variance reason is required when counted cash differs from expected cash');
    }

    const close = await CashClose.findOneAndUpdate(
      { branchId: payload.branchId, closeDate: payload.closeDate },
      {
        ...payload,
        varianceReason: varianceReason || null,
        expectedCash,
        variance,
        status: variance !== 0 && !varianceReason ? CASH_CLOSE_STATUS.DISPUTED : CASH_CLOSE_STATUS.SUBMITTED,
        submittedBy: actorId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await this.auditService.record(AUDIT_ACTIONS.CASH_CLOSE_SUBMITTED, {
      actorId,
      metadata: { branchId: payload.branchId, closeDate: payload.closeDate, variance },
      req,
    });

    return close.toSafeObject();
  }

  /** SEC-030 — another branch's close answers 404, never 403 (the id must stay unconfirmable). */
  async approve(id, actorId, req = null, scopedBranchId = null) {
    const close = await CashClose.findById(id);
    if (!close) throw ApiError.notFound('Cash close record not found');
    if (scopedBranchId && String(close.branchId || '') !== String(scopedBranchId)) {
      throw ApiError.notFound('Cash close record not found');
    }
    close.status = CASH_CLOSE_STATUS.APPROVED;
    close.approvedBy = actorId;
    close.approvedAt = new Date();
    await close.save();

    await this.auditService.record(AUDIT_ACTIONS.CASH_CLOSE_APPROVED, {
      actorId,
      metadata: { cashCloseId: id },
      req,
    });
    return close.toSafeObject();
  }

  async list(query = {}) {
    const filter = {};
    if (query.branchId) filter.branchId = query.branchId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.closeDate = {};
      if (query.from) filter.closeDate.$gte = new Date(query.from);
      if (query.to) filter.closeDate.$lte = new Date(query.to);
    }
    const rows = await CashClose.find(filter).sort({ closeDate: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }
}

export default CashCloseService;
