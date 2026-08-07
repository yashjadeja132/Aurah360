import ApiError from '../libs/ApiError.js';
import MedicineRepository from '../repositories/MedicineRepository.js';
import AuditService from './AuditService.js';
import { generateMedicineCode } from '../helpers/prescriptionNumber.helper.js';
import { ENTITY_STATUS } from '../constants/index.js';

class MedicineService {
  constructor() {
    this.medicineRepository = new MedicineRepository();
    this.auditService = new AuditService();
  }

  #map(doc) {
    return doc ? doc.toSafeObject() : null;
  }

  async search(q, limit = 20) {
    const rows = await this.medicineRepository.search(q, { limit });
    return rows.map((r) => this.#map(r));
  }

  async list(query = {}) {
    const result = await this.medicineRepository.paginate(query);
    return {
      items: result.items.map((r) => this.#map(r)),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async getById(id) {
    const doc = await this.medicineRepository.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Medicine not found');
    return this.#map(doc);
  }

  async create(payload, actorId) {
    const medicine = await this.medicineRepository.create({
      ...payload,
      medicineCode: payload.medicineCode || (await generateMedicineCode()),
      status: payload.status || ENTITY_STATUS.ACTIVE,
      isActive: payload.isActive !== false,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.#map(medicine);
  }

  async update(id, payload, actorId) {
    const existing = await this.medicineRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Medicine not found');
    const updated = await this.medicineRepository.updateById(id, {
      ...payload,
      updatedBy: actorId,
    });
    return this.#map(updated);
  }
}

export default MedicineService;
