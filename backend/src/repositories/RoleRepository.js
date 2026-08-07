import BaseRepository from './BaseRepository.js';
import Role from '../models/Role.model.js';

class RoleRepository extends BaseRepository {
  constructor() {
    super(Role);
  }

  async findByCode(code) {
    return this.model.findOne({ code: code.toUpperCase() }).exec();
  }

  async findAllActive() {
    return this.model.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  async upsertByCode(code, data) {
    return this.model
      .findOneAndUpdate(
        { code },
        { $set: data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
      .exec();
  }
}

export default RoleRepository;
