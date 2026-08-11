import BaseRepository from './BaseRepository.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import TreatmentProtocol from '../models/TreatmentProtocol.model.js';
import TreatmentPackage from '../models/TreatmentPackage.model.js';
import ConsentRecord from '../models/ConsentRecord.model.js';

class TreatmentPlanRepository extends BaseRepository {
  constructor() {
    super(TreatmentPlan);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByConsultation(consultationId) {
    return this.model
      .find({ consultationId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByPatient(patientId, { limit = 50 } = {}) {
    return this.model
      .find({ patientId, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findByDoctor(doctorId, { status = null, limit = 50, branchId = null } = {}) {
    const filter = { doctorId, deletedAt: null };
    if (status) filter.status = status;
    // SEC-030 — branchId comes from the caller's resolved scope (see helpers/scope.helper.js).
    if (branchId) filter.branchId = branchId;
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
  }

  /**
   * Cross-patient "Treatment plans awaiting approval" queue — DRAFT/RECOMMENDED plans (optionally
   * only the on-hold ones), scoped by doctor/branch straight on the document since (unlike LabOrder)
   * TreatmentPlan already carries its own doctorId/branchId — no join-then-filter workaround needed.
   */
  async findPendingApproval({
    doctorId = null,
    branchId = null,
    onHold = null,
    page = 1,
    limit = 25,
  } = {}) {
    const filter = {
      deletedAt: null,
      status: { $in: ['DRAFT', 'RECOMMENDED'] },
    };
    if (doctorId) filter.doctorId = doctorId;
    // SEC-030 — branchId comes from the caller's resolved scope (see helpers/scope.helper.js).
    if (branchId) filter.branchId = branchId;
    if (onHold !== null) filter.onHold = onHold;

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('patientId', 'mrn firstName lastName')
        .populate({
          path: 'doctorId',
          select: 'doctorCode userId',
          populate: { path: 'userId', select: 'firstName lastName' },
        })
        .populate('branchId', 'name displayName')
        .sort({ onHold: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter),
    ]);
    return { rows, total };
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'mrn firstName lastName mobile dateOfBirth gender')
      .populate({
        path: 'doctorId',
        select: 'doctorCode specialization userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('branchId', 'name displayName branchCode address phone')
      .populate('consultationId', 'consultationNumber status startedAt')
      .populate('protocolId', 'protocolCode name category')
      .exec();
  }
}

class TreatmentProtocolRepository extends BaseRepository {
  constructor() {
    super(TreatmentProtocol);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async listActive({ search = null, category = null, limit = 100 } = {}) {
    const filter = { deletedAt: null, isActive: true };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { protocolCode: { $regex: search, $options: 'i' } },
      ];
    }
    return this.model.find(filter).sort({ name: 1 }).limit(limit).exec();
  }
}

class TreatmentPackageRepository extends BaseRepository {
  constructor() {
    super(TreatmentPackage);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async listActive({ search = null, category = null, limit = 100 } = {}) {
    const filter = { deletedAt: null, isActive: true };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { packageCode: { $regex: search, $options: 'i' } },
      ];
    }
    return this.model.find(filter).sort({ name: 1 }).limit(limit).exec();
  }
}

class ConsentRecordRepository extends BaseRepository {
  constructor() {
    super(ConsentRecord);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByPlan(treatmentPlanId) {
    return this.model
      .find({ treatmentPlanId, deletedAt: null })
      .sort({ consentType: 1 })
      .exec();
  }

  async findByPlanAndType(treatmentPlanId, consentType) {
    return this.model
      .findOne({ treatmentPlanId, consentType, deletedAt: null })
      .exec();
  }
}

export {
  TreatmentPlanRepository,
  TreatmentProtocolRepository,
  TreatmentPackageRepository,
  ConsentRecordRepository,
};
export default TreatmentPlanRepository;
