import FeeSchedule from '../models/FeeSchedule.model.js';
import ApiError from '../libs/ApiError.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

/** Branch/doctor/service-specific effective-dated pricing (BIL-001, §11.3). */
class FeeScheduleService {
  constructor() {
    this.auditService = new AuditService();
  }

  async create(payload, actorId, req = null) {
    const row = await FeeSchedule.create({ ...payload, createdBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.FEE_SCHEDULE_UPDATED, {
      actorId,
      metadata: { serviceId: payload.serviceId, branchId: payload.branchId, doctorId: payload.doctorId },
      req,
    });
    return row.toSafeObject();
  }

  async list(query = {}) {
    const filter = { isActive: true };
    if (query.serviceId) filter.serviceId = query.serviceId;
    if (query.branchId) filter.branchId = query.branchId;
    if (query.doctorId) filter.doctorId = query.doctorId;
    const rows = await FeeSchedule.find(filter).sort({ effectiveFrom: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async deactivate(id, actorId) {
    const row = await FeeSchedule.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!row) throw ApiError.notFound('Fee schedule row not found');
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
