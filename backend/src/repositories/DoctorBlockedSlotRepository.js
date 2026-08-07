import BaseRepository from './BaseRepository.js';
import DoctorBlockedSlot from '../models/DoctorBlockedSlot.model.js';

class DoctorBlockedSlotRepository extends BaseRepository {
  constructor() {
    super(DoctorBlockedSlot);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByDoctor(doctorId, { from = null, to = null, branchId = null } = {}) {
    const filter = { doctorId, deletedAt: null };

    if (branchId) {
      filter.$or = [{ branchId }, { branchId: null }];
    }

    if (from || to) {
      const range = [];
      if (from) range.push({ endAt: { $gt: new Date(from) } });
      if (to) range.push({ startAt: { $lt: new Date(to) } });
      filter.$and = [...(filter.$and || []), ...range];
    }

    return this.model.find(filter).sort({ startAt: 1 }).exec();
  }

  async findOverlapping(doctorId, startAt, endAt, { excludeId = null, branchId = null } = {}) {
    const filter = {
      doctorId,
      deletedAt: null,
      startAt: { $lt: new Date(endAt) },
      endAt: { $gt: new Date(startAt) },
    };
    if (excludeId) filter._id = { $ne: excludeId };
    if (branchId) {
      filter.$or = [{ branchId }, { branchId: null }];
    }
    return this.model.find(filter).exec();
  }
}

export default DoctorBlockedSlotRepository;
