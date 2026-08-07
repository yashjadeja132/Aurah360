import BaseRepository from './BaseRepository.js';
import BranchHoliday from '../models/BranchHoliday.model.js';

class BranchHolidayRepository extends BaseRepository {
  constructor() {
    super(BranchHoliday);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByBranch(branchId) {
    return this.model
      .find({ branchId, deletedAt: null })
      .sort({ date: 1 })
      .exec();
  }

  async findForDate(branchId, date) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    return this.model
      .find({
        branchId,
        deletedAt: null,
        $or: [
          { date: { $gte: day, $lte: end }, isRecurring: false },
          {
            isRecurring: true,
            $expr: {
              $and: [
                { $eq: [{ $month: '$date' }, day.getMonth() + 1] },
                { $eq: [{ $dayOfMonth: '$date' }, day.getDate()] },
              ],
            },
          },
        ],
      })
      .exec();
  }
}

export default BranchHolidayRepository;
