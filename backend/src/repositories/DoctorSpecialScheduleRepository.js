import BaseRepository from './BaseRepository.js';
import DoctorSpecialSchedule from '../models/DoctorSpecialSchedule.model.js';

class DoctorSpecialScheduleRepository extends BaseRepository {
  constructor() {
    super(DoctorSpecialSchedule);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByDoctor(doctorId, { branchId = null, from = null, to = null } = {}) {
    const filter = { doctorId, deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = startOfDay(from);
      if (to) filter.date.$lte = endOfDay(to);
    }
    return this.model.find(filter).sort({ date: 1 }).exec();
  }

  async findForDate(doctorId, date, branchId = null) {
    const day = startOfDay(date);
    const end = endOfDay(date);
    const filter = {
      doctorId,
      deletedAt: null,
      date: { $gte: day, $lte: end },
    };
    if (branchId) filter.branchId = branchId;
    return this.model.find(filter).exec();
  }
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default DoctorSpecialScheduleRepository;
