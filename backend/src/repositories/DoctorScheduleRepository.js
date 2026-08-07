import BaseRepository from './BaseRepository.js';
import DoctorSchedule from '../models/DoctorSchedule.model.js';

class DoctorScheduleRepository extends BaseRepository {
  constructor() {
    super(DoctorSchedule);
  }

  async findByDoctor(doctorId, { branchId = null } = {}) {
    const filter = { doctorId };
    if (branchId) filter.branchId = branchId;
    return this.model.find(filter).sort({ branchId: 1, dayOfWeek: 1 }).exec();
  }

  async findOneSlot(doctorId, branchId, dayOfWeek) {
    return this.model.findOne({ doctorId, branchId, dayOfWeek }).exec();
  }

  async upsertDay(doctorId, branchId, dayOfWeek, data) {
    return this.model
      .findOneAndUpdate(
        { doctorId, branchId, dayOfWeek },
        { $set: { ...data, doctorId, branchId, dayOfWeek } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
      .exec();
  }

  async deleteByDoctorAndBranch(doctorId, branchId) {
    return this.model.deleteMany({ doctorId, branchId }).exec();
  }

  async deleteByIdForDoctor(id, doctorId) {
    return this.model.findOneAndDelete({ _id: id, doctorId }).exec();
  }
}

export default DoctorScheduleRepository;
