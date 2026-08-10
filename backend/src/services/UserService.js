import ApiError from '../libs/ApiError.js';
import UserRepository from '../repositories/UserRepository.js';
import RefreshTokenRepository from '../repositories/RefreshTokenRepository.js';
import RoleService from './RoleService.js';
import AuditService from './AuditService.js';
import { hashPassword, comparePassword } from '../helpers/crypto.helper.js';
import { USER_STATUS } from '../enums/userStatus.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { ROLES } from '../constants/roles.js';
import { PAGINATION } from '../constants/index.js';

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
    this.refreshTokenRepository = new RefreshTokenRepository();
    this.roleService = new RoleService();
    this.auditService = new AuditService();
  }

  async #assertUniqueEmail(email, excludeId = null) {
    const existing = await this.userRepository.findByEmail(email, { includeDeleted: true });
    if (existing && (!excludeId || existing._id.toString() !== excludeId.toString())) {
      throw ApiError.conflict('Email already in use');
    }
  }

  async #assertUniqueEmployeeId(employeeId, excludeId = null) {
    if (!employeeId) return;
    const existing = await this.userRepository.findByEmployeeId(employeeId);
    if (existing && (!excludeId || existing._id.toString() !== excludeId.toString())) {
      throw ApiError.conflict('Employee ID already in use');
    }
  }

  /**
   * SEC-030 — the branch filter is part of the LOOKUP, so a staff member at another branch is
   * indistinguishable from one that does not exist: 404, never 403. Note the field is
   * `User.branch` (a single Branch ref), which is what the helper's `branchId` maps onto.
   */
  async #findScopedStaff(userId, branchId) {
    const filter = { _id: userId, deletedAt: null };
    if (branchId) filter.branch = branchId;
    const user = await this.userRepository.model.findOne(filter).exec();
    if (!user) throw ApiError.notFound('Staff user not found');
    return user;
  }

  async createStaff(payload, actorId, req = null, { branchId = null } = {}) {
    // A branch-scoped creator hires into their OWN branch — 403 rather than 404 because the
    // caller named a branch id, not a record id.
    if (branchId && payload.branch && String(payload.branch) !== String(branchId)) {
      throw ApiError.forbidden('branch is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    if (branchId) payload = { ...payload, branch: branchId };
    await this.#assertUniqueEmail(payload.email);
    await this.#assertUniqueEmployeeId(payload.employeeId);

    if (payload.role === ROLES.OWNER) {
      throw ApiError.forbidden('Cannot create another Owner via staff API');
    }

    const roleDoc = await this.roleService.getByCode(payload.role);
    const passwordHash = await hashPassword(payload.password);

    const user = await this.userRepository.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone || null,
      passwordHash,
      role: payload.role,
      roleId: roleDoc._id,
      permissions: payload.permissions || [],
      branch: payload.branch || null,
      department: payload.department || null,
      designation: payload.designation || null,
      employeeId: payload.employeeId || null,
      profileImage: payload.profileImage || null,
      gender: payload.gender || null,
      dob: payload.dob || null,
      status: USER_STATUS.ACTIVE,
      isActive: true,
      mustChangePassword: payload.mustChangePassword ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.USER_CREATED, {
      actorId,
      targetUserId: user._id,
      metadata: { email: user.email, role: user.role },
      req,
    });

    return user.toSafeObject();
  }

  async updateStaff(userId, payload, actorId, req = null, { branchId = null } = {}) {
    const user = await this.#findScopedStaff(userId, branchId);
    // A scoped editor cannot post a staff member out of their reach into another branch.
    if (branchId && payload.branch && String(payload.branch) !== String(branchId)) {
      throw ApiError.forbidden('branch is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }

    if (user.role === ROLES.OWNER && actorId.toString() !== user._id.toString()) {
      const actor = await this.userRepository.findById(actorId);
      if (actor?.role !== ROLES.OWNER) {
        throw ApiError.forbidden('Only Owner can update Owner profile fields');
      }
    }

    if (payload.email && payload.email !== user.email) {
      await this.#assertUniqueEmail(payload.email, userId);
    }
    if (payload.employeeId !== undefined) {
      await this.#assertUniqueEmployeeId(payload.employeeId, userId);
    }

    const previousRole = user.role;
    const updates = {
      updatedBy: actorId,
    };

    const assignable = [
      'firstName', 'lastName', 'email', 'phone', 'department', 'designation',
      'employeeId', 'profileImage', 'gender', 'dob', 'branch', 'permissions',
    ];

    assignable.forEach((key) => {
      if (payload[key] !== undefined) updates[key] = payload[key];
    });

    if (payload.role && payload.role !== user.role) {
      if (payload.role === ROLES.OWNER) {
        throw ApiError.forbidden('Cannot assign Owner role via staff API');
      }
      if (user.role === ROLES.OWNER) {
        throw ApiError.forbidden('Cannot change Owner role');
      }
      const roleDoc = await this.roleService.getByCode(payload.role);
      updates.role = payload.role;
      updates.roleId = roleDoc._id;
    }

    const updated = await this.userRepository.updateById(userId, updates);

    await this.auditService.record(AUDIT_ACTIONS.USER_UPDATED, {
      actorId,
      targetUserId: userId,
      metadata: { fields: Object.keys(payload) },
      req,
    });

    if (updates.role && updates.role !== previousRole) {
      await this.auditService.record(AUDIT_ACTIONS.ROLE_CHANGED, {
        actorId,
        targetUserId: userId,
        metadata: { from: previousRole, to: updates.role },
        req,
      });
    }

    return updated.toSafeObject();
  }

  async getStaffById(userId, { branchId = null } = {}) {
    const user = await this.#findScopedStaff(userId, branchId);
    const permissions = await this.roleService.getEffectivePermissions(
      user.role,
      user.permissions || []
    );
    return user.toSafeObject({
      permissions: user.role === ROLES.OWNER ? ['*'] : permissions,
    });
  }

  async listStaff(query, { branchId = null } = {}) {
    const page = Number(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(Number(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    let isActive;
    if (query.isActive === 'true') isActive = true;
    if (query.isActive === 'false') isActive = false;

    const result = await this.userRepository.paginate({
      page,
      limit,
      search: query.search,
      role: query.role,
      status: query.status,
      isActive,
      // SEC-030 — the caller's pinned branch wins over anything they typed; null (OWNER/ADMIN)
      // falls through to whatever branch they chose to filter by, or no filter at all.
      branch: branchId || query.branch,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: result.items.map((u) => u.toSafeObject()),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async activateStaff(userId, actorId, req = null, { branchId = null } = {}) {
    const user = await this.#findScopedStaff(userId, branchId);
    if (user.role === ROLES.OWNER) throw ApiError.forbidden('Owner cannot be deactivated/activated this way');

    const updated = await this.userRepository.updateById(userId, {
      isActive: true,
      status: USER_STATUS.ACTIVE,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.USER_ACTIVATED, {
      actorId,
      targetUserId: userId,
      req,
    });

    return updated.toSafeObject();
  }

  async deactivateStaff(userId, actorId, req = null, { branchId = null } = {}) {
    const user = await this.#findScopedStaff(userId, branchId);
    if (user.role === ROLES.OWNER) throw ApiError.forbidden('Owner cannot be deactivated');
    if (userId.toString() === actorId.toString()) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    const updated = await this.userRepository.updateById(userId, {
      isActive: false,
      status: USER_STATUS.INACTIVE,
      updatedBy: actorId,
    });

    await this.refreshTokenRepository.revokeAllForUser(userId);

    await this.auditService.record(AUDIT_ACTIONS.USER_DEACTIVATED, {
      actorId,
      targetUserId: userId,
      req,
    });

    return updated.toSafeObject();
  }

  async softDeleteStaff(userId, actorId, req = null, { branchId = null } = {}) {
    const user = await this.#findScopedStaff(userId, branchId);
    if (user.role === ROLES.OWNER) throw ApiError.forbidden('Owner cannot be deleted');
    if (userId.toString() === actorId.toString()) {
      throw ApiError.badRequest('You cannot delete your own account');
    }

    const updated = await this.userRepository.updateById(userId, {
      deletedAt: new Date(),
      deletedBy: actorId,
      isActive: false,
      status: USER_STATUS.INACTIVE,
      updatedBy: actorId,
      email: `deleted_${Date.now()}_${user.email}`,
    });

    await this.refreshTokenRepository.revokeAllForUser(userId);

    await this.auditService.record(AUDIT_ACTIONS.USER_SOFT_DELETED, {
      actorId,
      targetUserId: userId,
      req,
    });

    return updated.toSafeObject();
  }

  async adminResetPassword(userId, newPassword, actorId, req = null, { branchId = null } = {}) {
    // The sharpest of the staff writes: unscoped, a branch manager could reset the password of
    // any account in the organisation and then sign in as them.
    await this.#findScopedStaff(userId, branchId);

    const passwordHash = await hashPassword(newPassword);
    await this.userRepository.updateById(userId, {
      passwordHash,
      mustChangePassword: true,
      updatedBy: actorId,
    });

    await this.refreshTokenRepository.revokeAllForUser(userId);

    await this.auditService.record(AUDIT_ACTIONS.PASSWORD_RESET, {
      actorId,
      targetUserId: userId,
      req,
    });

    return true;
  }

  async changePassword(userId, { currentPassword, newPassword }, req = null) {
    const user = await this.userRepository.findById(userId, { select: '+passwordHash' });
    if (!user || user.deletedAt) throw ApiError.notFound('User not found');

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw ApiError.unauthorized('Current password is incorrect');

    const passwordHash = await hashPassword(newPassword);
    await this.userRepository.updateById(userId, {
      passwordHash,
      mustChangePassword: false,
      updatedBy: userId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PASSWORD_CHANGED, {
      actorId: userId,
      targetUserId: userId,
      req,
    });

    return true;
  }

  async updateProfile(userId, payload, req = null) {
    const allowed = ['firstName', 'lastName', 'phone', 'profileImage', 'gender', 'dob'];
    const updates = { updatedBy: userId };
    allowed.forEach((key) => {
      if (payload[key] !== undefined) updates[key] = payload[key];
    });

    const updated = await this.userRepository.updateById(userId, updates);
    if (!updated || updated.deletedAt) throw ApiError.notFound('User not found');

    await this.auditService.record(AUDIT_ACTIONS.USER_UPDATED, {
      actorId: userId,
      targetUserId: userId,
      metadata: { selfProfile: true, fields: Object.keys(payload) },
      req,
    });

    return updated.toSafeObject();
  }
}

export default UserService;
