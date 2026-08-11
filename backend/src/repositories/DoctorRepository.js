import BaseRepository from './BaseRepository.js';
import Doctor from '../models/Doctor.model.js';
import { paginateModel } from '../helpers/paginate.helper.js';

class DoctorRepository extends BaseRepository {
  constructor() {
    super(Doctor);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByUserId(userId) {
    return this.model.findOne({ userId, deletedAt: null }).exec();
  }

  async findByCode(doctorCode) {
    return this.model.findOne({
      doctorCode: doctorCode.toUpperCase().trim(),
      deletedAt: null,
    }).exec();
  }

  async findByLicense(licenseNumber) {
    return this.model.findOne({ licenseNumber: licenseNumber.trim(), deletedAt: null }).exec();
  }

  async findByRegistration(registrationNumber) {
    return this.model.findOne({
      registrationNumber: registrationNumber.trim(),
      deletedAt: null,
    }).exec();
  }

  async paginate(options = {}) {
    const filter = {};
    if (options.status) filter.status = options.status;
    if (typeof options.isActive === 'boolean') filter.isActive = options.isActive;
    if (options.branchId) filter.branches = options.branchId;
    if (options.departmentId) filter.departments = options.departmentId;
    if (options.specialization) {
      filter.specialization = new RegExp(options.specialization, 'i');
    }

    const searchFields = ['doctorCode', 'licenseNumber', 'registrationNumber', 'specialization', 'qualification'];
    // A doctor's actual name lives on the populated `userId` document, not on this collection,
    // so a plain text-field regex here can never match "Dr. Sharma". The caller (DoctorService)
    // resolves the search term against User first and hands back the matching doctor ids —
    // fold those in as an extra $or branch alongside the normal field search, rather than letting
    // paginateModel's own search handling silently overwrite it.
    let searchParam = options.search;
    if (options.nameMatchedIds?.length) {
      const orClauses = [{ _id: { $in: options.nameMatchedIds } }];
      const term = (options.search || '').trim();
      if (term) {
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        orClauses.push(...searchFields.map((field) => ({ [field]: regex })));
      }
      filter.$or = orClauses;
      searchParam = undefined; // already folded into filter.$or above
    }

    return paginateModel(this.model, {
      filter,
      page: options.page,
      limit: options.limit,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      search: searchParam,
      searchFields,
      allowedSort: [
        'createdAt',
        'updatedAt',
        'doctorCode',
        'specialization',
        'consultationFee',
        'experienceYears',
      ],
    });
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('userId', 'firstName lastName email phone profileImage role status isActive')
      .populate('departments', 'name code')
      .populate('services', 'name code durationMinutes price')
      .populate('branches', 'name displayName branchCode city')
      .exec();
  }
}

export default DoctorRepository;
