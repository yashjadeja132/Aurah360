import BaseRepository from './BaseRepository.js';
import Medicine from '../models/Medicine.model.js';
import { paginateModel } from '../helpers/paginate.helper.js';

class MedicineRepository extends BaseRepository {
  constructor() {
    super(Medicine);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async search(q, { limit = 20 } = {}) {
    const filter = { deletedAt: null, isActive: true };
    if (q?.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: regex },
        { genericName: regex },
        { brand: regex },
        { medicineCode: regex },
      ];
    }
    return this.model.find(filter).sort({ name: 1 }).limit(limit).exec();
  }

  async paginate(options = {}) {
    const filter = {};
    if (options.isActive != null) filter.isActive = options.isActive === true || options.isActive === 'true';
    if (options.category) filter.category = options.category;
    return paginateModel(this.model, {
      filter,
      page: options.page,
      limit: options.limit,
      sortBy: options.sortBy || 'name',
      sortOrder: options.sortOrder || 'asc',
      search: options.search,
      searchFields: ['name', 'genericName', 'brand', 'medicineCode', 'manufacturer'],
      allowedSort: ['name', 'medicineCode', 'createdAt', 'mrp'],
    });
  }
}

export default MedicineRepository;
