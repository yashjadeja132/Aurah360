import BaseRepository from './BaseRepository.js';
import StaffSkill from '../models/StaffSkill.model.js';

class StaffSkillRepository extends BaseRepository {
  constructor() {
    super(StaffSkill);
  }

  async findForUser(userId) {
    return this.model.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async findValidSkill(userId, skillCode, branchId = null) {
    const filter = { userId, skillCode, status: 'ACTIVE' };
    if (branchId) filter.$or = [{ branchId }, { branchId: null }];
    return this.model.findOne(filter).sort({ branchId: -1 }).exec();
  }
}

export default StaffSkillRepository;
