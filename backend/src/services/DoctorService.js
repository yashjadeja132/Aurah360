import ApiError from '../libs/ApiError.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import MasterRepository from '../repositories/MasterRepository.js';
import DoctorScheduleRepository from '../repositories/DoctorScheduleRepository.js';
import DoctorAvailabilityService from './DoctorAvailabilityService.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { ENTITY_STATUS, PAGINATION } from '../constants/index.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import { ROLES } from '../constants/roles.js';

class DoctorService {
  constructor() {
    this.doctorRepository = new DoctorRepository();
    this.userRepository = new UserRepository();
    this.branchRepository = new BranchRepository();
    this.masterRepository = new MasterRepository();
    this.scheduleRepository = new DoctorScheduleRepository();
    this.availabilityService = new DoctorAvailabilityService();
    this.auditService = new AuditService();
  }

  async #assertUniqueCodes(payload, excludeId = null) {
    if (payload.doctorCode) {
      const existing = await this.doctorRepository.findByCode(payload.doctorCode);
      if (existing && (!excludeId || existing._id.toString() !== excludeId.toString())) {
        throw ApiError.conflict('doctorCode already in use');
      }
    }
    if (payload.licenseNumber) {
      const existing = await this.doctorRepository.findByLicense(payload.licenseNumber);
      if (existing && (!excludeId || existing._id.toString() !== excludeId.toString())) {
        throw ApiError.conflict('licenseNumber already in use');
      }
    }
    if (payload.registrationNumber) {
      const existing = await this.doctorRepository.findByRegistration(payload.registrationNumber);
      if (existing && (!excludeId || existing._id.toString() !== excludeId.toString())) {
        throw ApiError.conflict('registrationNumber already in use');
      }
    }
  }

  async #assertUser(userId) {
    const user = await this.userRepository.findByIdNotDeleted(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.role !== ROLES.DOCTOR) {
      throw ApiError.badRequest('Linked user must have DOCTOR role');
    }
    return user;
  }

  async #assertBranches(branchIds = []) {
    for (const id of branchIds) {
      const branch = await this.branchRepository.findByIdNotDeleted(id);
      if (!branch) throw ApiError.badRequest(`Invalid branch: ${id}`);
    }
  }

  async #assertMasters(ids = [], type) {
    for (const id of ids) {
      const master = await this.masterRepository.findByIdNotDeleted(id);
      if (!master || master.type !== type) {
        throw ApiError.badRequest(`Invalid ${type}: ${id}`);
      }
    }
  }

  #mapDoctor(doc, user = null, availability = null) {
    const base = doc.toSafeObject({
      user: user
        ? {
            id: user._id?.toString?.() || user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            phone: user.phone,
            profileImage: user.profileImage,
          }
        : undefined,
      todayAvailability: availability,
    });

    if (doc.departments?.[0]?.name) {
      base.departmentNames = doc.departments.map((d) => d.name);
      base.departments = doc.departments.map((d) => d._id?.toString?.() || d.toString());
    }
    if (doc.services?.[0]?.name) {
      base.serviceNames = doc.services.map((s) => s.name);
      base.services = doc.services.map((s) => s._id?.toString?.() || s.toString());
    }
    if (doc.branches?.[0]?.displayName || doc.branches?.[0]?.name) {
      base.branchNames = doc.branches.map((b) => b.displayName || b.name);
      base.branches = doc.branches.map((b) => b._id?.toString?.() || b.toString());
    }
    if (doc.userId?.firstName) {
      base.user = {
        id: doc.userId._id.toString(),
        firstName: doc.userId.firstName,
        lastName: doc.userId.lastName,
        fullName: `${doc.userId.firstName} ${doc.userId.lastName}`.trim(),
        email: doc.userId.email,
        phone: doc.userId.phone,
        profileImage: doc.userId.profileImage,
      };
      base.userId = doc.userId._id.toString();
    }

    return base;
  }

  /**
   * SEC-030 — branch scoping for a doctor is SET MEMBERSHIP on `branches` (their privileges),
   * not equality on a single branch column. Folded into the lookup so a doctor who does not
   * practise at the caller's branch answers 404, never 403.
   */
  async #findScoped(id, branchId) {
    const filter = { _id: id, deletedAt: null };
    if (branchId) filter.branches = branchId;
    const doctor = await this.doctorRepository.model.findOne(filter).exec();
    if (!doctor) throw ApiError.notFound('Doctor not found');
    return doctor;
  }

  async create(payload, actorId, req = null, { branchId = null } = {}) {
    // A branch-scoped creator (BRANCH_MANAGER) may only grant privileges at their own branch.
    if (branchId) {
      if ((payload.branches || []).some((b) => String(b) !== String(branchId))) {
        throw ApiError.forbidden('branches is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
      }
      payload = { ...payload, branches: [branchId] };
    }
    await this.#assertUser(payload.userId);
    await this.#assertUniqueCodes(payload);

    const existingLink = await this.doctorRepository.findByUserId(payload.userId);
    if (existingLink) throw ApiError.conflict('User already has a doctor profile');

    await this.#assertBranches(payload.branches || []);
    await this.#assertMasters(payload.departments || [], MASTER_TYPES.DEPARTMENT);
    await this.#assertMasters(payload.services || [], MASTER_TYPES.SERVICE);

    const doctor = await this.doctorRepository.create({
      ...payload,
      doctorCode: payload.doctorCode.toUpperCase().trim(),
      licenseNumber: payload.licenseNumber.trim(),
      registrationNumber: payload.registrationNumber.trim(),
      status: ENTITY_STATUS.ACTIVE,
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_CREATED, {
      actorId,
      metadata: { doctorId: doctor._id.toString(), userId: payload.userId },
      req,
    });

    return this.getById(doctor._id);
  }

  async update(id, payload, actorId, req = null, { branchId = null } = {}) {
    await this.#findScoped(id, branchId);

    // A scoped editor cannot hand a doctor privileges at branches they do not manage.
    if (branchId && payload.branches
      && payload.branches.some((b) => String(b) !== String(branchId))) {
      throw ApiError.forbidden('branches is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }

    await this.#assertUniqueCodes(payload, id);

    if (payload.branches) await this.#assertBranches(payload.branches);
    if (payload.departments) {
      await this.#assertMasters(payload.departments, MASTER_TYPES.DEPARTMENT);
    }
    if (payload.services) {
      await this.#assertMasters(payload.services, MASTER_TYPES.SERVICE);
    }

    const updates = { ...payload, updatedBy: actorId };
    delete updates.userId; // immutable link
    if (updates.doctorCode) updates.doctorCode = updates.doctorCode.toUpperCase().trim();

    await this.doctorRepository.updateById(id, updates);

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_UPDATED, {
      actorId,
      metadata: { doctorId: id, fields: Object.keys(payload) },
      req,
    });

    return this.getById(id);
  }

  async getById(id) {
    const doctor = await this.doctorRepository.findByIdPopulated(id);
    if (!doctor) throw ApiError.notFound('Doctor not found');

    const availability = await this.availabilityService.getDayAvailability(
      id,
      new Date(),
      doctor.branches?.[0]?._id || doctor.branches?.[0] || null
    );

    return this.#mapDoctor(doctor, null, availability);
  }

  async list(query = {}) {
    const page = Number(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(Number(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    let isActive;
    if (query.isActive === 'true') isActive = true;
    if (query.isActive === 'false') isActive = false;

    const result = await this.doctorRepository.paginate({
      page,
      limit,
      search: query.search,
      status: query.status,
      isActive,
      branchId: query.branchId,
      departmentId: query.departmentId,
      specialization: query.specialization,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const items = [];
    for (const doc of result.items) {
      const populated = await this.doctorRepository.findByIdPopulated(doc._id);
      const branchId = populated?.branches?.[0]?._id || null;
      const availability = await this.availabilityService.getDayAvailability(
        doc._id,
        new Date(),
        branchId
      );
      items.push(this.#mapDoctor(populated || doc, null, availability));
    }

    return {
      items,
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

    await this.doctorRepository.updateById(id, {
      isActive: true,
      status: ENTITY_STATUS.ACTIVE,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_ACTIVATED, {
      actorId,
      metadata: { doctorId: id },
      req,
    });

    return this.getById(id);
  }

  async deactivate(id, actorId, req = null, { branchId = null } = {}) {
    await this.#findScoped(id, branchId);

    await this.doctorRepository.updateById(id, {
      isActive: false,
      status: ENTITY_STATUS.INACTIVE,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_DEACTIVATED, {
      actorId,
      metadata: { doctorId: id },
      req,
    });

    return this.getById(id);
  }

  async softDelete(id, actorId, req = null, { branchId = null } = {}) {
    const doctor = await this.#findScoped(id, branchId);

    await this.doctorRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      isActive: false,
      status: ENTITY_STATUS.INACTIVE,
      updatedBy: actorId,
      doctorCode: `DEL_${Date.now()}_${doctor.doctorCode}`.slice(0, 40),
      licenseNumber: `DEL_${Date.now()}_${doctor.licenseNumber}`.slice(0, 60),
      registrationNumber: `DEL_${Date.now()}_${doctor.registrationNumber}`.slice(0, 60),
    });

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_SOFT_DELETED, {
      actorId,
      metadata: { doctorId: id },
      req,
    });

    return true;
  }

  /** For Appointment module */
  getAvailabilityService() {
    return this.availabilityService;
  }
}

export default DoctorService;
