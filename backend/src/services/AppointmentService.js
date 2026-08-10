import mongoose from 'mongoose';
import ApiError from '../libs/ApiError.js';
import AppointmentRepository from '../repositories/AppointmentRepository.js';
import SlotLockRepository from '../repositories/SlotLockRepository.js';
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
    this.slotLockRepository = new SlotLockRepository();
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

    await this.#assertServiceDuration(payload);
    await this.#assertDailyLimit(payload, validation.slot, excludeId);

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
      // RSC-001 — the room document carries the booking policy (capacity + cleaning turnover).
      const room = await this.resourceService.assertRoomBookable(roomId);
      await this.conflictService.assertResourceAvailable({
        field: 'roomId',
        resourceId: roomId,
        date: payload.appointmentDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        excludeId,
        capacity: room?.capacity ?? 1,
        bufferMinutes: room?.cleaningBufferMinutes ?? 0,
      });
    }
    if (deviceId) {
      // RSC-001 — maintenance is judged at the moment the device would be used, not at booking time.
      await this.resourceService.assertDeviceBookable(
        deviceId,
        appointmentMoment(payload.appointmentDate, payload.startTime)
      );
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

  /**
   * NFR-004 / §2.4 — run the slot validation and the write that depends on it as ONE serialized
   * unit, so no second request can slip between "the slot is free" and "the slot is taken".
   *
   * Two mechanisms, and they cover different failures:
   *
   *  1. The partial unique index on (doctorId, appointmentDate, startTime) in Appointment.model.js.
   *     It is the backstop and it needs no cooperation from this code — even a direct insert from
   *     a script cannot double-book an exact start minute.
   *  2. This mutex, which covers what the index structurally cannot: partial OVERLAPS. A
   *     transaction alone would not help — MongoDB gives snapshot isolation, not predicate locks,
   *     so two transactions can both read "nothing overlaps" and both commit. Claiming a lock
   *     document per resource-day gives them a single document to contend on; the loser is
   *     retried by `withTransaction` and, on its retry, sees the winner's committed row and
   *     raises a clean conflict.
   *
   * The validation reads inside the callback deliberately do NOT use the session. A non-session read sees
   * the latest committed state, which is fresher than the transaction's snapshot — and because the
   * lock is claimed first, no competing booking for these resources can be in flight, so "latest
   * committed" is the whole truth. Threading a session through the availability, conflict and
   * resource services would buy nothing and touch a dozen files.
   *
   * Requires a replica set (Atlas, or any local replica set). This is intentionally not made
   * optional: silently degrading to an unguarded insert would reintroduce the exact defect.
   */
  async #withSlotClaim({ payload, excludeId = null, write }) {
    const keys = this.slotLockRepository.keysFor({
      doctorId: payload.doctorId,
      patientId: payload.patientId,
      roomId: payload.roomId || payload.resourceAllocation?.roomId,
      deviceId: payload.deviceId || payload.resourceAllocation?.deviceId,
      date: payload.appointmentDate,
    });
    await this.slotLockRepository.ensure(keys);

    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        await this.slotLockRepository.claim(keys, session);
        await this.#assertSlot(payload, excludeId);
        result = await write(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  /**
   * NFR-004 — when the unique index fires, the caller must learn which slot lost and what to do
   * about it. The generic 11000 branch in error.middleware.js answers "Duplicate value", which
   * names nothing and tells a receptionist nothing.
   */
  #slotConflictError(err, payload = {}) {
    if (err?.code !== 11000) return err;
    const pattern = err.keyPattern || {};

    if (pattern.doctorId && pattern.startTime) {
      return ApiError.conflict(
        `This doctor is already booked at ${payload.startTime} on `
          + `${formatDay(payload.appointmentDate)} — another booking claimed that slot first. `
          + 'Choose a different time, doctor or day.',
        'DOCTOR_SLOT_TAKEN'
      );
    }
    if (pattern.idempotencyKey) {
      return ApiError.conflict(
        'A booking already exists for this idempotencyKey',
        'DUPLICATE_IDEMPOTENCY_KEY'
      );
    }
    return err;
  }

  /**
   * RSC-001 — a SERVICE master's configured `durationMinutes` is the length of that service.
   * Until now the booked length came entirely from client-supplied start/end times, so the
   * configured duration described nothing.
   *
   * Unset / null / 0 means "this service has no fixed length" and imposes nothing.
   */
  async #assertServiceDuration(payload) {
    if (!payload.serviceId) return;
    const service = await this.masterRepository.findByIdNotDeleted(payload.serviceId);
    if (!service || service.type !== MASTER_TYPES.SERVICE) return;
    const required = service.durationMinutes;
    if (!required) return;

    const booked = timeToMinutes(payload.endTime) - timeToMinutes(payload.startTime);
    if (booked !== required) {
      throw ApiError.badRequest(
        `Service "${service.name}" is configured to take ${required} minutes but this appointment `
          + `is ${booked} minutes — book a ${required}-minute slot or change the service's `
          + 'durationMinutes',
        null,
        'SERVICE_DURATION_MISMATCH'
      );
    }
  }

  /**
   * RSC-001 — `maximumAppointments` on the doctor's schedule row is a per-day cap. It was copied
   * into every generated slot and then read by nobody.
   *
   * 0 (the model default) means unlimited. Only appointments that actually consume capacity are
   * counted — the repository's active-status filter already excludes cancelled / no-show /
   * rescheduled rows — and the appointment being edited is excluded from its own count.
   */
  async #assertDailyLimit(payload, slot, excludeId = null) {
    const cap = Number(slot?.maximumAppointments) || 0;
    if (cap <= 0) return;

    const dayAppts = await this.appointmentRepository.findActiveForDoctorDay(
      payload.doctorId,
      payload.appointmentDate
    );
    const scheduleBranchId = slot?.branchId || payload.branchId;
    const consuming = dayAppts.filter((appt) => {
      if (excludeId && appt._id.toString() === excludeId.toString()) return false;
      if (scheduleBranchId && appt.branchId?.toString() !== String(scheduleBranchId)) return false;
      return true;
    });

    if (consuming.length >= cap) {
      throw ApiError.conflict(
        `This doctor's schedule allows a maximum of ${cap} appointments per day at this branch and `
          + `${consuming.length} are already booked — raise maximumAppointments on the doctor's `
          + 'schedule or choose another day',
        'DOCTOR_DAILY_LIMIT_REACHED'
      );
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

    if (payload.recurring?.enabled) {
      throw ApiError.badRequest(
        'Recurring appointments are not implemented yet (placeholder only).'
      );
    }

    const duration =
      payload.duration ||
      timeToMinutes(payload.endTime) - timeToMinutes(payload.startTime);

    const doc = {
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
    };

    let appointment;
    try {
      appointment = requiresApproval
        ? // A proposal claims no capacity (APT-003), so it validates nothing and locks nothing.
          await this.appointmentRepository.create(doc)
        : await this.#withSlotClaim({
            payload,
            write: (session) => this.appointmentRepository.createInSession(doc, session),
          });
    } catch (err) {
      /**
       * APT-008 — a concurrent duplicate request on the same idempotency key loses the race;
       * return the winner's record instead of erroring the retry.
       *
       * Checked for ANY failure, not just 11000: now that the slot claim is serialized, the loser
       * of a same-key race is usually stopped by the slot conflict check BEFORE it ever reaches
       * the insert that would raise the duplicate-key error. Idempotency means "this key already
       * produced a booking, here it is" regardless of which guard fired.
       */
      if (payload.idempotencyKey) {
        const winner = await this.appointmentRepository.findByIdempotencyKey(payload.idempotencyKey);
        if (winner) return this.#map(await this.appointmentRepository.findByIdPopulated(winner._id));
      }
      // NFR-004 — two DIFFERENT idempotency keys racing for one slot end here: the unique index
      // rejected the loser, and it must read as a slot conflict, not as a raw Mongo error.
      throw this.#slotConflictError(err, payload);
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
      /**
       * APT-001 — the room/device this appointment will HOLD once the patch lands: the new one if
       * the caller supplied one, otherwise the one it already has. `next` previously carried
       * neither, so #assertSlot's room and device checks were handed `undefined` on every update
       * and never ran at all — moving an appointment's TIME never re-checked the room it kept.
       * An explicit null (clearing the allocation) must survive, hence `!== undefined` rather
       * than `??`.
       */
      roomId: firstDefined(
        payload.roomId,
        payload.resourceAllocation?.roomId,
        existing.roomId ?? existing.resourceAllocation?.roomId ?? null
      ),
      deviceId: firstDefined(
        payload.deviceId,
        payload.resourceAllocation?.deviceId,
        existing.deviceId ?? existing.resourceAllocation?.deviceId ?? null
      ),
    };

    /**
     * APT-001 — a RESOURCE move is a slot change. Re-validating only on date/time/doctor/branch
     * meant a PATCH that set `roomId` alone moved the appointment into an already-occupied room
     * (or onto a device under maintenance) with no check whatsoever, and answered 200.
     */
    const slotChanged = Boolean(
      payload.appointmentDate ||
        payload.startTime ||
        payload.endTime ||
        payload.doctorId ||
        payload.branchId ||
        payload.roomId !== undefined ||
        payload.deviceId !== undefined ||
        payload.resourceAllocation !== undefined
    );

    const updates = { ...payload, updatedBy: actorId };
    if (updates.appointmentDate) updates.appointmentDate = startOfDay(updates.appointmentDate);
    if (updates.startTime && updates.endTime) {
      updates.duration = timeToMinutes(updates.endTime) - timeToMinutes(updates.startTime);
    }

    if (slotChanged) {
      await this.#assertRefs({ ...next, departmentId: payload.departmentId });
      try {
        // Same serialized claim as create() — a reschedule races exactly like a first booking.
        await this.#withSlotClaim({
          payload: next,
          excludeId: id,
          write: (session) => this.appointmentRepository.updateByIdInSession(id, updates, session),
        });
      } catch (err) {
        throw this.#slotConflictError(err, next);
      }
    } else {
      await this.appointmentRepository.updateById(id, updates);
    }
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
      updates.status = APPOINTMENT_STATUS.CONFIRMED;
      updates.requiresApproval = false;

      /**
       * NFR-004 — accepting is the moment the proposal starts consuming capacity, so it is the
       * moment it can collide. Validate and commit under the same serialized claim create() uses;
       * two approvers accepting two proposals for one slot must not both succeed.
       */
      const slot = {
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        branchId: appointment.branchId,
        serviceId: appointment.serviceId,
        appointmentDate: appointment.appointmentDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        roomId: appointment.roomId,
        deviceId: appointment.deviceId,
      };
      try {
        await this.#withSlotClaim({
          payload: slot,
          excludeId: id,
          write: (session) => this.appointmentRepository.updateByIdInSession(id, updates, session),
        });
      } catch (err) {
        throw this.#slotConflictError(err, slot);
      }

      const accepted = this.#map(await this.appointmentRepository.findByIdPopulated(id));
      await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_APPROVAL_DECIDED, {
        actorId,
        metadata: { appointmentId: id, decision },
        req,
      });
      await this.notificationService.sendAppointmentCreated(accepted).catch(() => {});
      return accepted;
    }

    if (decision === APPROVAL_DECISION.ALTERNATIVE_PROPOSED) {
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

  async offerWaitlistSlot(id, slot, _actorId) {
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

/** First argument that was actually supplied. `??` cannot be used: an explicit `null` (clearing a
 *  room/device allocation) is a supplied value and must not fall through to the existing one. */
function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return null;
}

/** yyyy-mm-dd, for conflict messages that must name the day the receptionist is looking at. */
function formatDay(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Absolute moment an appointment begins — appointment date at its "HH:mm" start time. */
function appointmentMoment(date, startTime) {
  const d = startOfDay(date);
  const minutes = timeToMinutes(startTime);
  if (minutes != null) d.setMinutes(minutes);
  return d;
}

export default AppointmentService;
