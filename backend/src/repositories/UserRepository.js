import BaseRepository from './BaseRepository.js';
import User from '../models/User.model.js';
import { USER_STATUS } from '../enums/userStatus.js';

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email, { withPassword = false, includeDeleted = false } = {}) {
    const filter = { email: email.toLowerCase().trim() };
    if (!includeDeleted) filter.deletedAt = null;

    let query = this.model.findOne(filter);
    if (withPassword) query = query.select('+passwordHash');
    return query.exec();
  }

  async findActiveById(id) {
    return this.model
      .findOne({
        _id: id,
        isActive: true,
        status: USER_STATUS.ACTIVE,
        deletedAt: null,
      })
      .exec();
  }

  async findByIdNotDeleted(id, options = {}) {
    let query = this.model.findOne({ _id: id, deletedAt: null });
    if (options.select) query = query.select(options.select);
    if (options.lean) query = query.lean();
    return query.exec();
  }

  async findByEmployeeId(employeeId) {
    if (!employeeId) return null;
    return this.model.findOne({ employeeId, deletedAt: null }).exec();
  }

  /**
   * Paginated staff list with search / filters / sort.
   */
  async paginate({
    page = 1,
    limit = 20,
    search,
    role,
    status,
    isActive,
    branch,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const filter = { deletedAt: null };

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (branch) filter.branch = branch;

    if (search?.trim()) {
      const term = search.trim();
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
        { employeeId: regex },
        { designation: regex },
      ];
    }

    const allowedSort = new Set([
      'createdAt',
      'updatedAt',
      'firstName',
      'lastName',
      'email',
      'role',
      'status',
      'lastLogin',
    ]);
    const sortField = allowedSort.has(sortBy) ? sortBy : 'createdAt';
    const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export default UserRepository;
