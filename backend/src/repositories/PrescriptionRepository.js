import mongoose from 'mongoose';
import BaseRepository from './BaseRepository.js';
import Prescription from '../models/Prescription.model.js';
import PrescriptionTemplate from '../models/PrescriptionTemplate.model.js';

class PrescriptionRepository extends BaseRepository {
  constructor() {
    super(Prescription);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByConsultation(consultationId) {
    return this.model
      .find({ consultationId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByPatient(patientId, { limit = 50 } = {}) {
    return this.model
      .find({ patientId, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findByDoctor(doctorId, { status = null, limit = 50, branchId = null } = {}) {
    const filter = { doctorId, deletedAt: null };
    if (status) filter.status = status;
    // SEC-030 — branchId comes from the caller's resolved scope (see helpers/scope.helper.js).
    if (branchId) filter.branchId = branchId;
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
  }

  /**
   * Other currently-active prescriptions for a patient (FINALIZED, not cancelled,
   * not soft-deleted), optionally excluding one prescription (e.g. the one being edited).
   */
  async findActiveByPatient(patientId, excludePrescriptionId = null) {
    const filter = {
      patientId,
      status: 'FINALIZED',
      deletedAt: null,
    };
    if (excludePrescriptionId) {
      filter._id = { $ne: excludePrescriptionId };
    }
    return this.model.find(filter).select('items status patientId').exec();
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'mrn firstName lastName mobile dateOfBirth gender')
      .populate({
        path: 'doctorId',
        select: 'doctorCode specialization userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('branchId', 'name displayName branchCode address phone')
      .populate('consultationId', 'consultationNumber status startedAt')
      .exec();
  }

  async recentMedicinesForDoctor(doctorId, { limit = 20 } = {}) {
    return this.model.aggregate([
      {
        $match: {
          doctorId: new mongoose.Types.ObjectId(String(doctorId)),
          deletedAt: null,
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            medicineId: '$items.medicineId',
            medicineName: '$items.medicineName',
          },
          count: { $sum: 1 },
          lastUsed: { $max: '$createdAt' },
          sample: { $last: '$items' },
        },
      },
      { $sort: { count: -1, lastUsed: -1 } },
      { $limit: limit },
    ]);
  }
}

class PrescriptionTemplateRepository extends BaseRepository {
  constructor() {
    super(PrescriptionTemplate);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findForDoctor(doctorId) {
    return this.model
      .find({ doctorId, deletedAt: null })
      .sort({ useCount: -1, name: 1 })
      .exec();
  }
}

export { PrescriptionRepository, PrescriptionTemplateRepository };
export default PrescriptionRepository;
