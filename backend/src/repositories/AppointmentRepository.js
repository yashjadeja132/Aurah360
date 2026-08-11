import BaseRepository from './BaseRepository.js';
import Appointment from '../models/Appointment.model.js';
import { ACTIVE_APPOINTMENT_STATUSES } from '../enums/appointment.js';
import { paginateModel } from '../helpers/paginate.helper.js';
import { timeToMinutes } from '../helpers/schedule.engine.js';

class AppointmentRepository extends BaseRepository {
  constructor() {
    super(Appointment);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByNumber(appointmentNumber) {
    return this.model
      .findOne({ appointmentNumber: appointmentNumber.toUpperCase().trim(), deletedAt: null })
      .exec();
  }

  async findActiveForDoctorDay(doctorId, date) {
    const { start, end } = dayBounds(date);
    return this.model
      .find({
        doctorId,
        deletedAt: null,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        appointmentDate: { $gte: start, $lte: end },
      })
      .exec();
  }

  async findActiveForPatientDay(patientId, date) {
    const { start, end } = dayBounds(date);
    return this.model
      .find({
        patientId,
        deletedAt: null,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        appointmentDate: { $gte: start, $lte: end },
      })
      .exec();
  }

  /** APT-001 — active appointments already holding a given room/device on a given day. */
  async findActiveForResourceDay(field, resourceId, date) {
    const { start, end } = dayBounds(date);
    return this.model
      .find({
        [field]: resourceId,
        deletedAt: null,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        appointmentDate: { $gte: start, $lte: end },
      })
      .exec();
  }

  /**
   * NFR-004 — insert inside the caller's transaction so the row appears atomically with the
   * slot-lock claim that protects it. `Model.create` only accepts a session in its array form.
   */
  async createInSession(data, session) {
    const [doc] = await this.model.create([data], { session });
    return doc;
  }

  async updateByIdInSession(id, update, session) {
    return this.model.findByIdAndUpdate(id, update, { new: true, session }).exec();
  }

  async findByIdempotencyKey(key) {
    if (!key) return null;
    return this.model.findOne({ idempotencyKey: key, deletedAt: null }).exec();
  }

  async findOverlapping({
    doctorId = null,
    patientId = null,
    date,
    startTime,
    endTime,
    excludeId = null,
  }) {
    const dayAppts = doctorId
      ? await this.findActiveForDoctorDay(doctorId, date)
      : await this.findActiveForPatientDay(patientId, date);

    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);

    return dayAppts.filter((appt) => {
      if (excludeId && appt._id.toString() === excludeId.toString()) return false;
      if (patientId && appt.patientId.toString() !== patientId.toString()) return false;
      if (doctorId && appt.doctorId.toString() !== doctorId.toString()) return false;
      const aStart = timeToMinutes(appt.startTime);
      const aEnd = timeToMinutes(appt.endTime);
      return start < aEnd && end > aStart;
    });
  }

  async findByPatient(patientId, { limit = 50 } = {}) {
    return this.model
      .find({ patientId, deletedAt: null })
      .sort({ appointmentDate: -1, startTime: -1 })
      .limit(limit)
      .exec();
  }

  async findDoctorCalendar(doctorId, from, to, branchId = null) {
    const filter = {
      doctorId,
      deletedAt: null,
      appointmentDate: { $gte: startOfDay(from), $lte: endOfDay(to) },
    };
    if (branchId) filter.branchId = branchId;
    return this.model.find(filter).sort({ appointmentDate: 1, startTime: 1 }).exec();
  }

  async paginate(options = {}) {
    const filter = {};
    if (options.status) filter.status = options.status;
    if (options.doctorId) filter.doctorId = options.doctorId;
    if (options.patientId) filter.patientId = options.patientId;
    if (options.branchId) filter.branchId = options.branchId;
    if (options.serviceId) filter.serviceId = options.serviceId;
    if (options.appointmentType) filter.appointmentType = options.appointmentType;

    if (options.from || options.to) {
      filter.appointmentDate = {};
      if (options.from) filter.appointmentDate.$gte = startOfDay(options.from);
      if (options.to) filter.appointmentDate.$lte = endOfDay(options.to);
    }

    return paginateModel(this.model, {
      filter,
      page: options.page,
      limit: options.limit,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      search: options.search,
      searchFields: ['appointmentNumber', 'notes', 'reasonForVisit'],
      allowedSort: ['createdAt', 'appointmentDate', 'startTime', 'status', 'appointmentNumber'],
    });
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'mrn firstName lastName mobile photo')
      .populate({
        path: 'doctorId',
        select: 'doctorCode specialization userId colorCode',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('branchId', 'name displayName branchCode')
      .populate('serviceId', 'name code')
      .populate('departmentId', 'name code')
      .exec();
  }
}

function dayBounds(date) {
  return { start: startOfDay(date), end: endOfDay(date) };
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default AppointmentRepository;
