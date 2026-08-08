import ApiError from '../libs/ApiError.js';
import DoctorSpecialScheduleRepository from '../repositories/DoctorSpecialScheduleRepository.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import {
  validateLunch,
  validateSlotDuration,
  validateWorkingHours,
} from '../helpers/scheduling.utils.js';

class DoctorSpecialScheduleService {
  constructor() {
    this.specialRepository = new DoctorSpecialScheduleRepository();
    this.doctorRepository = new DoctorRepository();
    this.branchRepository = new BranchRepository();
    this.auditService = new AuditService();
  }

  #validateHours(payload) {
    if (payload.isWorking === false) return;
    const hours = validateWorkingHours(payload.startTime, payload.endTime);
    if (!hours.ok) throw ApiError.badRequest(hours.message);
    const lunch = validateLunch(
      payload.startTime,
      payload.endTime,
      payload.lunchStart,
      payload.lunchEnd
    );
    if (!lunch.ok) throw ApiError.badRequest(lunch.message);
    if (payload.slotDuration != null) {
      const dur = validateSlotDuration(payload.slotDuration);
      if (!dur.ok) throw ApiError.badRequest(dur.message);
    }
  }

  async list(doctorId, query = {}) {
    const doctor = await this.doctorRepository.findByIdNotDeleted(doctorId);
    if (!doctor) throw ApiError.notFound('Doctor not found');
    const rows = await this.specialRepository.findByDoctor(doctorId, query);
    return rows.map((r) => r.toSafeObject());
  }

  /** SEC-030 — another branch's special schedule reads as NOT FOUND, never 403. */
  #assertInScope(row, scopeBranchId) {
    if (!scopeBranchId || !row) return row;
    if (String(row.branchId) !== String(scopeBranchId)) {
      throw ApiError.notFound('Special schedule not found');
    }
    return row;
  }

  async upsert(payload, actorId, req = null, { branchId: scopeBranchId = null } = {}) {
    if (scopeBranchId && String(payload.branchId) !== String(scopeBranchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    const doctor = await this.doctorRepository.findByIdNotDeleted(payload.doctorId);
    if (!doctor) throw ApiError.notFound('Doctor not found');
    const branch = await this.branchRepository.findByIdNotDeleted(payload.branchId);
    if (!branch) throw ApiError.badRequest('Invalid branch');

    this.#validateHours(payload);

    const day = startOfDay(payload.date);
    const existing = (
      await this.specialRepository.findForDate(payload.doctorId, day, payload.branchId)
    )[0];

    let row;
    if (existing) {
      row = await this.specialRepository.updateById(existing._id, {
        ...payload,
        date: day,
        updatedBy: actorId,
      });
    } else {
      row = await this.specialRepository.create({
        ...payload,
        date: day,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    await this.auditService.record(AUDIT_ACTIONS.SCHEDULE_UPDATED, {
      actorId,
      metadata: {
        specialScheduleId: row._id.toString(),
        doctorId: payload.doctorId,
        date: day.toISOString(),
      },
      req,
    });

    return row.toSafeObject();
  }

  async softDelete(id, actorId, req = null, { branchId: scopeBranchId = null } = {}) {
    const existing = await this.specialRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Special schedule not found');
    this.#assertInScope(existing, scopeBranchId);

    await this.specialRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.SCHEDULE_UPDATED, {
      actorId,
      metadata: { specialScheduleId: id, action: 'removed' },
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

export default DoctorSpecialScheduleService;
