import ApiError from '../libs/ApiError.js';
import PrescriptionRepository, {
  PrescriptionTemplateRepository,
} from '../repositories/PrescriptionRepository.js';
import MedicineRepository from '../repositories/MedicineRepository.js';
import ConsultationRepository from '../repositories/ConsultationRepository.js';
import AuditService from './AuditService.js';
import { generatePrescriptionNumber } from '../helpers/prescriptionNumber.helper.js';
import { PRESCRIPTION_STATUS } from '../enums/prescription.js';
import { CONSULTATION_STATUS } from '../enums/consultation.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

/**
 * Prescriptions always require consultationId.
 * No inventory / billing side effects.
 */
class PrescriptionService {
  constructor() {
    this.prescriptionRepository = new PrescriptionRepository();
    this.templateRepository = new PrescriptionTemplateRepository();
    this.medicineRepository = new MedicineRepository();
    this.consultationRepository = new ConsultationRepository();
    this.auditService = new AuditService();
  }

  #map(doc) {
    if (!doc) return null;
    const extra = {};
    if (doc.patientId?.firstName) {
      extra.patient = {
        id: doc.patientId._id.toString(),
        mrn: doc.patientId.mrn,
        fullName: [doc.patientId.firstName, doc.patientId.lastName].filter(Boolean).join(' '),
        mobile: doc.patientId.mobile,
        dateOfBirth: doc.patientId.dateOfBirth,
        gender: doc.patientId.gender,
      };
      extra.patientId = doc.patientId._id.toString();
    }
    if (doc.doctorId?.doctorCode) {
      const u = doc.doctorId.userId;
      extra.doctor = {
        id: doc.doctorId._id.toString(),
        doctorCode: doc.doctorId.doctorCode,
        name: u ? `${u.firstName} ${u.lastName}`.trim() : null,
        specialization: doc.doctorId.specialization,
      };
      extra.doctorId = doc.doctorId._id.toString();
    }
    if (doc.branchId?.name || doc.branchId?.displayName) {
      extra.branch = {
        id: doc.branchId._id.toString(),
        name: doc.branchId.displayName || doc.branchId.name,
        branchCode: doc.branchId.branchCode,
        address: doc.branchId.address,
        phone: doc.branchId.phone,
      };
      extra.branchId = doc.branchId._id.toString();
    }
    if (doc.consultationId?.consultationNumber) {
      extra.consultation = {
        id: doc.consultationId._id.toString(),
        consultationNumber: doc.consultationId.consultationNumber,
        status: doc.consultationId.status,
      };
      extra.consultationId = doc.consultationId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  async #assertConsultationUsable(consultationId) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(consultationId);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    // Locked consultations cannot receive new/edited prescriptions
    if (consultation.locked || consultation.status === CONSULTATION_STATUS.LOCKED) {
      throw ApiError.forbidden('Consultation is locked — prescriptions cannot be changed');
    }
    return consultation;
  }

  #assertDraft(prescription) {
    if (prescription.status !== PRESCRIPTION_STATUS.DRAFT) {
      throw ApiError.forbidden('Only draft prescriptions can be edited');
    }
  }

  async #normalizeItems(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('At least one medicine item is required');
    }
    const normalized = [];
    for (const raw of items) {
      if (!raw.medicineName?.trim() && !raw.medicineId) {
        throw ApiError.badRequest('Medicine is required on each item');
      }
      let medicineName = raw.medicineName;
      let genericName = raw.genericName || null;
      let strength = raw.strength || null;
      let medicineId = raw.medicineId || null;

      if (medicineId) {
        const med = await this.medicineRepository.findByIdNotDeleted(medicineId);
        if (!med) throw ApiError.badRequest(`Invalid medicine: ${medicineId}`);
        medicineName = medicineName || med.name;
        genericName = genericName || med.genericName;
        strength = strength || med.strength;
      }

      normalized.push({
        medicineId,
        medicineName: medicineName.trim(),
        genericName,
        strength,
        dosage: raw.dosage || null,
        frequency: raw.frequency || null,
        duration: raw.duration || null,
        route: raw.route || 'ORAL',
        instructions: raw.instructions || null,
        quantity: raw.quantity ?? null,
        morning: Boolean(raw.morning),
        afternoon: Boolean(raw.afternoon),
        night: Boolean(raw.night),
        beforeFood: Boolean(raw.beforeFood),
        afterFood: Boolean(raw.afterFood),
        remarks: raw.remarks || null,
      });
    }
    return normalized;
  }

  /**
   * Non-blocking duplicate-medicine check.
   * - Flags medicines repeated within the same set of items being saved.
   * - Flags medicines that also appear on the patient's other currently-active
   *   (FINALIZED, not cancelled/deleted) prescriptions.
   * Never throws — duplicates are surfaced as warnings so the doctor can proceed deliberately.
   */
  async #findDuplicateWarnings({ patientId, items, excludePrescriptionId = null }) {
    const warnings = [];
    const keyOf = (item) =>
      item.medicineId ? `id:${item.medicineId}` : `name:${(item.medicineName || '').trim().toLowerCase()}`;

    // 1. Within the same prescription
    const seen = new Set();
    for (const item of items) {
      const key = keyOf(item);
      if (seen.has(key)) {
        warnings.push({
          type: 'DUPLICATE_IN_PRESCRIPTION',
          medicineId: item.medicineId || null,
          medicineName: item.medicineName,
        });
      } else {
        seen.add(key);
      }
    }

    // 2. Against the patient's other active prescriptions
    if (patientId) {
      const activeRx = await this.prescriptionRepository.findActiveByPatient(
        patientId,
        excludePrescriptionId
      );
      for (const item of items) {
        for (const rx of activeRx) {
          const match = (rx.items || []).find((existing) => {
            if (item.medicineId && existing.medicineId) {
              return String(existing.medicineId) === String(item.medicineId);
            }
            if (!item.medicineId && !existing.medicineId) {
              return (
                (existing.medicineName || '').trim().toLowerCase() ===
                (item.medicineName || '').trim().toLowerCase()
              );
            }
            return false;
          });
          if (match) {
            warnings.push({
              type: 'DUPLICATE_ACROSS_ACTIVE',
              medicineId: item.medicineId || null,
              medicineName: item.medicineName,
              conflictingPrescriptionId: rx._id.toString(),
            });
          }
        }
      }
    }

    return warnings;
  }

  async create({ consultationId, notes = null, items = [] }, actorId, req = null) {
    if (!consultationId) throw ApiError.badRequest('consultationId is required');
    const consultation = await this.#assertConsultationUsable(consultationId);
    const normalizedItems = await this.#normalizeItems(items);

    const prescription = await this.prescriptionRepository.create({
      prescriptionNumber: await generatePrescriptionNumber(),
      consultationId: consultation._id,
      patientId: consultation.patientId,
      doctorId: consultation.doctorId,
      branchId: consultation.branchId,
      status: PRESCRIPTION_STATUS.DRAFT,
      notes,
      items: normalizedItems,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PRESCRIPTION_CREATED, {
      actorId,
      metadata: {
        prescriptionId: prescription._id.toString(),
        consultationId,
        prescriptionNumber: prescription.prescriptionNumber,
      },
      req,
    });

    for (const item of normalizedItems) {
      await this.auditService.record(AUDIT_ACTIONS.MEDICINE_ADDED, {
        actorId,
        metadata: {
          prescriptionId: prescription._id.toString(),
          medicineName: item.medicineName,
          medicineId: item.medicineId,
        },
        req,
      });
    }

    const result = await this.getById(prescription._id.toString());
    result.warnings = await this.#findDuplicateWarnings({
      patientId: consultation.patientId,
      items: normalizedItems,
      excludePrescriptionId: prescription._id,
    });
    return result;
  }

  async getById(id) {
    const doc = await this.prescriptionRepository.findByIdPopulated(id);
    if (!doc) throw ApiError.notFound('Prescription not found');
    return this.#map(doc);
  }

  async listByConsultation(consultationId) {
    const rows = await this.prescriptionRepository.findByConsultation(consultationId);
    return Promise.all(
      rows.map(async (r) =>
        this.#map(await this.prescriptionRepository.findByIdPopulated(r._id))
      )
    );
  }

  async listByPatient(patientId) {
    const rows = await this.prescriptionRepository.findByPatient(patientId);
    return Promise.all(
      rows.map(async (r) =>
        this.#map(await this.prescriptionRepository.findByIdPopulated(r._id))
      )
    );
  }

  async listByDoctor(doctorId, opts = {}) {
    const rows = await this.prescriptionRepository.findByDoctor(doctorId, opts);
    return Promise.all(
      rows.map(async (r) =>
        this.#map(await this.prescriptionRepository.findByIdPopulated(r._id))
      )
    );
  }

  async updateDraft(id, { notes, items }, actorId, req = null) {
    const prescription = await this.prescriptionRepository.findByIdNotDeleted(id);
    if (!prescription) throw ApiError.notFound('Prescription not found');
    this.#assertDraft(prescription);
    await this.#assertConsultationUsable(prescription.consultationId);

    const updates = { updatedBy: actorId };
    if (notes !== undefined) updates.notes = notes;
    if (items) {
      updates.items = await this.#normalizeItems(items);
      for (const item of updates.items) {
        await this.auditService.record(AUDIT_ACTIONS.MEDICINE_ADDED, {
          actorId,
          metadata: {
            prescriptionId: id,
            medicineName: item.medicineName,
            medicineId: item.medicineId,
          },
          req,
        });
      }
    }

    await this.prescriptionRepository.updateById(id, updates);
    const result = await this.getById(id);
    if (updates.items) {
      result.warnings = await this.#findDuplicateWarnings({
        patientId: prescription.patientId,
        items: updates.items,
        excludePrescriptionId: prescription._id,
      });
    }
    return result;
  }

  async deleteDraft(id, actorId) {
    const prescription = await this.prescriptionRepository.findByIdNotDeleted(id);
    if (!prescription) throw ApiError.notFound('Prescription not found');
    this.#assertDraft(prescription);
    await this.prescriptionRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
    });
    return { id };
  }

  async finalize(id, actorId, req = null) {
    const prescription = await this.prescriptionRepository.findByIdNotDeleted(id);
    if (!prescription) throw ApiError.notFound('Prescription not found');
    this.#assertDraft(prescription);
    await this.#assertConsultationUsable(prescription.consultationId);
    if (!prescription.items?.length) {
      throw ApiError.badRequest('Cannot finalize an empty prescription');
    }

    await this.prescriptionRepository.updateById(id, {
      status: PRESCRIPTION_STATUS.FINALIZED,
      finalizedAt: new Date(),
      finalizedBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PRESCRIPTION_FINALIZED, {
      actorId,
      metadata: { prescriptionId: id, prescriptionNumber: prescription.prescriptionNumber },
      req,
    });

    return this.getById(id);
  }

  async duplicate(id, actorId, req = null) {
    const source = await this.prescriptionRepository.findByIdNotDeleted(id);
    if (!source) throw ApiError.notFound('Prescription not found');
    await this.#assertConsultationUsable(source.consultationId);

    return this.create(
      {
        consultationId: source.consultationId.toString(),
        notes: source.notes,
        items: source.items.map((i) => ({
          medicineId: i.medicineId,
          medicineName: i.medicineName,
          genericName: i.genericName,
          strength: i.strength,
          dosage: i.dosage,
          frequency: i.frequency,
          duration: i.duration,
          route: i.route,
          instructions: i.instructions,
          quantity: i.quantity,
          morning: i.morning,
          afternoon: i.afternoon,
          night: i.night,
          beforeFood: i.beforeFood,
          afterFood: i.afterFood,
          remarks: i.remarks,
        })),
      },
      actorId,
      req
    ).then(async (created) => {
      await this.prescriptionRepository.updateById(created.id, {
        duplicatedFromId: source._id,
      });
      return this.getById(created.id);
    });
  }

  async getPrintData(id, actorId, req = null) {
    const prescription = await this.getById(id);
    if (prescription.status === PRESCRIPTION_STATUS.DRAFT) {
      // Allow print preview of drafts, but mark as such
    }

    await this.prescriptionRepository.updateById(id, {
      printedAt: new Date(),
      printCount: (await this.prescriptionRepository.findByIdNotDeleted(id))?.printCount + 1 || 1,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PRESCRIPTION_PRINTED, {
      actorId,
      metadata: { prescriptionId: id },
      req,
    });

    return {
      prescription: await this.getById(id),
      printMeta: {
        printedAt: new Date().toISOString(),
        clinicLogoPlaceholder: true,
        qrPlaceholder: true,
        signatureLabel: 'Doctor Signature',
      },
    };
  }

  async recentMedicines(doctorId) {
    const rows = await this.prescriptionRepository.recentMedicinesForDoctor(doctorId);
    return rows.map((r) => ({
      medicineId: r._id.medicineId ? r._id.medicineId.toString() : null,
      medicineName: r._id.medicineName || r.sample?.medicineName,
      count: r.count,
      lastUsed: r.lastUsed,
      sample: {
        dosage: r.sample?.dosage,
        frequency: r.sample?.frequency,
        duration: r.sample?.duration,
        route: r.sample?.route,
        morning: r.sample?.morning,
        afternoon: r.sample?.afternoon,
        night: r.sample?.night,
        beforeFood: r.sample?.beforeFood,
        afterFood: r.sample?.afterFood,
      },
    }));
  }

  async listTemplates(doctorId) {
    const rows = await this.templateRepository.findForDoctor(doctorId);
    return rows.map((r) => r.toSafeObject());
  }

  async createTemplate(payload, actorId) {
    const row = await this.templateRepository.create({
      ...payload,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.toSafeObject();
  }

  async deleteTemplate(id, actorId) {
    const row = await this.templateRepository.findByIdNotDeleted(id);
    if (!row) throw ApiError.notFound('Template not found');
    await this.templateRepository.updateById(id, {
      deletedAt: new Date(),
      updatedBy: actorId,
    });
    return { id };
  }

  async applyTemplate(templateId, consultationId, actorId, req = null) {
    const template = await this.templateRepository.findByIdNotDeleted(templateId);
    if (!template) throw ApiError.notFound('Template not found');

    let items = template.items || [];
    if ((!items.length) && template.medicineId) {
      const med = await this.medicineRepository.findByIdNotDeleted(template.medicineId);
      if (med) {
        items = [
          {
            medicineId: med._id,
            medicineName: med.name,
            genericName: med.genericName,
            strength: med.strength,
            route: med.defaultRoute || 'ORAL',
          },
        ];
      }
    }

    await this.templateRepository.updateById(templateId, {
      useCount: (template.useCount || 0) + 1,
    });

    return this.create({ consultationId, notes: template.notes, items }, actorId, req);
  }
}

export default PrescriptionService;
