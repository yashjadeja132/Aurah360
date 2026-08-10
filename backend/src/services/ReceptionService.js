import ApiError from '../libs/ApiError.js';
import AppointmentRepository from '../repositories/AppointmentRepository.js';
import PatientRepository from '../repositories/PatientRepository.js';
import QueueRepository from '../repositories/QueueRepository.js';
import AppointmentService from './AppointmentService.js';
import QueueService from './QueueService.js';
import AuditService from './AuditService.js';
import { APPOINTMENT_STATUS, APPOINTMENT_SOURCE } from '../enums/appointment.js';
import { QUEUE_PRIORITY, QUEUE_STATUS } from '../enums/queue.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { timeToMinutes } from '../helpers/schedule.engine.js';

/**
 * Reception front-desk workflow — check-in & walk-in.
 * Always uses AppointmentService for booking; QueueService for tokens.
 */
class ReceptionService {
  constructor() {
    this.appointmentRepository = new AppointmentRepository();
    this.patientRepository = new PatientRepository();
    this.queueRepository = new QueueRepository();
    this.appointmentService = new AppointmentService();
    this.queueService = new QueueService();
    this.auditService = new AuditService();
  }

  #resolvePriority(patient, requested) {
    if (requested && requested !== QUEUE_PRIORITY.NORMAL) return requested;
    if (patient?.isVip) return QUEUE_PRIORITY.VIP;
    return QUEUE_PRIORITY.NORMAL;
  }

  #isLate(appointment) {
    if (!appointment?.startTime) return false;

    // "Late" only ever applies to appointments still waiting to check in.
    // Once an appointment is cancelled, a no-show, rescheduled, completed,
    // or already past check-in (CHECKED_IN/WAITING/IN_CONSULTATION/...),
    // it is no longer awaiting arrival, so it can never be "late".
    const pendingCheckInStatuses = [
      APPOINTMENT_STATUS.REQUESTED,
      APPOINTMENT_STATUS.PENDING_APPROVAL,
      APPOINTMENT_STATUS.SCHEDULED,
      APPOINTMENT_STATUS.CONFIRMED,
    ];
    if (!pendingCheckInStatuses.includes(appointment.status)) return false;

    const now = new Date();
    const apptDay = new Date(appointment.appointmentDate);
    if (now.toDateString() !== apptDay.toDateString()) return false;
    const scheduled = timeToMinutes(appointment.startTime);
    const current = now.getHours() * 60 + now.getMinutes();
    return current > scheduled + 10;
  }

  async todaysAppointments({ branchId, doctorId = null, date = new Date(), search = null } = {}) {
    const start = startOfDay(date);
    const end = endOfDay(date);
    const result = await this.appointmentService.list({
      branchId,
      doctorId: doctorId || undefined,
      from: start.toISOString(),
      to: end.toISOString(),
      page: 1,
      limit: 100,
      sortBy: 'startTime',
      sortOrder: 'asc',
      search: search || undefined,
    });

    return result.items.map((item) => ({
      ...item,
      isLate: this.#isLate(item),
      hasNoAppointmentWarning: false,
    }));
  }

  async receptionDashboard({ branchId, date = new Date() }) {
    const appointments = await this.todaysAppointments({ branchId, date });
    const queueSummary = await this.queueService.summary(branchId, date);
    const queue = await this.queueService.listBranchQueue(branchId, date);

    const counts = {
      total: appointments.length,
      scheduled: appointments.filter((a) => a.status === APPOINTMENT_STATUS.SCHEDULED).length,
      confirmed: appointments.filter((a) => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      checkedIn: appointments.filter((a) => a.status === APPOINTMENT_STATUS.CHECKED_IN).length,
      inConsultation: appointments.filter((a) => a.status === APPOINTMENT_STATUS.IN_CONSULTATION).length,
      completed: appointments.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETED).length,
      noShow: appointments.filter((a) => a.status === APPOINTMENT_STATUS.NO_SHOW).length,
      walkIns: appointments.filter((a) => a.source === APPOINTMENT_SOURCE.WALK_IN).length,
      waiting: queueSummary.counts.waiting,
      averageWaitTime: queueSummary.averageWaitTime,
    };

    return { counts, appointments, queue, queueSummary };
  }

  async checkIn(appointmentId, payload = {}, actorId, req = null) {
    const appointment = await this.appointmentRepository.findByIdNotDeleted(appointmentId);
    if (!appointment) throw ApiError.notFound('Appointment not found');

    if (
      [
        APPOINTMENT_STATUS.CANCELLED,
        APPOINTMENT_STATUS.NO_SHOW,
        APPOINTMENT_STATUS.COMPLETED,
      ].includes(appointment.status)
    ) {
      throw ApiError.badRequest('Cannot check in a closed appointment');
    }

    const patient = await this.patientRepository.findByIdNotDeleted(appointment.patientId);
    if (!patient) throw ApiError.badRequest('Patient not found');

    if (payload.updateContact || payload.consent) {
      const updates = { updatedBy: actorId };
      if (payload.updateContact?.mobile) updates.mobile = payload.updateContact.mobile;
      if (payload.updateContact?.email) updates.email = payload.updateContact.email;
      if (payload.updateContact?.alternateMobile) {
        updates.alternateMobile = payload.updateContact.alternateMobile;
      }
      if (payload.consent) {
        updates.consent = {
          ...(patient.consent?.toObject?.() || patient.consent || {}),
          ...payload.consent,
          acceptedAt: new Date(),
        };
      }
      await this.patientRepository.updateById(patient._id, updates);
    }

    const isLate = this.#isLate(appointment);
    await this.appointmentRepository.updateById(appointmentId, {
      status: APPOINTMENT_STATUS.CHECKED_IN,
      notes: payload.receptionNotes
        ? [appointment.notes, `Reception: ${payload.receptionNotes}`].filter(Boolean).join('\n')
        : appointment.notes,
      updatedBy: actorId,
    });

    const priority = this.#resolvePriority(patient, payload.priority);
    const queueEntry = await this.queueService.assignToQueue(
      {
        appointmentId,
        priority,
        isWalkIn: appointment.source === APPOINTMENT_SOURCE.WALK_IN,
        isLate,
        receptionNotes: payload.receptionNotes || null,
        actorId,
      },
      req
    );

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_CHECKED_IN, {
      actorId,
      metadata: {
        appointmentId,
        patientId: patient._id.toString(),
        tokenNumber: queueEntry.tokenNumber,
        isLate,
      },
      req,
    });

    const updatedAppointment = await this.appointmentService.getById(appointmentId);
    return {
      appointment: updatedAppointment,
      queueEntry,
      warnings: {
        isLate,
        noAppointment: false,
        missingConsents: !(patient.consent?.privacyPolicy && patient.consent?.treatmentConsent),
      },
    };
  }

  async undoCheckIn(appointmentId, actorId, _req = null) {
    const appointment = await this.appointmentRepository.findByIdNotDeleted(appointmentId);
    if (!appointment) throw ApiError.notFound('Appointment not found');
    if (appointment.status !== APPOINTMENT_STATUS.CHECKED_IN) {
      throw ApiError.badRequest('Appointment is not checked in');
    }

    const entry = await this.queueRepository.findByAppointment(appointmentId);
    if (entry) {
      if (![QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.SKIPPED].includes(entry.queueStatus)) {
        throw ApiError.badRequest('Cannot undo check-in after consultation started');
      }
      await this.queueRepository.updateById(entry._id, {
        queueStatus: QUEUE_STATUS.CANCELLED,
        deletedAt: new Date(),
        deletedBy: actorId,
        updatedBy: actorId,
      });
    }

    await this.appointmentRepository.updateById(appointmentId, {
      status: APPOINTMENT_STATUS.CONFIRMED,
      updatedBy: actorId,
    });

    return this.appointmentService.getById(appointmentId);
  }

  /**
   * Walk-in: create same-day appointment via AppointmentService, then check in.
   */
  async walkIn(payload, actorId, req = null) {
    const appointment = await this.appointmentService.create(
      {
        patientId: payload.patientId,
        doctorId: payload.doctorId,
        branchId: payload.branchId,
        serviceId: payload.serviceId,
        departmentId: payload.departmentId || null,
        appointmentDate: payload.appointmentDate || new Date(),
        startTime: payload.startTime,
        endTime: payload.endTime,
        appointmentType: payload.appointmentType || 'CONSULTATION',
        source: APPOINTMENT_SOURCE.WALK_IN,
        priority: payload.appointmentPriority || 'NORMAL',
        reasonForVisit: payload.reasonForVisit || 'Walk-in',
        notes: payload.notes || null,
      },
      actorId,
      req
    );

    await this.auditService.record(AUDIT_ACTIONS.WALK_IN_CREATED, {
      actorId,
      metadata: { appointmentId: appointment.id, patientId: payload.patientId },
      req,
    });

    return this.checkIn(
      appointment.id,
      {
        priority: payload.queuePriority,
        receptionNotes: payload.receptionNotes || 'Walk-in',
        updateContact: payload.updateContact,
        consent: payload.consent,
      },
      actorId,
      req
    );
  }
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

export default ReceptionService;
