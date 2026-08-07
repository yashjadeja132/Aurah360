/**
 * Base repository — thin MongoDB access layer.
 * Subclasses should not contain business rules.
 */
class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, options = {}) {
    let query = this.model.findById(id);
    if (options.select) query = query.select(options.select);
    if (options.lean) query = query.lean();
    return query.exec();
  }

  async findOne(filter = {}, options = {}) {
    let query = this.model.findOne(filter);
    if (options.select) query = query.select(options.select);
    if (options.lean) query = query.lean();
    return query.exec();
  }

  async findMany(filter = {}, options = {}) {
    let query = this.model.find(filter);
    if (options.select) query = query.select(options.select);
    if (options.sort) query = query.sort(options.sort);
    if (options.skip != null) query = query.skip(options.skip);
    if (options.limit != null) query = query.limit(options.limit);
    if (options.lean) query = query.lean();
    return query.exec();
  }

  async create(data) {
    return this.model.create(data);
  }

  async updateById(id, update, options = { new: true }) {
    return this.model.findByIdAndUpdate(id, update, options).exec();
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id).exec();
  }

  async count(filter = {}) {
    return this.model.countDocuments(filter).exec();
  }
}

export default BaseRepository;
