import BaseRepository from './BaseRepository.js';
import Branch from '../models/Branch.model.js';
import { paginateModel } from '../helpers/paginate.helper.js';

class BranchRepository extends BaseRepository {
  constructor() {
    super(Branch);
  }

  async findByCode(branchCode, { includeDeleted = false } = {}) {
    const filter = { branchCode: branchCode.toUpperCase().trim() };
    if (!includeDeleted) filter.deletedAt = null;
    return this.model.findOne(filter).exec();
  }

  async findByEmail(email, { includeDeleted = false } = {}) {
    const filter = { email: email.toLowerCase().trim() };
    if (!includeDeleted) filter.deletedAt = null;
    return this.model.findOne(filter).exec();
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async paginate(options = {}) {
    const filter = {};
    if (options.status) filter.status = options.status;
    if (typeof options.isActive === 'boolean') filter.isActive = options.isActive;
    if (options.city) filter.city = new RegExp(options.city, 'i');

    return paginateModel(this.model, {
      filter,
      page: options.page,
      limit: options.limit,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      search: options.search,
      searchFields: ['name', 'displayName', 'branchCode', 'email', 'phone', 'city'],
      allowedSort: [
        'createdAt',
        'updatedAt',
        'name',
        'displayName',
        'branchCode',
        'city',
        'status',
      ],
    });
  }
}

export default BranchRepository;
