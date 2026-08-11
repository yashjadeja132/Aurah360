import BaseRepository from './BaseRepository.js';
import StaffLeave from '../models/StaffLeave.model.js';

class StaffLeaveRepository extends BaseRepository {
  constructor() {
    super(StaffLeave);
  }

  async findByUser(userId, { includeDeleted = false } = {}) {
    const filter = { userId };
    if (!includeDeleted) filter.deletedAt = null;
    return this.model.find(filter).sort({ startDate: -1 }).exec();
  }

  async findActiveOn(userIds, date) {
    return this.model
      .find({
        userId: { $in: userIds },
        deletedAt: null,
        startDate: { $lte: date },
        endDate: { $gte: date },
      })
      .exec();
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }
}

export default StaffLeaveRepository;
