import BaseRepository from './BaseRepository.js';
import Device from '../models/Device.model.js';

class DeviceRepository extends BaseRepository {
  constructor() {
    super(Device);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findManyNotDeleted(filter = {}, options = {}) {
    return this.findMany({ ...filter, deletedAt: null }, options);
  }

  async countNotDeleted(filter = {}) {
    return this.count({ ...filter, deletedAt: null });
  }
}

export default DeviceRepository;
