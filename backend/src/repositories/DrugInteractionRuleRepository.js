import BaseRepository from './BaseRepository.js';
import DrugInteractionRule from '../models/DrugInteractionRule.model.js';

class DrugInteractionRuleRepository extends BaseRepository {
  constructor() {
    super(DrugInteractionRule);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findActive() {
    return this.model.find({ deletedAt: null, isActive: true }).sort({ termA: 1, termB: 1 }).exec();
  }

  async countActive() {
    return this.model.countDocuments({ deletedAt: null, isActive: true }).exec();
  }

  async findAll({ limit = 200 } = {}) {
    return this.model.find({ deletedAt: null }).sort({ termA: 1, termB: 1 }).limit(limit).exec();
  }

  async findByTerms(termA, termB) {
    const a = (termA || '').trim().toLowerCase();
    const b = (termB || '').trim().toLowerCase();
    return this.model
      .findOne({
        deletedAt: null,
        $or: [
          { termA: a, termB: b },
          { termA: b, termB: a },
        ],
      })
      .exec();
  }
}

export default DrugInteractionRuleRepository;
