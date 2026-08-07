import BaseRepository from './BaseRepository.js';
import DoctorLeave from '../models/DoctorLeave.model.js';

class DoctorLeaveRepository extends BaseRepository {
  constructor() {
    super(DoctorLeave);
  }

  async findByDoctor(doctorId, { includeDeleted = false } = {}) {
    const filter = { doctorId };
    if (!includeDeleted) filter.deletedAt = null;
    return this.model.find(filter).sort({ startDate: -1 }).exec();
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findActiveAround(doctorId, startDate, endDate) {
    return this.model
      .find({
        doctorId,
        deletedAt: null,
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      })
      .exec();
  }
}

export default DoctorLeaveRepository;
