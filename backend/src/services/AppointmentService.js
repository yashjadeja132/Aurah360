import ApiError from '../libs/ApiError.js';
import AppointmentRepository from '../repositories/AppointmentRepository.js';
import PatientRepository from '../repositories/PatientRepository.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import MasterRepository from '../repositories/MasterRepository.js';
import DoctorAvailabilityService from './DoctorAvailabilityService.js';
import AppointmentConflictService from './AppointmentConflictService.js';
import NotificationService from './NotificationService.js';
import AuditService from './AuditService.js';
import ResourceService from './ResourceService.js';
import AppointmentWaitlist from '../models/AppointmentWaitlist.model.js';
import { generateAppointmentNumber } from '../helpers/appointmentNumber.helper.js';
import { timeToMinutes } from '../helpers/schedule.engine.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { APPOINTMENT_STATUS, AWAITING_APPROVAL_STATUSES, APPROVAL_DECISION } from '../enums/appointment.js';
import { WAITLIST_STATUS } from '../enums/appointment.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import { PAGINATION } from '../constants/index.js';

class AppointmentService {
  constructor() {
    this.appointmentRepository = new AppointmentRepository();
    this.patientRepository = new PatientRepository();
    this.doctorRepository = new DoctorRepository();
    this.branchRepository = new BranchRepository();
    this.masterRepository = new MasterRepository();
    this.availabilityService = new DoctorAvailabilityService();
    this.conflictService = new AppointmentConflictService();
    this.notificationService = new NotificationService();
    this.auditService = new AuditService();
    this.resourceService = new ResourceService();
  }

  async #assertRefs(payload) {
    const patient = await this.patientRepository.findByIdNotDeleted(payload.patientId);
    if (!patient) throw ApiError.badRequest('Patient not found');

    const doctor = await this.doctorRepository.findByIdNotDeleted(payload.doctorId);
    if (!doctor) throw ApiError.badRequest('Doctor not found');

    const branch = await this.branchRepository.findByIdNotDeleted(payload.branchId);
    if (!branch) throw ApiError.badRequest('Branch not found');

    const service = await this.masterRepository.findByIdNotDeleted(payload.serviceId);
    if (!service || service.type !== MASTER_TYPES.SERVICE) {
      throw ApiError.badRequest('Invalid service');
    }

    if (payload.departmentId) {
      const dept = await this.masterRepository.findByIdNotDeleted(payload.departmentId);
      if (!dept || dept.type !== MASTER_TYPES.DEPARTMENT) {
        throw ApiError.badRequest('Invalid department');
      }
    }

    return { patient, doctor, branch, service };
  }

  async #assertSlot(payload, excludeId = null) {
    const validation = await this.availabilityService.validateSlot(payload.doctorId, {
      date: payload.appointmentDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      branchId: payload.branchId,
    });
    if (!validation.valid) {
      throw ApiError.badRequest(`Slot unavailable: ${validation.reason}`);
    }

    await this.conflictService.assertNoConflicts({
      doctorId: payload.doctorId,
      patientId: payload.patientId,
      branchId: payload.branchId,
      date: payload.appointmentDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      excludeId,
    });

    // APT-001 — room/device must be in service AND not already booked over this time range.
    const roomId = payload.roomId || payload.resourceAllocation?.roomId;
    const deviceId = payload.deviceId || payload.resourceAllocation?.deviceId;
    if (roomId) {
      if (!(await this.resourceService.isRoomAvailable(roomId))) {
        throw ApiError.conflict('Selected room is not in service', 'ROOM_UNAVAILABLE');
      }
      await this.conflictService.assertResourceAvailable({
        field: 'roomId',
        resourceId: roomId,
        date: payload.appointmentDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        excludeId,
      });
    }
    if (deviceId) {
      if (!(await this.resourceService.isDeviceAvailable(deviceId))) {
        throw ApiError.conflict('Selected device is not in service', 'DEVICE_UNAVAILABLE');
      }
      await this.conflictService.assertResourceAvailable({
        field: 'deviceId',
        resourceId: deviceId,
        date: payload.appointmentDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        excludeId,
      });
    }
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
        photo: doc.patientId.photo,
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
      };
      extra.branchId = doc.branchId._id.toString();
    }
    if (doc.serviceId?.name) {
      extra.service = {
        id: doc.serviceId._id.toString(),
        name: doc.serviceId.name,
        code: doc.serviceId.code,
      };
      extra.serviceId = doc.serviceId._id.toString();
    }
    if (doc.departmentId?.name) {
      extra.department = {
        id: doc.departmentId._id.toString(),
        name: doc.departmentId.name,
      };
      extra.departmentId = doc.departmentId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  async getAvailableSlots(doctorId, date, branchId) {
    const result = await this.availabilityService.getAvailableSlots(doctorId, date, branchId);
    const slots = await this.conflictService.filterBookedSlots(
      result.slots || [],
      doctorId,
      date
    );
    return {
      ...result,
      slots,
      available: slots.length > 0,
      reason: slots.length ? null : result.reason || 'NO_SLOTS',
    };
  }

  async create(payload, actorId, req = null) {
    // APT-008 — idempotency: a retried request with the same key returns the original booking.
    if (payload.idempotencyKey) {
      const existing = await this.appointmentRepository.findByIdempotencyKey(payload.idempotencyKey);
      if (existing) {
        return this.#map(await this.appointmentRepository.findByIdPopulated(existing._id));
      }
    }

    await this.#assertRefs(payload);

    // APT-003 — a patient-proposed/custom slot is held as Pending Approval, not committed.
    const requiresApproval = Boolean(payload.requiresApproval);
    if (!requiresApproval) {
      await this.#assertSlot(payload);
    }

    if (payload.recurring?.enabled) {
      throw ApiError.badRequest(
        'Recurring appointments are not implemented yet (placeholder only).'
      );
    }

    const duration =
      payload.duration ||
      timeToMinutes(payload.endTime) - timeToMinutes(payload.startTime);

    let appointment;
    try {
      appointment = await this.appointmentRepository.create({
        ...payload,
        appointmentNumber: await generateAppointmentNumber(),
        appointmentDate: startOfDay(payload.appointmentDate),
        duration,
        status: requiresApproval
          ? APPOINTMENT_STATUS.PENDING_APPROVAL
          : payload.status || APPOINTMENT_STATUS.SCHEDULED,
        requiresApproval,
        resourceAllocation: {
          doctorId: payload.doctorId,
          roomId: payload.roomId || null,
          deviceId: payload.deviceId || null,
          technicianId: payload.technicianId || null,
          ...(payload.resourceAllocation || {}),
        },
        createdBy: actorId,
        updatedBy: actorId,
      });
    } catch (err) {
      // NFR-004 — a concurrent duplicate request on the same idempotency key loses the
      // insert race; return the winner's record instead of erroring the retry.
      if (err.code === 11000 && payload.idempotencyKey) {
        const winner = await this.appointmentRepository.findByIdempotencyKey(payload.idempotencyKey);
        if (winner) return this.#map(await this.appointmentRepository.findByIdPopulated(winner._id));
      }
      throw err;
    }

    const mapped = this.#map(await this.appointmentRepository.findByIdPopulated(appointment._id));
    await this.notificationService.sendAppointmentCreated(mapped);
    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_CREATED, {
      actorId,
      metadata: { appointmentId: appointment._id.toString(), appointmentNumber: appointment.appointmentNumber },
      req,
    });
    return mapped;
  }

  async getById(id) {
    const doc = await this.appointmentRepository.findByIdPopulated(id);
    if (!doc) throw ApiError.notFound('Appointment not found');
    return this.#map(doc);
  }

  async list(query = {}) {
    const page = Number(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(Number(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const result = await this.appointmentRepository.paginate({ ...query, page, limit });
    const items = await Promise.all(
      result.items.map(async (row) =>
        this.#map(await this.appointmentRepository.findByIdPopulated(row._id))
      )
    );
    return {
      items,
      meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    };
  }

  async update(id, payload, actorId, req = null) {
    const existing = await this.appointmentRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Appointment not found');
    if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED].includes(existing.status)) {
      throw ApiError.badRequest('Cannot update a cancelled or completed appointment');
    }

    const next = {
      patientId: payload.patientId ?? existing.patientId.toString(),
      doctorId: payload.doctorId ?? existing.doctorId.toString(),
      branchId: payload.branchId ?? existing.branchId.toString(),
      serviceId: payload.serviceId ?? existing.serviceId.toString(),
      appointmentDate: payload.appointmentDate ?? existing.appointmentDate,
      startTime: payload.startTime ?? existing.startTime,
      endTime: payload.endTime ?? existing.endTime,
    };

    const slotChanged =
      payload.appointmentDate || payload.startTime || payload.endTime || payload.doctorId || payload.branchId;
    if (slotChanged) {
      await this.#assertRefs({ ...next, departmentId: payload.departmentId });
      await this.#assertSlot(next, id);
    }

    const updates = { ...payload, updatedBy: actorId };
    if (updates.appointmentDate) updates.appointmentDate = startOfDay(updates.appointmentDate);
    if (updates.startTime && updates.endTime) {
      updates.duration = timeToMinutes(updates.endTime) - timeToMinutes(updates.startTime);
    }

    await this.appointmentRepository.updateById(id, updates);
    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_UPDATED, {
      actorId,
      metadata: { appointmentId: id, fields: Object.keys(payload) },
      req,
    });
    return this.#map(await this.appointmentRepository.findByIdPopulated(id));
  }

  async patientHistory(patientId, { limit = 50 } = {}) {
    const patient = await this.patientRepository.findByIdNotDeleted(patientId);
    if (!patient) throw ApiError.notFound('Patient not found');
    const rows = await this.appointmentRepository.findByPatient(patientId, { limit });
    return Promise.all(
      rows.map(async (r) => this.#map(await this.appointmentRepository.findByIdPopulated(r._id)))
    );
  }

  async doctorCalendar(doctorId, from, to, branchId = null) {
    const doctor = await this.doctorRepository.findByIdNotDeleted(doctorId);
    if (!doctor) throw ApiError.notFound('Doctor not found');
    const rows = await this.appointmentRepository.findDoctorCalendar(
      doctorId,
      from,
      to,
      branchId
    );
    return Promise.all(
      rows.map(async (r) => this.#map(await this.appointmentRepository.findByIdPopulated(r._id)))
    );
  }

  /** APT-003 — doctor/branch decides a pending-approval request. */
  async decideApproval(id, { decision, alternative = null, reason = null }, actorId, req = null) {
    const appointment = await this.appointmentRepository.findByIdNotDeleted(id);
    if (!appointment) throw ApiError.notFound('Appointment not found');
    if (!AWAITING_APPROVAL_STATUSES.includes(appointment.status)) {
      throw ApiError.badRequest('This appointment is not awaiting approval');
    }

    const updates = {
      approvalDecision: decision,
      approvedBy: actorId,
      approvedAt: new Date(),
      updatedBy: actorId,
    };

    if (decision === APPROVAL_DECISION.ACCEPTED) {
      await this.#assertSlot(
        {
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          branchId: appointment.branchId,
          appointmentDate: appointment.appointmentDate,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          roomId: appointment.roomId,
          deviceId: appointment.deviceId,
        },
        id
      );
      updates.status = APPOINTMENT_STATUS.CONFIRMED;
      updates.requiresApproval = false;
    } else if (decision === APPROVAL_DECISION.ALTERNATIVE_PROPOSED) {
      if (!alternative?.appointmentDate || !alternative?.startTime || !alternative?.endTime) {
        throw ApiError.badRequest('Alternative slot (date/startTime/endTime) is required');
      }
      updates.proposedAlternative = alternative;
      updates.status = APPOINTMENT_STATUS.PENDING_APPROVAL;
    } else if (decision === APPROVAL_DECISION.REJECTED) {
      updates.status = APPOINTMENT_STATUS.CANCELLED;
      updates.cancellationReason = reason || 'Approval rejected';
      updates.cancelledAt = new Date();
    } else {
      throw ApiError.badRequest('Unknown approval decision');
    }

    await this.appointmentRepository.updateById(id, updates);
    const mapped = this.#map(await this.appointmentRepository.findByIdPopulated(id));

    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_APPROVAL_DECIDED, {
      actorId,
      metadata: { appointmentId: id, decision },
      req,
    });

    if (decision !== APPROVAL_DECISION.REJECTED) {
      await this.notificationService.sendAppointmentCreated(mapped).catch(() => {});
    }
    return mapped;
  }

  /** Patient accepts a proposed alternative slot — commits it as the new time. */
  async acceptAlternative(id, actorId, req = null) {
    const appointment = await this.appointmentRepository.findByIdNotDeleted(id);
    if (!appointment) throw ApiError.notFound('Appointment not found');
    if (!appointment.proposedAlternative) {
      throw ApiError.badRequest('No proposed alternative to accept');
    }
    const { appointmentDate, startTime, endTime } = appointment.proposedAlternative;
    return this.update(id, { appointmentDate, startTime, endTime, status: APPOINTMENT_STATUS.CONFIRMED }, actorId, req);
  }

  // --- Waitlist (APT-006) -------------------------------------------------------------
  async addToWaitlist(payload, actorId) {
    const entry = await AppointmentWaitlist.create({ ...payload, createdBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_WAITLISTED, {
      actorId,
      metadata: { patientId: payload.patientId, doctorId: payload.doctorId },
    });
    return entry.toSafeObject();
  }

  async listWaitlist(query = {}) {
    const filter = { status: WAITLIST_STATUS.WAITING };
    if (query.doctorId) filter.doctorId = query.doctorId;
    if (query.branchId) filter.branchId = query.branchId;
    const rows = await AppointmentWaitlist.find(filter).sort({ createdAt: 1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async offerWaitlistSlot(id, slot, actorId) {
    const entry = await AppointmentWaitlist.findById(id);
    if (!entry) throw ApiError.notFound('Waitlist entry not found');
    entry.status = WAITLIST_STATUS.OFFERED;
    entry.offeredSlot = slot;
    entry.offeredAt = new Date();
    entry.offerExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h to respond
    await entry.save();
    return entry.toSafeObject();
  }

  async convertWaitlistToAppointment(id, extraPayload, actorId, req = null) {
    const entry = await AppointmentWaitlist.findById(id);
    if (!entry) throw ApiError.notFound('Waitlist entry not found');
    if (!entry.offeredSlot) throw ApiError.badRequest('No offered slot to convert');

    const appointment = await this.create(
      {
        patientId: entry.patientId,
        doctorId: entry.doctorId,
        branchId: entry.branchId,
        serviceId: entry.serviceId,
        appointmentDate: entry.offeredSlot.appointmentDate,
        startTime: entry.offeredSlot.startTime,
        endTime: entry.offeredSlot.endTime,
        source: 'ONLINE',
        ...extraPayload,
      },
      actorId,
      req
    );

    entry.status = WAITLIST_STATUS.BOOKED;
    entry.resultingAppointmentId = appointment.id;
    await entry.save();
    return appointment;
  }
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default AppointmentService;
