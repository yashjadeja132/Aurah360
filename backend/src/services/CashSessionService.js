import ApiError from '../libs/ApiError.js';
import CashSession from '../models/CashSession.model.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { CASH_SESSION_STATUS } from '../enums/billing.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * "Open cash for the day" (start-of-day till open). Kept deliberately small: a session's only
 * job is to record the opening float and who opened it, so CashCloseService#submit can look it
 * up instead of trusting a free-form `openingCash` at end-of-day close time.
 */
class CashSessionService {
  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * SEC-030 — mirrors CashCloseService#submit: a client-supplied branchId is overwritten with
   * the caller's own scoped branch, so a CASHIER/BRANCH_MANAGER can only ever open their own
   * branch's till.
   */
  async openSession({ branchId, sessionDate, openingFloat }, actorId, req = null, scopedBranchId = null) {
    const resolvedBranchId = scopedBranchId || branchId;
    if (!resolvedBranchId) throw ApiError.badRequest('branchId is required');

    const day = startOfDay(sessionDate || new Date());
    const existing = await CashSession.findOne({ branchId: resolvedBranchId, sessionDate: day });
    if (existing && existing.status === CASH_SESSION_STATUS.OPEN) {
      throw ApiError.conflict('A cash session is already open for this branch today');
    }

    const session = existing
      ? await CashSession.findOneAndUpdate(
        { _id: existing._id },
        {
          openingFloat: Number(openingFloat) || 0,
          openedBy: actorId,
          openedAt: new Date(),
          status: CASH_SESSION_STATUS.OPEN,
          closedAt: null,
          cashCloseId: null,
        },
        { new: true }
      )
      : await CashSession.create({
        branchId: resolvedBranchId,
        sessionDate: day,
        openingFloat: Number(openingFloat) || 0,
        openedBy: actorId,
      });

    await this.auditService.record(AUDIT_ACTIONS.CASH_SESSION_OPENED, {
      actorId,
      metadata: { branchId: resolvedBranchId, sessionDate: day, openingFloat: session.openingFloat },
      req,
    });

    return session.toSafeObject();
  }

  /** Today's session for a branch, if any — used by the cashier/branch-manager dashboards and
   * by CashCloseService#submit to source `openingCash` when the manual field is omitted. */
  async getTodaySession(branchId, date = new Date()) {
    if (!branchId) return null;
    const day = startOfDay(date);
    const session = await CashSession.findOne({ branchId, sessionDate: day });
    return session ? session.toSafeObject() : null;
  }

  async linkCashClose(branchId, date, cashCloseId) {
    const day = startOfDay(date);
    await CashSession.findOneAndUpdate(
      { branchId, sessionDate: day },
      { status: CASH_SESSION_STATUS.CLOSED, closedAt: new Date(), cashCloseId }
    );
  }

  async list(query = {}) {
    const filter = {};
    if (query.branchId) filter.branchId = query.branchId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.sessionDate = {};
      if (query.from) filter.sessionDate.$gte = new Date(query.from);
      if (query.to) filter.sessionDate.$lte = new Date(query.to);
    }
    const rows = await CashSession.find(filter).sort({ sessionDate: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }
}

export default CashSessionService;
