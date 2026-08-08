import FeeSchedule from '../models/FeeSchedule.model.js';
import ApiError from '../libs/ApiError.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

/** Branch/doctor/service-specific effective-dated pricing (BIL-001, §11.3). */
class FeeScheduleService {
  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * SEC-030 — a branch-scoped caller may only ever author pricing for their OWN branch; the
   * requested `branchId` is overwritten rather than validated so there is no way to author an
   * org-wide (`branchId: null`) price from a branch account.
   */
  async create(payload, actorId, req = null, scopedBranchId = null) {
    const body = scopedBranchId ? { ...payload, branchId: scopedBranchId } : payload;
    const row = await FeeSchedule.create({ ...body, createdBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.FEE_SCHEDULE_UPDATED, {
      actorId,
      metadata: { serviceId: body.serviceId, branchId: body.branchId, doctorId: body.doctorId },
      req,
    });
    return row.toSafeObject();
  }

  /**
   * SEC-030 — `branchId` here means "rows that APPLY to this branch", not "rows whose column
   * equals this branch". A FeeSchedule row with `branchId: null` is an organisation-wide default
   * price that governs every branch, so pinning the column outright would hide from a branch
   * user the very prices their own tills charge — an outage, not a fix. Branch-specific rows for
   * OTHER branches (which are commercially sensitive and were previously readable by every
   * BILLING_VIEW holder in the org) are what actually gets excluded.
   */
  async list(query = {}) {
    const filter = { isActive: true };
    if (query.serviceId) filter.serviceId = query.serviceId;
    if (query.branchId) filter.$or = [{ branchId: query.branchId }, { branchId: null }];
    if (query.doctorId) filter.doctorId = query.doctorId;
    const rows = await FeeSchedule.find(filter).sort({ effectiveFrom: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  /**
   * SEC-030 — 404 (not 403) for a row outside the caller's branch, including the org-wide
   * (`branchId: null`) defaults: a branch account must not be able to switch off pricing that
   * governs other branches, and must not learn that a given row id exists.
   */
  async deactivate(id, actorId, scopedBranchId = null) {
    const existing = await FeeSchedule.findById(id);
    if (!existing) throw ApiError.notFound('Fee schedule row not found');
    if (scopedBranchId && String(existing.branchId || '') !== String(scopedBranchId)) {
      throw ApiError.notFound('Fee schedule row not found');
    }
    const row = await FeeSchedule.findByIdAndUpdate(id, { isActive: false }, { new: true });
    return row.toSafeObject();
  }

  /** Resolve the effective price: most specific (branch+doctor) → branch → doctor → Master default. */
  async resolvePrice(serviceId, { branchId = null, doctorId = null, date = new Date() } = {}, defaultPrice = 0) {
    const candidates = await FeeSchedule.find({
      serviceId,
      isActive: true,
      effectiveFrom: { $lte: date },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }],
    })
      .sort({ effectiveFrom: -1 })
      .exec();

    const score = (row) => (row.branchId ? 2 : 0) + (row.doctorId ? 1 : 0);
    const matching = candidates.filter(
      (row) =>
        (!row.branchId || String(row.branchId) === String(branchId)) &&
        (!row.doctorId || String(row.doctorId) === String(doctorId))
    );
    matching.sort((a, b) => score(b) - score(a));

    return matching.length ? matching[0].toSafeObject() : { price: defaultPrice, source: 'MASTER_DEFAULT' };
  }
}

export default FeeScheduleService;
