import ApiError from '../libs/ApiError.js';
import QueueRepository from '../repositories/QueueRepository.js';
import AppointmentRepository from '../repositories/AppointmentRepository.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import AuditService from './AuditService.js';
import { generateQueueToken } from '../helpers/queueToken.helper.js';
import {
  QUEUE_STATUS,
  QUEUE_PRIORITY,
  QUEUE_PRIORITY_WEIGHT,
  ACTIVE_QUEUE_STATUSES,
} from '../enums/queue.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';

const AVG_CONSULT_MINUTES = 15;

/**
 * Reusable queue service — EMR/Treatment modules will call these methods.
 */
class QueueService {
  constructor() {
    this.queueRepository = new QueueRepository();
    this.appointmentRepository = new AppointmentRepository();
    this.doctorRepository = new DoctorRepository();
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
        isVip: doc.patientId.isVip,
      };
      extra.patientId = doc.patientId._id.toString();
    }
    if (doc.doctorId?.doctorCode) {
      const u = doc.doctorId.userId;
      extra.doctor = {
        id: doc.doctorId._id.toString(),
        doctorCode: doc.doctorId.doctorCode,
        name: u ? `${u.firstName} ${u.lastName}`.trim() : null,
      };
      extra.doctorId = doc.doctorId._id.toString();
    }
    if (doc.branchId?.name || doc.branchId?.displayName) {
      extra.branch = {
        id: doc.branchId._id.toString(),
        name: doc.branchId.displayName || doc.branchId.name,
      };
      extra.branchId = doc.branchId._id.toString();
    }
    if (doc.appointmentId?.appointmentNumber) {
      extra.appointment = {
        id: doc.appointmentId._id.toString(),
        appointmentNumber: doc.appointmentId.appointmentNumber,
        startTime: doc.appointmentId.startTime,
        endTime: doc.appointmentId.endTime,
        status: doc.appointmentId.status,
        source: doc.appointmentId.source,
      };
      extra.appointmentId = doc.appointmentId._id.toString();
    }
    const mapped = doc.toSafeObject(extra);
    mapped.waitingMinutes = this.#waitingMinutes(doc);
    return mapped;
  }

  /**
   * PRD §6.5/§17.2 — serialisation for the PUBLIC waiting-room board.
   *
   * The lobby screen is readable by everyone standing in the waiting room, so the server must
   * never SEND identity there — hiding a column in the UI is not a control, because the payload
   * is still on the wire and in the browser cache. This mapper is therefore a whitelist built
   * from scratch rather than `#map()` minus a few keys: a field added to the model later cannot
   * silently appear on the public board.
   *
   * What is deliberately included: the token (how a patient recognises their turn), initials
   * (disambiguates two people holding adjacent tokens), the doctor and the coarse status. What
   * is deliberately excluded: name, mobile, MRN, VIP flag, reception/clinical notes, appointment
   * details and the patient id itself.
   */
  #mapPublic(doc) {
    if (!doc) return null;
    const patient = doc.patientId;
    const initials = [patient?.firstName, patient?.lastName]
      .filter(Boolean)
      .map((part) => String(part).trim().charAt(0).toUpperCase())
      .join('');
    const doctorUser = doc.doctorId?.userId;
    return {
      id: doc._id.toString(),
      tokenNumber: doc.tokenNumber,
      patientInitials: initials || null,
      doctorId: doc.doctorId?._id ? doc.doctorId._id.toString() : (doc.doctorId?.toString?.() || null),
      doctorName: doctorUser ? `${doctorUser.firstName} ${doctorUser.lastName}`.trim() : null,
      queueStatus: doc.queueStatus,
      estimatedWaitTime: doc.estimatedWaitTime,
      sortOrder: doc.sortOrder,
    };
  }

  #waitingMinutes(doc) {
    if (!doc.arrivalTime) return 0;
    if ([QUEUE_STATUS.COMPLETED, QUEUE_STATUS.CANCELLED].includes(doc.queueStatus)) {
      const end = doc.completedTime || doc.updatedAt || new Date();
      return Math.max(0, Math.round((new Date(end) - new Date(doc.arrivalTime)) / 60000));
    }
    return Math.max(0, Math.round((Date.now() - new Date(doc.arrivalTime).getTime()) / 60000));
  }

  async #refreshWaitTimes(doctorId, date = new Date()) {
    const waiting = (await this.queueRepository.findDoctorQueue(doctorId, date, { activeOnly: true }))
      .filter((q) => q.queueStatus === QUEUE_STATUS.WAITING);
    for (let i = 0; i < waiting.length; i += 1) {
      await this.queueRepository.updateById(waiting[i]._id, {
        estimatedWaitTime: (i + 1) * AVG_CONSULT_MINUTES,
      });
    }
  }

  async #emit(event, entry) {
    const mapped = typeof entry.toSafeObject === 'function'
      ? this.#map(await this.queueRepository.findByIdPopulated(entry._id || entry.id))
      : entry;
    emitQueueEvent(event, {
      branchId: mapped.branchId,
      doctorId: mapped.doctorId,
      queueEntry: mapped,
    });
    emitQueueEvent(SOCKET_EVENTS.QUEUE_UPDATED, {
      branchId: mapped.branchId,
      doctorId: mapped.doctorId,
      queueEntry: mapped,
    });
    return mapped;
  }

  async assignToQueue({
    appointmentId,
    priority = QUEUE_PRIORITY.NORMAL,
    isWalkIn = false,
    isLate = false,
    receptionNotes = null,
    actorId = null,
  }, req = null) {
    const existing = await this.queueRepository.findByAppointment(appointmentId);
    if (existing) {
      if (existing.queueStatus === QUEUE_STATUS.CANCELLED) {
        await this.queueRepository.updateById(existing._id, {
          deletedAt: new Date(),
          deletedBy: actorId,
        });
      } else {
        throw ApiError.conflict('Appointment already has a queue entry');
      }
    }

    const appointment = await this.appointmentRepository.findByIdNotDeleted(appointmentId);
    if (!appointment) throw ApiError.notFound('Appointment not found');

    const queueDate = startOfDay(appointment.appointmentDate || new Date());
    const tokenNumber = await generateQueueToken(appointment.branchId, queueDate);
    const sortOrder = (await this.queueRepository.maxSortOrder(appointment.doctorId, queueDate)) + 1;
    const weight = QUEUE_PRIORITY_WEIGHT[priority] || QUEUE_PRIORITY_WEIGHT.NORMAL;

    const entry = await this.queueRepository.create({
      tokenNumber,
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      branchId: appointment.branchId,
      queueDate,
      queueStatus: QUEUE_STATUS.WAITING,
      priority,
      priorityWeight: weight,
      sortOrder,
      estimatedWaitTime: sortOrder * AVG_CONSULT_MINUTES,
      arrivalTime: new Date(),
      isWalkIn,
      isLate,
      receptionNotes,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.#refreshWaitTimes(appointment.doctorId, queueDate);

    await this.auditService.record(AUDIT_ACTIONS.QUEUE_ASSIGNED, {
      actorId,
      metadata: { queueEntryId: entry._id.toString(), tokenNumber, appointmentId },
      req,
    });

    return this.#emit(SOCKET_EVENTS.PATIENT_CHECKED_IN, entry);
  }

  /**
   * SEC-030 — `doctorId` narrows a branch queue to one doctor's column. It is set from the
   * caller's server-resolved scope (a DOCTOR only ever sees their own patients waiting), never
   * from raw client input; reception passes null and keeps the full branch board.
   */
  /**
   * `publicDisplay` picks the serialiser, NOT a post-filter: the staff board legitimately needs
   * the full record (reception calls patients by name and phones the ones who do not answer), so
   * both audiences are served by the same query but never by the same payload.
   */
  async listBranchQueue(branchId, date = new Date(), { doctorId = null, publicDisplay = false } = {}) {
    const all = await this.queueRepository.findTodayByBranch(branchId, date);
    const rows = doctorId ? all.filter((r) => r.doctorId?.toString() === doctorId.toString()) : all;
    const map = publicDisplay ? (d) => this.#mapPublic(d) : (d) => this.#map(d);
    return Promise.all(rows.map(async (r) => map(await this.queueRepository.findByIdPopulated(r._id))));
  }

  async listDoctorQueue(doctorId, date = new Date(), { publicDisplay = false } = {}) {
    const rows = await this.queueRepository.findDoctorQueue(doctorId, date);
    const map = publicDisplay ? (d) => this.#mapPublic(d) : (d) => this.#map(d);
    return Promise.all(rows.map(async (r) => map(await this.queueRepository.findByIdPopulated(r._id))));
  }

  async getById(id) {
    const doc = await this.queueRepository.findByIdPopulated(id);
    if (!doc) throw ApiError.notFound('Queue entry not found');
    return this.#map(doc);
  }

  async callNext(doctorId, actorId, req = null) {
    const next = await this.queueRepository.findNextWaiting(doctorId);
    if (!next) throw ApiError.badRequest('No waiting patients in queue');
    return this.callPatient(next._id, actorId, req);
  }

  async callPatient(id, actorId, req = null) {
    const entry = await this.queueRepository.findByIdNotDeleted(id);
    if (!entry) throw ApiError.notFound('Queue entry not found');
    if (![QUEUE_STATUS.WAITING, QUEUE_STATUS.SKIPPED, QUEUE_STATUS.CALLED].includes(entry.queueStatus)) {
      throw ApiError.badRequest('Patient cannot be called from current status');
    }

    await this.queueRepository.updateById(id, {
      queueStatus: QUEUE_STATUS.CALLED,
      calledTime: new Date(),
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.QUEUE_CALLED, {
      actorId,
      metadata: { queueEntryId: id, tokenNumber: entry.tokenNumber },
      req,
    });

    const mapped = await this.#emit(SOCKET_EVENTS.PATIENT_CALLED, entry);
    emitQueueEvent(SOCKET_EVENTS.DOCTOR_STATUS_UPDATED, {
      doctorId: entry.doctorId.toString(),
      branchId: entry.branchId.toString(),
      status: 'CALLING',
      tokenNumber: entry.tokenNumber,
    });
    return mapped;
  }

  async recall(id, actorId, req = null) {
    return this.callPatient(id, actorId, req);
  }

  async skip(id, actorId, req = null) {
    const entry = await this.queueRepository.findByIdNotDeleted(id);
    if (!entry) throw ApiError.notFound('Queue entry not found');
    await this.queueRepository.updateById(id, {
      queueStatus: QUEUE_STATUS.SKIPPED,
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.QUEUE_SKIPPED, {
      actorId,
      metadata: { queueEntryId: id },
      req,
    });
    await this.#refreshWaitTimes(entry.doctorId, entry.queueDate);
    return this.#emit(SOCKET_EVENTS.QUEUE_UPDATED, entry);
  }

  async startConsultation(id, actorId, _req = null) {
    const entry = await this.queueRepository.findByIdNotDeleted(id);
    if (!entry) throw ApiError.notFound('Queue entry not found');
    await this.queueRepository.updateById(id, {
      queueStatus: QUEUE_STATUS.IN_CONSULTATION,
      startedTime: new Date(),
      updatedBy: actorId,
    });
    // Keep appointment aligned without going through booking logic
    await this.appointmentRepository.updateById(entry.appointmentId, {
      status: 'IN_CONSULTATION',
      updatedBy: actorId,
    });
    return this.#emit(SOCKET_EVENTS.QUEUE_UPDATED, entry);
  }

  async complete(id, actorId, req = null) {
    const entry = await this.queueRepository.findByIdNotDeleted(id);
    if (!entry) throw ApiError.notFound('Queue entry not found');
    await this.queueRepository.updateById(id, {
      queueStatus: QUEUE_STATUS.COMPLETED,
      completedTime: new Date(),
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.QUEUE_COMPLETED, {
      actorId,
      metadata: { queueEntryId: id, tokenNumber: entry.tokenNumber },
      req,
    });
    await this.#refreshWaitTimes(entry.doctorId, entry.queueDate);
    return this.#emit(SOCKET_EVENTS.QUEUE_COMPLETED, entry);
  }

  async cancel(id, actorId, _req = null) {
    const entry = await this.queueRepository.findByIdNotDeleted(id);
    if (!entry) throw ApiError.notFound('Queue entry not found');
    await this.queueRepository.updateById(id, {
      queueStatus: QUEUE_STATUS.CANCELLED,
      updatedBy: actorId,
    });
    await this.#refreshWaitTimes(entry.doctorId, entry.queueDate);
    return this.#emit(SOCKET_EVENTS.QUEUE_UPDATED, entry);
  }

  async transfer(id, { doctorId, reason, branchId }, actorId, _req = null) {
    if (!reason?.trim()) throw ApiError.badRequest('Transfer reason is required');
    if (branchId) {
      throw ApiError.badRequest('Branch transfer is not implemented yet (placeholder)');
    }
    const entry = await this.queueRepository.findByIdNotDeleted(id);
    if (!entry) throw ApiError.notFound('Queue entry not found');
    const doctor = await this.doctorRepository.findByIdNotDeleted(doctorId);
    if (!doctor) throw ApiError.badRequest('Invalid doctor');

    const fromDoctorId = entry.doctorId.toString();
    await this.queueRepository.updateById(id, {
      doctorId,
      transferredFromDoctorId: entry.doctorId,
      transferReason: reason,
      queueStatus: QUEUE_STATUS.WAITING,
      calledTime: null,
      startedTime: null,
      updatedBy: actorId,
      sortOrder: (await this.queueRepository.maxSortOrder(doctorId, entry.queueDate)) + 1,
    });

    await this.appointmentRepository.updateById(entry.appointmentId, {
      doctorId,
      updatedBy: actorId,
    });

    await this.#refreshWaitTimes(fromDoctorId, entry.queueDate);
    await this.#refreshWaitTimes(doctorId, entry.queueDate);
    return this.#emit(SOCKET_EVENTS.QUEUE_UPDATED, entry);
  }

  async reorder(id, { beforeId = null, afterId = null, reason }, actorId, req = null) {
    if (!reason?.trim()) throw ApiError.badRequest('Reorder reason is required');
    const entry = await this.queueRepository.findByIdNotDeleted(id);
    if (!entry) throw ApiError.notFound('Queue entry not found');
    if (entry.queueStatus !== QUEUE_STATUS.WAITING) {
      throw ApiError.badRequest('Only waiting patients can be reordered');
    }

    let sortOrder = entry.sortOrder;
    if (beforeId) {
      const before = await this.queueRepository.findByIdNotDeleted(beforeId);
      sortOrder = (before?.sortOrder ?? 0) - 1;
    } else if (afterId) {
      const after = await this.queueRepository.findByIdNotDeleted(afterId);
      sortOrder = (after?.sortOrder ?? 0) + 1;
    }

    await this.queueRepository.updateById(id, { sortOrder, updatedBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.QUEUE_REORDERED, {
      actorId,
      metadata: {
        queueEntryId: id,
        beforeId: beforeId || null,
        afterId: afterId || null,
        fromSortOrder: entry.sortOrder,
        toSortOrder: sortOrder,
        reason: reason.trim(),
      },
      req,
    });
    await this.#refreshWaitTimes(entry.doctorId, entry.queueDate);
    return this.#emit(SOCKET_EVENTS.QUEUE_UPDATED, entry);
  }

  /**
   * SEC-030 — when `doctorId` is set (a DOCTOR's server-resolved scope) the whole summary,
   * including the per-doctor breakdown and the counts, is restricted to that doctor. The
   * counts are recomputed from the scoped rows rather than reusing the branch-wide aggregate,
   * which would otherwise leak colleagues' patient volumes back through the totals.
   */
  async summary(branchId, date = new Date(), { doctorId = null } = {}) {
    const allRows = await this.queueRepository.findTodayByBranch(branchId, date);
    const rows = doctorId
      ? allRows.filter((r) => r.doctorId?.toString() === doctorId.toString())
      : allRows;

    const counts = doctorId
      ? rows.reduce((acc, r) => ({ ...acc, [r.queueStatus]: (acc[r.queueStatus] || 0) + 1 }), {})
      : await this.queueRepository.countByStatus(branchId, date);

    const waiting = rows.filter((r) => r.queueStatus === QUEUE_STATUS.WAITING);
    const completed = rows.filter((r) => r.queueStatus === QUEUE_STATUS.COMPLETED);
    const avgWait =
      completed.length === 0
        ? 0
        : Math.round(
          completed.reduce((sum, r) => sum + this.#waitingMinutes(r), 0) / completed.length
        );

    const byDoctor = {};
    for (const r of rows.filter((x) => ACTIVE_QUEUE_STATUSES.includes(x.queueStatus))) {
      const key = r.doctorId.toString();
      if (!byDoctor[key]) byDoctor[key] = { doctorId: key, waiting: 0, called: 0, inConsultation: 0 };
      if (r.queueStatus === QUEUE_STATUS.WAITING) byDoctor[key].waiting += 1;
      if (r.queueStatus === QUEUE_STATUS.CALLED) byDoctor[key].called += 1;
      if (r.queueStatus === QUEUE_STATUS.IN_CONSULTATION) byDoctor[key].inConsultation += 1;
    }

    const current = rows.find((r) =>
      [QUEUE_STATUS.CALLED, QUEUE_STATUS.IN_CONSULTATION].includes(r.queueStatus)
    );
    const next = waiting[0];

    return {
      counts: {
        waiting: counts.WAITING || 0,
        called: counts.CALLED || 0,
        inConsultation: counts.IN_CONSULTATION || 0,
        treatment: counts.TREATMENT || 0,
        completed: counts.COMPLETED || 0,
        skipped: counts.SKIPPED || 0,
        cancelled: counts.CANCELLED || 0,
        total: rows.length,
      },
      averageWaitTime: avgWait,
      currentToken: current?.tokenNumber || null,
      nextToken: next?.tokenNumber || null,
      byDoctor: Object.values(byDoctor),
    };
  }
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default QueueService;
