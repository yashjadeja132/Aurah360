import ApiError from '../libs/ApiError.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { ENTITY_STATUS, PAGINATION } from '../constants/index.js';
import { DEFAULT_WEEKLY } from '../models/Branch.model.js';
import OrganizationService from './OrganizationService.js';

class BranchService {
  constructor() {
    this.branchRepository = new BranchRepository();
    this.auditService = new AuditService();
    this.organizationService = new OrganizationService();
  }

  async #assertUniqueCode(branchCode, excludeId = null) {
    const existing = await this.branchRepository.findByCode(branchCode, { includeDeleted: true });
    if (existing && (!excludeId || existing._id.toString() !== excludeId.toString())) {
      if (!existing.deletedAt) throw ApiError.conflict('Branch code already in use');
    }
  }

  async #assertUniqueEmail(email, excludeId = null) {
    const existing = await this.branchRepository.findByEmail(email, { includeDeleted: true });
    if (existing && (!excludeId || existing._id.toString() !== excludeId.toString())) {
      if (!existing.deletedAt) throw ApiError.conflict('Branch email already in use');
    }
  }

  async create(payload, actorId, req = null) {
    await this.#assertUniqueCode(payload.branchCode);
    await this.#assertUniqueEmail(payload.email);

    const branch = await this.branchRepository.create({
      ...payload,
      branchCode: payload.branchCode.toUpperCase().trim(),
      email: payload.email.toLowerCase().trim(),
      settings: payload.settings || {
        workingDays: [1, 2, 3, 4, 5, 6],
        weeklySchedule: DEFAULT_WEEKLY,
        lunchBreak: { enabled: true, startTime: '13:00', endTime: '14:00' },
        timeSlotDurationMinutes: 15,
        appointmentBufferMinutes: 5,
        holidayCalendar: [],
        emergencyContact: {},
      },
      status: ENTITY_STATUS.ACTIVE,
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.BRANCH_CREATED, {
      actorId,
      metadata: { branchId: branch._id.toString(), branchCode: branch.branchCode },
      req,
    });

    return branch.toSafeObject();
  }

  /**
   * SEC-030 — a branch-scoped actor may only write to their OWN branch. Expressed as a lookup
   * so another branch's id answers 404, not 403.
   */
  async #findScoped(id, branchId) {
    if (branchId && String(id) !== String(branchId)) throw ApiError.notFound('Branch not found');
    const branch = await this.branchRepository.findByIdNotDeleted(id);
    if (!branch) throw ApiError.notFound('Branch not found');
    return branch;
  }

  async update(id, payload, actorId, req = null, { branchId = null } = {}) {
    const branch = await this.#findScoped(id, branchId);

    if (payload.branchCode && payload.branchCode !== branch.branchCode) {
      await this.#assertUniqueCode(payload.branchCode, id);
    }
    if (payload.email && payload.email !== branch.email) {
      await this.#assertUniqueEmail(payload.email, id);
    }

    // ORG-006 — a branch may only diverge from the organization on fields the organization has
    // opened for override (Organization.branchOverridableFields).
    await this.organizationService.assertBranchOverridesAllowed(Object.keys(payload || {}));

    const updates = { ...payload, updatedBy: actorId };
    if (updates.branchCode) updates.branchCode = updates.branchCode.toUpperCase().trim();
    if (updates.email) updates.email = updates.email.toLowerCase().trim();
    delete updates.settings; // use dedicated settings endpoint

    const updated = await this.branchRepository.updateById(id, updates);

    await this.auditService.record(AUDIT_ACTIONS.BRANCH_UPDATED, {
      actorId,
      metadata: { branchId: id, fields: Object.keys(payload) },
      req,
    });

    return updated.toSafeObject();
  }

  async updateSettings(id, settings, actorId, req = null, { branchId = null } = {}) {
    const branch = await this.#findScoped(id, branchId);

    // ORG-006 — the whole settings sub-document is one overridable unit ('settings'); a
    // holidayCalendar write additionally touches the branch-level 'holidayCalendar' field.
    const touched = ['settings'];
    if (settings?.holidayCalendar) touched.push('holidayCalendar');
    await this.organizationService.assertBranchOverridesAllowed(touched);

    const merged = {
      ...branch.settings?.toObject?.() || branch.settings || {},
      ...settings,
    };

    if (settings.holidayCalendar) {
      await this.branchRepository.updateById(id, {
        holidayCalendar: settings.holidayCalendar,
        'settings.holidayCalendar': settings.holidayCalendar,
        updatedBy: actorId,
      });
    }

    const updated = await this.branchRepository.updateById(id, {
      settings: merged,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.BRANCH_SETTINGS_UPDATED, {
      actorId,
      metadata: { branchId: id },
      req,
    });

    return updated.toSafeObject();
  }

  async getById(id) {
    const branch = await this.branchRepository.findByIdNotDeleted(id);
    if (!branch) throw ApiError.notFound('Branch not found');
    return branch.toSafeObject();
  }

  async list(query = {}) {
    const page = Number(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(Number(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    let isActive;
    if (query.isActive === 'true') isActive = true;
    if (query.isActive === 'false') isActive = false;

    const result = await this.branchRepository.paginate({
      page,
      limit,
      search: query.search,
      status: query.status,
      isActive,
      city: query.city,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: result.items.map((b) => b.toSafeObject()),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async activate(id, actorId, req = null, { branchId = null } = {}) {
    await this.#findScoped(id, branchId);

    const updated = await this.branchRepository.updateById(id, {
      isActive: true,
      status: ENTITY_STATUS.ACTIVE,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.BRANCH_ACTIVATED, {
      actorId,
      metadata: { branchId: id },
      req,
    });

    return updated.toSafeObject();
  }

  async deactivate(id, actorId, req = null, { branchId = null } = {}) {
    await this.#findScoped(id, branchId);

    const updated = await this.branchRepository.updateById(id, {
      isActive: false,
      status: ENTITY_STATUS.INACTIVE,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.BRANCH_DEACTIVATED, {
      actorId,
      metadata: { branchId: id },
      req,
    });

    return updated.toSafeObject();
  }

  async softDelete(id, actorId, req = null, { branchId = null } = {}) {
    const branch = await this.#findScoped(id, branchId);

    const updated = await this.branchRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      isActive: false,
      status: ENTITY_STATUS.INACTIVE,
      updatedBy: actorId,
      email: `deleted_${Date.now()}_${branch.email}`,
      branchCode: `DEL_${Date.now()}_${branch.branchCode}`.slice(0, 40),
    });

    await this.auditService.record(AUDIT_ACTIONS.BRANCH_SOFT_DELETED, {
      actorId,
      metadata: { branchId: id },
      req,
    });

    return updated.toSafeObject();
  }

  /**
   * ORG-005 — reassign a branch's future/active appointments and doctor privileges to another
   * branch without deleting history. Historical (past/completed/cancelled) appointments keep
   * their original branchId so reporting stays reconcilable.
   */
  async transferToBranch(fromBranchId, toBranchId, actorId, req = null, { branchId = null } = {}) {
    // Both ends must be in scope: moving data OUT of another branch is as much a cross-branch
    // write as moving it in.
    if (branchId) {
      await this.#findScoped(fromBranchId, branchId);
      await this.#findScoped(toBranchId, branchId);
    }
    if (fromBranchId === toBranchId) {
      throw ApiError.badRequest('Source and target branch must differ');
    }
    const [fromBranch, toBranch] = await Promise.all([
      this.branchRepository.findByIdNotDeleted(fromBranchId),
      this.branchRepository.findByIdNotDeleted(toBranchId),
    ]);
    if (!fromBranch) throw ApiError.notFound('Source branch not found');
    if (!toBranch) throw ApiError.notFound('Target branch not found');

    const Appointment = (await import('../models/Appointment.model.js')).default;
    const Doctor = (await import('../models/Doctor.model.js')).default;
    const { ACTIVE_APPOINTMENT_STATUSES } = await import('../enums/appointment.js');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointmentResult = await Appointment.updateMany(
      {
        branchId: fromBranchId,
        appointmentDate: { $gte: today },
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      },
      { $set: { branchId: toBranchId, updatedBy: actorId } }
    );

    const doctorResult = await Doctor.updateMany(
      { branches: fromBranchId },
      { $addToSet: { branches: toBranchId }, $pull: { branches: fromBranchId } }
    );

    await this.deactivate(fromBranchId, actorId, req);

    await this.auditService.record(AUDIT_ACTIONS.BRANCH_TRANSFERRED, {
      actorId,
      metadata: {
        fromBranchId,
        toBranchId,
        appointmentsMoved: appointmentResult.modifiedCount,
        doctorsReassigned: doctorResult.modifiedCount,
      },
      req,
    });

    return {
      fromBranchId,
      toBranchId,
      appointmentsMoved: appointmentResult.modifiedCount,
      doctorsReassigned: doctorResult.modifiedCount,
    };
  }
}

export default BranchService;
