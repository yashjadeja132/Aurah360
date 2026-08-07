import BaseRepository from './BaseRepository.js';
import Patient from '../models/Patient.model.js';
import { paginateModel } from '../helpers/paginate.helper.js';

class PatientRepository extends BaseRepository {
  constructor() {
    super(Patient);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByMrn(mrn) {
    return this.model.findOne({ mrn: mrn.toUpperCase().trim(), deletedAt: null }).exec();
  }

  async findByMobile(mobile) {
    return this.model.find({ mobile: mobile.trim(), deletedAt: null }).exec();
  }

  async findByEmail(email) {
    if (!email) return [];
    return this.model.find({ email: email.toLowerCase().trim(), deletedAt: null }).exec();
  }

  async findByNameAndDob(firstName, lastName, dateOfBirth) {
    if (!dateOfBirth) return [];
    const start = new Date(dateOfBirth);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateOfBirth);
    end.setHours(23, 59, 59, 999);

    return this.model
      .find({
        firstName: new RegExp(`^${firstName.trim()}$`, 'i'),
        lastName: new RegExp(`^${lastName.trim()}$`, 'i'),
        dateOfBirth: { $gte: start, $lte: end },
        deletedAt: null,
      })
      .exec();
  }

  async paginate(options = {}) {
    const filter = {};
    if (options.status) filter.status = options.status;
    if (typeof options.isActive === 'boolean') filter.isActive = options.isActive;
    if (typeof options.isVip === 'boolean') filter.isVip = options.isVip;
    if (options.gender) filter.gender = options.gender;
    if (options.primaryBranchId) filter.primaryBranchId = options.primaryBranchId;
    if (options.primaryDoctorId) filter.primaryDoctorId = options.primaryDoctorId;
    if (options.leadSourceId) filter.leadSourceId = options.leadSourceId;
    if (options.tag) filter.tags = options.tag;

    if (options.registeredFrom || options.registeredTo) {
      filter.registrationDate = {};
      if (options.registeredFrom) filter.registrationDate.$gte = new Date(options.registeredFrom);
      if (options.registeredTo) filter.registrationDate.$lte = new Date(options.registeredTo);
    }

    return paginateModel(this.model, {
      filter,
      page: options.page,
      limit: options.limit,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      search: options.search,
      searchFields: ['mrn', 'patientCode', 'firstName', 'lastName', 'middleName', 'mobile', 'email'],
      allowedSort: [
        'createdAt',
        'updatedAt',
        'registrationDate',
        'firstName',
        'lastName',
        'mrn',
        'mobile',
      ],
    });
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('primaryBranchId', 'name displayName branchCode city')
      .populate({
        path: 'primaryDoctorId',
        select: 'doctorCode specialization userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('leadSourceId', 'name code')
      .exec();
  }
}

export default PatientRepository;
