import BaseRepository from './BaseRepository.js';
import Room from '../models/Room.model.js';

class RoomRepository extends BaseRepository {
  constructor() {
    super(Room);
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

export default RoomRepository;
