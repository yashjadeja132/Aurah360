import ApiError from '../libs/ApiError.js';
import MasterRepository from '../repositories/MasterRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { ENTITY_STATUS, PAGINATION } from '../constants/index.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import Appointment from '../models/Appointment.model.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import { ACTIVE_APPOINTMENT_STATUSES } from '../enums/appointment.js';
import { TREATMENT_PLAN_STATUS } from '../enums/treatmentPlan.js';

/** Plan statuses that still represent a live commitment to deliver a service. */
const NON_TERMINAL_TREATMENT_PLAN_STATUSES = [
  TREATMENT_PLAN_STATUS.DRAFT,
  TREATMENT_PLAN_STATUS.RECOMMENDED,
  TREATMENT_PLAN_STATUS.APPROVED,
  TREATMENT_PLAN_STATUS.ACCEPTED,
];

/**
 * Generic master CRUD — one service for all master types.
 */
class MasterService {
  constructor() {
    this.masterRepository = new MasterRepository();
    this.auditService = new AuditService();
  }

  async #assertUniqueName(type, name, excludeId = null) {
    const existing = await this.masterRepository.findByTypeAndName(type, name, { excludeId });
    if (existing) throw ApiError.conflict(`${type} name already exists`);
  }

  async #assertUniqueCode(type, code, excludeId = null) {
    if (!code) return;
    const existing = await this.masterRepository.findByTypeAndCode(type, code, { excludeId });
    if (existing) throw ApiError.conflict(`${type} code already exists`);
  }

  async #validateServiceCategory(categoryId) {
    if (!categoryId) throw ApiError.badRequest('Service category is required');
    const category = await this.masterRepository.findByIdNotDeleted(categoryId);
    if (!category || category.type !== MASTER_TYPES.SERVICE_CATEGORY) {
      throw ApiError.badRequest('Invalid service category');
    }
    return category;
  }

  async create(type, payload, actorId, req = null) {
    await this.#assertUniqueName(type, payload.name);
    await this.#assertUniqueCode(type, payload.code);

    const data = {
      type,
      name: payload.name.trim(),
      code: payload.code ? payload.code.toUpperCase().trim() : null,
      description: payload.description || null,
      sortOrder: payload.sortOrder ?? 0,
      color: payload.color || null,
      metadata: payload.metadata || {},
      effectiveFrom: payload.effectiveFrom || null,
      effectiveTo: payload.effectiveTo || null,
      status: ENTITY_STATUS.ACTIVE,
      isActive: true,
      isSystem: payload.isSystem ?? false,
      createdBy: actorId,
      updatedBy: actorId,
    };

    if (type === MASTER_TYPES.SERVICE) {
      await this.#validateServiceCategory(payload.categoryId);
      data.categoryId = payload.categoryId;
      data.durationMinutes = payload.durationMinutes ?? 30;
      data.price = payload.price ?? 0;
    }

    const master = await this.masterRepository.create(data);

    await this.auditService.record(AUDIT_ACTIONS.MASTER_CREATED, {
      actorId,
      metadata: { masterId: master._id.toString(), type, name: master.name, after: data },
      req,
      resourceType: 'Master',
      resourceId: master._id.toString(),
    });

    return master.toSafeObject();
  }

  async update(type, id, payload, actorId, req = null) {
    const master = await this.masterRepository.findByIdNotDeleted(id);
    if (!master || master.type !== type) throw ApiError.notFound('Master record not found');

    if (payload.name && payload.name !== master.name) {
      await this.#assertUniqueName(type, payload.name, id);
    }
    if (payload.code !== undefined && payload.code !== master.code) {
      await this.#assertUniqueCode(type, payload.code, id);
    }

    const updates = { updatedBy: actorId };
    ['name', 'description', 'sortOrder', 'color', 'metadata', 'effectiveFrom', 'effectiveTo'].forEach((key) => {
      if (payload[key] !== undefined) updates[key] = payload[key];
    });
    if (payload.code !== undefined) {
      updates.code = payload.code ? payload.code.toUpperCase().trim() : null;
    }

    if (type === MASTER_TYPES.SERVICE) {
      if (payload.categoryId !== undefined) {
        await this.#validateServiceCategory(payload.categoryId);
        updates.categoryId = payload.categoryId;
      }
      if (payload.durationMinutes !== undefined) updates.durationMinutes = payload.durationMinutes;
      if (payload.price !== undefined) updates.price = payload.price;
    }

    const before = master.toSafeObject();
    const updated = await this.masterRepository.updateById(id, updates);

    await this.auditService.record(AUDIT_ACTIONS.MASTER_UPDATED, {
      actorId,
      metadata: {
        masterId: id,
        type,
        fields: Object.keys(payload),
        before: Object.fromEntries(Object.keys(payload).map((k) => [k, before[k]])),
        after: Object.fromEntries(Object.keys(payload).map((k) => [k, updated.toSafeObject()[k]])),
      },
      req,
      resourceType: 'Master',
      resourceId: id,
    });

    return updated.toSafeObject();
  }

  async getById(type, id) {
    const master = await this.masterRepository.findByIdNotDeleted(id);
    if (!master || master.type !== type) throw ApiError.notFound('Master record not found');
    return master.toSafeObject();
  }

  async list(type, query = {}) {
    const page = Number(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(Number(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    let isActive;
    if (query.isActive === 'true') isActive = true;
    if (query.isActive === 'false') isActive = false;

    const result = await this.masterRepository.paginateByType(type, {
      page,
      limit,
      search: query.search,
      status: query.status,
      isActive,
      categoryId: query.categoryId,
      sortBy: query.sortBy || 'sortOrder',
      sortOrder: query.sortOrder || 'asc',
    });

    return {
      items: result.items.map((m) => m.toSafeObject()),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async listActive(type) {
    const items = await this.masterRepository.listActiveByType(type);
    return items.map((m) => m.toSafeObject());
  }

  async activate(type, id, actorId, req = null) {
    const master = await this.masterRepository.findByIdNotDeleted(id);
    if (!master || master.type !== type) throw ApiError.notFound('Master record not found');

    const updated = await this.masterRepository.updateById(id, {
      isActive: true,
      status: ENTITY_STATUS.ACTIVE,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.MASTER_ACTIVATED, {
      actorId,
      metadata: { masterId: id, type },
      req,
      resourceType: 'Master',
      resourceId: id,
    });

    return updated.toSafeObject();
  }

  /**
   * Dependency-warning check — read-only, run by the UI before a deactivation is confirmed.
   * Not a hard block: the caller decides whether to proceed once it sees the counts.
   *
   * Currently implemented for SERVICE (the clearest, highest-value case — a service master
   * referenced by live appointments/treatment plans). Other master types
   * (e.g. PAYMENT_METHOD referenced by invoices, LEAD_SOURCE by patients) have no real
   * dependents wired up yet; this follows the same pattern and should be extended per-type
   * as those references start to matter operationally.
   */
  async checkDependencies(type, id) {
    const master = await this.masterRepository.findByIdNotDeleted(id);
    if (!master || master.type !== type) throw ApiError.notFound('Master record not found');

    if (type !== MASTER_TYPES.SERVICE) {
      return { activeReferences: 0, type: null, breakdown: {} };
    }

    const [appointmentCount, treatmentPlanCount] = await Promise.all([
      Appointment.countDocuments({
        serviceId: id,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      }),
      TreatmentPlan.countDocuments({
        'items.serviceId': id,
        status: { $in: NON_TERMINAL_TREATMENT_PLAN_STATUSES },
      }),
    ]);

    return {
      activeReferences: appointmentCount + treatmentPlanCount,
      type: 'APPOINTMENTS_AND_PLANS',
      breakdown: {
        appointments: appointmentCount,
        treatmentPlans: treatmentPlanCount,
      },
    };
  }

  async deactivate(type, id, actorId, req = null) {
    const master = await this.masterRepository.findByIdNotDeleted(id);
    if (!master || master.type !== type) throw ApiError.notFound('Master record not found');
    if (master.isSystem) throw ApiError.forbidden('System master cannot be deactivated');

    const updated = await this.masterRepository.updateById(id, {
      isActive: false,
      status: ENTITY_STATUS.INACTIVE,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.MASTER_DEACTIVATED, {
      actorId,
      metadata: { masterId: id, type },
      req,
      resourceType: 'Master',
      resourceId: id,
    });

    return updated.toSafeObject();
  }

  async softDelete(type, id, actorId, req = null) {
    const master = await this.masterRepository.findByIdNotDeleted(id);
    if (!master || master.type !== type) throw ApiError.notFound('Master record not found');
    if (master.isSystem) throw ApiError.forbidden('System master cannot be deleted');

    const updated = await this.masterRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      isActive: false,
      status: ENTITY_STATUS.INACTIVE,
      updatedBy: actorId,
      name: `deleted_${Date.now()}_${master.name}`.slice(0, 120),
    });

    await this.auditService.record(AUDIT_ACTIONS.MASTER_SOFT_DELETED, {
      actorId,
      metadata: { masterId: id, type },
      req,
      resourceType: 'Master',
      resourceId: id,
    });

    return updated.toSafeObject();
  }
}

export default MasterService;
