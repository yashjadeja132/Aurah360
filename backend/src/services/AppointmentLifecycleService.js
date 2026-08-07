import ApiError from '../libs/ApiError.js';
import AppointmentRepository from '../repositories/AppointmentRepository.js';
import AppointmentService from './AppointmentService.js';
import NotificationService from './NotificationService.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE } from '../enums/appointment.js';

/**
 * Status transitions & reschedule/follow-up — keeps AppointmentService under size limit.
 */
class AppointmentLifecycleService {
  constructor() {
    this.appointmentRepository = new AppointmentRepository();
    this.appointmentService = new AppointmentService();
    this.notificationService = new NotificationService();
    this.auditService = new AuditService();
  }

  async #get(id) {
    const doc = await this.appointmentRepository.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Appointment not found');
    return doc;
  }

  async confirm(id, actorId, req = null) {
    const doc = await this.#get(id);
    if (doc.status !== APPOINTMENT_STATUS.SCHEDULED) {
      throw ApiError.badRequest('Only scheduled appointments can be confirmed');
    }
    await this.appointmentRepository.updateById(id, {
      status: APPOINTMENT_STATUS.CONFIRMED,
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_UPDATED, {
      actorId,
      metadata: { appointmentId: id, status: APPOINTMENT_STATUS.CONFIRMED },
      branchId: doc.branchId,
      resourceType: 'Appointment',
      resourceId: id,
      req,
    });
    return this.appointmentService.getById(id);
  }

  async cancel(id, { reason } = {}, actorId, req = null) {
    const doc = await this.#get(id);
    if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED].includes(doc.status)) {
      throw ApiError.badRequest('Appointment already closed');
    }
    await this.appointmentRepository.updateById(id, {
      status: APPOINTMENT_STATUS.CANCELLED,
      cancellationReason: reason || null,
      cancelledAt: new Date(),
      updatedBy: actorId,
    });
    const mapped = await this.appointmentService.getById(id);
    await this.notificationService.sendAppointmentCancelled(mapped);
    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_CANCELLED, {
      actorId,
      metadata: { appointmentId: id },
      branchId: doc.branchId,
      resourceType: 'Appointment',
      resourceId: id,
      req,
    });
    return mapped;
  }

  async markNoShow(id, actorId, req = null) {
    const doc = await this.#get(id);
    if (![APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CHECKED_IN].includes(doc.status)) {
      throw ApiError.badRequest('Invalid status for no-show');
    }
    await this.appointmentRepository.updateById(id, {
      status: APPOINTMENT_STATUS.NO_SHOW,
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_UPDATED, {
      actorId,
      metadata: { appointmentId: id, status: APPOINTMENT_STATUS.NO_SHOW },
      branchId: doc.branchId,
      resourceType: 'Appointment',
      resourceId: id,
      req,
    });
    return this.appointmentService.getById(id);
  }

  async complete(id, actorId, req = null) {
    const doc = await this.#get(id);
    if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.COMPLETED].includes(doc.status)) {
      throw ApiError.badRequest('Cannot complete this appointment');
    }
    await this.appointmentRepository.updateById(id, {
      status: APPOINTMENT_STATUS.COMPLETED,
      completedAt: new Date(),
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_COMPLETED, {
      actorId,
      metadata: { appointmentId: id },
      branchId: doc.branchId,
      resourceType: 'Appointment',
      resourceId: id,
      req,
    });

    // Minimal new emit — nothing existing already fires an "appointment completed" domain
    // event; the loyalty earning engine (LOY-004, E1 VISIT_COMPLETED) subscribes to this.
    eventBus.emitDomain('AppointmentCompleted', {
      appointmentId: id,
      patientId: doc.patientId?.toString?.() || doc.patientId,
      branchId: doc.branchId?.toString?.() || doc.branchId,
      completedAt: new Date().toISOString(),
    });

    return this.appointmentService.getById(id);
  }

  async reschedule(id, payload, actorId, req = null) {
    const existing = await this.#get(id);
    if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED].includes(existing.status)) {
      throw ApiError.badRequest('Cannot reschedule a closed appointment');
    }

    const previousStatus = existing.status;
    await this.appointmentRepository.updateById(id, {
      status: APPOINTMENT_STATUS.RESCHEDULED,
      updatedBy: actorId,
    });

    try {
      const createPayload = {
        patientId: existing.patientId.toString(),
        doctorId: payload.doctorId || existing.doctorId.toString(),
        branchId: payload.branchId || existing.branchId.toString(),
        departmentId: existing.departmentId?.toString?.() || null,
        serviceId: payload.serviceId || existing.serviceId.toString(),
        appointmentDate: payload.appointmentDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        appointmentType: existing.appointmentType,
        source: existing.source,
        priority: existing.priority,
        notes: payload.notes || existing.notes,
        reasonForVisit: existing.reasonForVisit,
        parentAppointmentId: existing.parentAppointmentId?.toString?.() || null,
        rescheduledFromId: existing._id.toString(),
        roomId: existing.roomId,
        deviceId: existing.deviceId,
        technicianId: existing.technicianId,
      };

      const created = await this.appointmentService.create(createPayload, actorId, req);

      await this.notificationService.sendAppointmentRescheduled(created);
      await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_RESCHEDULED, {
        actorId,
        metadata: {
          fromId: id,
          toId: created.id,
          appointmentNumber: created.appointmentNumber,
        },
        branchId: existing.branchId,
        resourceType: 'Appointment',
        resourceId: created.id,
        req,
      });

      return { previousId: id, appointment: created };
    } catch (error) {
      await this.appointmentRepository.updateById(id, {
        status: previousStatus,
        updatedBy: actorId,
      });
      throw error;
    }
  }

  async createFollowUp(parentId, payload, actorId, req = null) {
    const parent = await this.#get(parentId);
    const created = await this.appointmentService.create(
      {
        patientId: parent.patientId.toString(),
        doctorId: payload.doctorId || parent.doctorId.toString(),
        branchId: payload.branchId || parent.branchId.toString(),
        departmentId: parent.departmentId?.toString?.() || null,
        serviceId: payload.serviceId || parent.serviceId.toString(),
        appointmentDate: payload.appointmentDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        appointmentType: APPOINTMENT_TYPE.FOLLOW_UP,
        source: parent.source,
        priority: payload.priority || parent.priority,
        notes: payload.notes || null,
        reasonForVisit: payload.reasonForVisit || 'Follow-up',
        parentAppointmentId: parent._id.toString(),
        roomId: payload.roomId || null,
        deviceId: payload.deviceId || null,
        technicianId: payload.technicianId || null,
      },
      actorId,
      req
    );
    return created;
  }

  async softDelete(id, actorId, req = null) {
    const doc = await this.#get(id);
    await this.appointmentRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
      status: APPOINTMENT_STATUS.CANCELLED,
      cancelledAt: doc.cancelledAt || new Date(),
    });
    await this.auditService.record(AUDIT_ACTIONS.APPOINTMENT_CANCELLED, {
      actorId,
      metadata: { appointmentId: id, softDeleted: true },
      branchId: doc.branchId,
      resourceType: 'Appointment',
      resourceId: id,
      req,
    });
    return true;
  }
}

export default AppointmentLifecycleService;
