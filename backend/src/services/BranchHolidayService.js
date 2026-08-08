import ApiError from '../libs/ApiError.js';
import BranchHolidayRepository from '../repositories/BranchHolidayRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

class BranchHolidayService {
  constructor() {
    this.holidayRepository = new BranchHolidayRepository();
    this.branchRepository = new BranchRepository();
    this.auditService = new AuditService();
  }

  async #assertBranch(branchId) {
    const branch = await this.branchRepository.findByIdNotDeleted(branchId);
    if (!branch) throw ApiError.badRequest('Invalid branch');
    return branch;
  }

  /**
   * SEC-030 — single-record branch gate. `scopeBranchId` is the caller's resolved branch, or null
   * for OWNER/ADMIN. Another branch's holiday reads as NOT FOUND, never 403.
   */
  #assertInScope(holiday, scopeBranchId) {
    if (!scopeBranchId || !holiday) return holiday;
    if (String(holiday.branchId) !== String(scopeBranchId)) {
      throw ApiError.notFound('Holiday not found');
    }
    return holiday;
  }

  #assertWriteBranch(payloadBranchId, scopeBranchId) {
    if (scopeBranchId && String(payloadBranchId) !== String(scopeBranchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
  }

  async list(branchId) {
    await this.#assertBranch(branchId);
    const rows = await this.holidayRepository.findByBranch(branchId);
    return rows.map((r) => r.toSafeObject());
  }

  async create(payload, actorId, req = null, { branchId: scopeBranchId = null } = {}) {
    this.#assertWriteBranch(payload.branchId, scopeBranchId);
    await this.#assertBranch(payload.branchId);
    const holiday = await this.holidayRepository.create({
      ...payload,
      date: startOfDay(payload.date),
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.HOLIDAY_ADDED, {
      actorId,
      metadata: { holidayId: holiday._id.toString(), branchId: payload.branchId },
      req,
    });

    return holiday.toSafeObject();
  }

  async update(id, payload, actorId, req = null, { branchId: scopeBranchId = null } = {}) {
    const existing = await this.holidayRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Holiday not found');
    this.#assertInScope(existing, scopeBranchId);

    if (payload.branchId) {
      // A scoped caller may not move a holiday out of their own branch either.
      this.#assertWriteBranch(payload.branchId, scopeBranchId);
      await this.#assertBranch(payload.branchId);
    }
    const updates = { ...payload, updatedBy: actorId };
    if (updates.date) updates.date = startOfDay(updates.date);

    const holiday = await this.holidayRepository.updateById(id, updates);

    await this.auditService.record(AUDIT_ACTIONS.SCHEDULE_UPDATED, {
      actorId,
      metadata: { holidayId: id, fields: Object.keys(payload) },
      req,
    });

    return holiday.toSafeObject();
  }

  async softDelete(id, actorId, req = null, { branchId: scopeBranchId = null } = {}) {
    const existing = await this.holidayRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Holiday not found');
    this.#assertInScope(existing, scopeBranchId);

    await this.holidayRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.HOLIDAY_REMOVED, {
      actorId,
      metadata: { holidayId: id, branchId: existing.branchId.toString() },
      req,
    });

    return true;
  }
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default BranchHolidayService;
