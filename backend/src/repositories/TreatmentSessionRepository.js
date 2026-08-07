import BaseRepository from './BaseRepository.js';
import TreatmentSession from '../models/TreatmentSession.model.js';
import TreatmentSessionLog from '../models/TreatmentSessionLog.model.js';
import {
  ACTIVE_OR_DONE_SESSION_STATUSES,
  TREATMENT_SESSION_STATUS,
} from '../enums/treatmentSession.js';

class TreatmentSessionRepository extends BaseRepository {
  constructor() {
    super(TreatmentSession);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'mrn firstName lastName mobile gender')
      .populate({
        path: 'doctorId',
        select: 'doctorCode specialization userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('technicianId', 'firstName lastName role email')
      .populate('branchId', 'name displayName branchCode')
      .populate('treatmentPlanId', 'planNumber title status estimatedSessions packageSnapshot protocolId')
      .populate('invoiceId', 'invoiceNumber paymentStatus status total paidAmount balanceAmount')
      .populate('protocolId', 'protocolCode name')
      .exec();
  }

  async list({
    treatmentPlanId = null,
    patientId = null,
    doctorId = null,
    technicianId = null,
    branchId = null,
    status = null,
    limit = 50,
    skip = 0,
  } = {}) {
    const filter = { deletedAt: null };
    if (treatmentPlanId) filter.treatmentPlanId = treatmentPlanId;
    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.doctorId = doctorId;
    if (technicianId) filter.technicianId = technicianId;
    if (branchId) filter.branchId = branchId;
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ scheduledDate: -1, createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async countForPlan(treatmentPlanId, statuses = ACTIVE_OR_DONE_SESSION_STATUSES) {
    return this.model
      .countDocuments({
        treatmentPlanId,
        deletedAt: null,
        status: { $in: statuses },
      })
      .exec();
  }

  async countCompletedForPlan(treatmentPlanId) {
    return this.model
      .countDocuments({
        treatmentPlanId,
        deletedAt: null,
        status: TREATMENT_SESSION_STATUS.COMPLETED,
      })
      .exec();
  }

  async findByPlan(treatmentPlanId) {
    return this.model
      .find({ treatmentPlanId, deletedAt: null })
      .sort({ sessionIndex: 1, createdAt: 1 })
      .exec();
  }
}

class TreatmentSessionLogRepository extends BaseRepository {
  constructor() {
    super(TreatmentSessionLog);
  }

  async findBySession(treatmentSessionId) {
    return this.model.find({ treatmentSessionId }).sort({ createdAt: 1 }).exec();
  }
}

export { TreatmentSessionRepository, TreatmentSessionLogRepository };
export default TreatmentSessionRepository;
