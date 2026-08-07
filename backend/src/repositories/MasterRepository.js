import BaseRepository from './BaseRepository.js';
import Master from '../models/Master.model.js';
import { paginateModel } from '../helpers/paginate.helper.js';

class MasterRepository extends BaseRepository {
  constructor() {
    super(Master);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByTypeAndName(type, name, { excludeId = null } = {}) {
    const filter = {
      type,
      name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      deletedAt: null,
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.findOne(filter).exec();
  }

  async findByTypeAndCode(type, code, { excludeId = null } = {}) {
    if (!code) return null;
    const filter = {
      type,
      code: code.toUpperCase().trim(),
      deletedAt: null,
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.findOne(filter).exec();
  }

  async listActiveByType(type) {
    return this.model
      .find({ type, deletedAt: null, isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async paginateByType(type, options = {}) {
    const filter = { type };
    if (options.status) filter.status = options.status;
    if (typeof options.isActive === 'boolean') filter.isActive = options.isActive;
    if (options.categoryId) filter.categoryId = options.categoryId;

    return paginateModel(this.model, {
      filter,
      page: options.page,
      limit: options.limit,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      search: options.search,
      searchFields: ['name', 'code', 'description'],
      allowedSort: ['createdAt', 'updatedAt', 'name', 'code', 'sortOrder', 'price', 'status'],
    });
  }
}

export default MasterRepository;
