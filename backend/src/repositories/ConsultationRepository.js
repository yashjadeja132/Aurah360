import BaseRepository from './BaseRepository.js';
import Consultation from '../models/Consultation.model.js';

class ConsultationRepository extends BaseRepository {
  constructor() {
    super(Consultation);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByAppointment(appointmentId) {
    return this.model
      .find({ appointmentId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findLatestByAppointment(appointmentId) {
    return this.model
      .findOne({ appointmentId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByPatient(patientId, { limit = 50 } = {}) {
    return this.model
      .find({ patientId, deletedAt: null })
      .sort({ startedAt: -1, createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'mrn firstName lastName mobile dateOfBirth gender allergies medicalHistory isVip photo')
      .populate({
        path: 'doctorId',
        select: 'doctorCode specialization userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('branchId', 'name displayName branchCode')
      .populate('appointmentId', 'appointmentNumber startTime endTime appointmentDate status source')
      .exec();
  }
}

export default ConsultationRepository;
