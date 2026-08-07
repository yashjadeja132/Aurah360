import BaseRepository from './BaseRepository.js';
import Permission from '../models/Permission.model.js';

class PermissionRepository extends BaseRepository {
  constructor() {
    super(Permission);
  }

  async findByKey(key) {
    return this.model.findOne({ key }).exec();
  }

  async findAllGrouped() {
    return this.model.find({}).sort({ module: 1, key: 1 }).exec();
  }

  async upsertByKey(key, data) {
    return this.model
      .findOneAndUpdate(
        { key },
        { $set: data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
      .exec();
  }
}

export default PermissionRepository;
