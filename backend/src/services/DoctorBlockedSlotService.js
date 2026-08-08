import ApiError from '../libs/ApiError.js';
import DoctorBlockedSlotRepository from '../repositories/DoctorBlockedSlotRepository.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

class DoctorBlockedSlotService {
  constructor() {
    this.blockedRepository = new DoctorBlockedSlotRepository();
    this.doctorRepository = new DoctorRepository();
    this.branchRepository = new BranchRepository();
    this.auditService = new AuditService();
  }

  async #assertDoctor(doctorId) {
    const doctor = await this.doctorRepository.findByIdNotDeleted(doctorId);
    if (!doctor) throw ApiError.notFound('Doctor not found');
    return doctor;
  }

  async list(doctorId, query = {}) {
    await this.#assertDoctor(doctorId);
    const rows = await this.blockedRepository.findByDoctor(doctorId, {
      from: query.from,
      to: query.to,
      branchId: query.branchId,
    });
    return rows.map((r) => r.toSafeObject());
  }

  /**
   * SEC-030 — `DoctorBlockedSlot.branchId` is NULLABLE and null means "blocked at every branch".
   * For a branch-scoped caller that is an organisation-wide write, so it is not theirs to make or
   * to edit: their blocks are pinned to their own branch, and a null-branch (or other-branch)
   * block reads as NOT FOUND rather than 403.
   */
  #assertInScope(row, scopeBranchId) {
    if (!scopeBranchId || !row) return row;
    if (String(row.branchId ?? '') !== String(scopeBranchId)) {
      throw ApiError.notFound('Blocked slot not found');
    }
    return row;
  }

  async create(payload, actorId, req = null, { branchId: scopeBranchId = null } = {}) {
    if (scopeBranchId) {
      if (payload.branchId && String(payload.branchId) !== String(scopeBranchId)) {
        throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
      }
      // An omitted branchId would otherwise persist as null = "blocked at EVERY branch", which is
      // an organisation-wide effect a branch-scoped user cannot authorise. Pin it to their branch.
      payload = { ...payload, branchId: scopeBranchId };
    }
    await this.#assertDoctor(payload.doctorId);
    if (payload.branchId) {
      const branch = await this.branchRepository.findByIdNotDeleted(payload.branchId);
      if (!branch) throw ApiError.badRequest('Invalid branch');
    }

    const startAt = new Date(payload.startAt);
    const endAt = new Date(payload.endAt);
    if (!(endAt > startAt)) throw ApiError.badRequest('endAt must be after startAt');

    const overlaps = await this.blockedRepository.findOverlapping(
      payload.doctorId,
      startAt,
      endAt,
      { branchId: payload.branchId || null }
    );
    if (overlaps.length) {
      throw ApiError.conflict('Blocked slot overlaps an existing block');
    }

    const row = await this.blockedRepository.create({
      ...payload,
      startAt,
      endAt,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.BLOCKED_SLOT_ADDED, {
      actorId,
      metadata: { blockedSlotId: row._id.toString(), doctorId: payload.doctorId },
      req,
    });

    return row.toSafeObject();
  }

  async update(id, payload, actorId, req = null, { branchId: scopeBranchId = null } = {}) {
    const existing = await this.blockedRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Blocked slot not found');
    this.#assertInScope(existing, scopeBranchId);
    if (scopeBranchId && payload.branchId && String(payload.branchId) !== String(scopeBranchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }

    const startAt = payload.startAt ? new Date(payload.startAt) : existing.startAt;
    const endAt = payload.endAt ? new Date(payload.endAt) : existing.endAt;
    if (!(endAt > startAt)) throw ApiError.badRequest('endAt must be after startAt');

    const overlaps = await this.blockedRepository.findOverlapping(
      existing.doctorId,
      startAt,
      endAt,
      { excludeId: id, branchId: payload.branchId ?? existing.branchId }
    );
    if (overlaps.length) {
      throw ApiError.conflict('Blocked slot overlaps an existing block');
    }

    const row = await this.blockedRepository.updateById(id, {
      ...payload,
      startAt,
      endAt,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.SCHEDULE_UPDATED, {
      actorId,
      metadata: { blockedSlotId: id, fields: Object.keys(payload) },
      req,
    });

    return row.toSafeObject();
  }

  async softDelete(id, actorId, req = null, { branchId: scopeBranchId = null } = {}) {
    const existing = await this.blockedRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Blocked slot not found');
    this.#assertInScope(existing, scopeBranchId);

    await this.blockedRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.BLOCKED_SLOT_REMOVED, {
      actorId,
      metadata: { blockedSlotId: id, doctorId: existing.doctorId.toString() },
      req,
    });

    return true;
  }
}

export default DoctorBlockedSlotService;
