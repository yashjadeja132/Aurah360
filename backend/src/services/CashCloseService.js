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

  async submit(payload, actorId, req = null) {
    const expectedCash = this.#round(
      payload.openingCash + payload.cashCollected - payload.cashRefunded
    );
    const variance = this.#round(payload.countedCash - expectedCash);

    const close = await CashClose.findOneAndUpdate(
      { branchId: payload.branchId, closeDate: payload.closeDate },
      {
        ...payload,
        expectedCash,
        variance,
        status: variance !== 0 && !payload.varianceReason ? CASH_CLOSE_STATUS.DISPUTED : CASH_CLOSE_STATUS.SUBMITTED,
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

  async approve(id, actorId, req = null) {
    const close = await CashClose.findById(id);
    if (!close) throw ApiError.notFound('Cash close record not found');
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
