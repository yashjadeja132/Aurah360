import ApiError from '../libs/ApiError.js';
import {
  NotificationRepository,
  NotificationTemplateRepository,
} from '../repositories/NotificationRepository.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';
import { enqueueNotificationDispatch } from '../queues/notificationJobs.js';
import { createDefaultProviders } from '../notifications/providers.js';
import { generateNotificationId } from '../helpers/notificationNumber.helper.js';
import {
  DEFAULT_EVENT_CHANNELS,
  EVENT_TEMPLATE_MAP,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  TEMPLATE_CODE,
} from '../enums/notification.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import {
  NOTIFICATION_CATEGORY,
  TRANSACTIONAL_TEMPLATE_CODES,
  MARKETING_TEMPLATE_CODES,
} from '../enums/notification.js';
import Patient from '../models/Patient.model.js';
import logger from '../libs/logger.js';
import config from '../config/index.js';
import ConsentService from './ConsentService.js';
import { CONSENT_PURPOSE } from '../enums/privacy.js';

/**
 * Central notification service — consumed by appointments + domain event listeners.
 * Real WhatsApp Cloud/DLT-SMS/Exotel adapters activate via env config; mock is the safe default.
 */
class NotificationService {
  constructor() {
    this.notificationRepo = new NotificationRepository();
    this.templateRepo = new NotificationTemplateRepository();
    this.auditService = new AuditService();
    this.providers = createDefaultProviders(config);
    this.consentService = new ConsentService();
  }

  /** NTF-006 — marketing messages require marketing consent; service messages never depend on it. */
  #categoryOf(templateCode) {
    if (MARKETING_TEMPLATE_CODES.includes(templateCode)) return NOTIFICATION_CATEGORY.MARKETING;
    if (TRANSACTIONAL_TEMPLATE_CODES.includes(templateCode)) return NOTIFICATION_CATEGORY.TRANSACTIONAL;
    return NOTIFICATION_CATEGORY.TRANSACTIONAL;
  }

  async #isSuppressed(templateCode, patientId) {
    if (!patientId) return false;
    const category = this.#categoryOf(templateCode);
    if (category !== NOTIFICATION_CATEGORY.MARKETING) return false;
    const granted = await this.consentService.isGranted(patientId, CONSENT_PURPOSE.MARKETING_MESSAGES);
    return !granted;
  }

  /** §12.4 — voice/marketing quiet hours (e.g. 21:00→08:00); a request landing inside either
   *  the tonight-window or the still-open overnight-window defers to that window's end. */
  #nextAllowedVoiceTime(fromDate = new Date()) {
    const [startH, startM] = (config.notificationProviders?.voice?.quietHoursStart || '21:00').split(':').map(Number);
    const [endH, endM] = (config.notificationProviders?.voice?.quietHoursEnd || '08:00').split(':').map(Number);

    const windowsToCheck = [-1, 0].map((dayOffset) => {
      const start = new Date(fromDate);
      start.setDate(start.getDate() + dayOffset);
      start.setHours(startH, startM, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      end.setHours(endH, endM, 0, 0);
      return { start, end };
    });

    const active = windowsToCheck.find((w) => fromDate >= w.start && fromDate < w.end);
    return active ? active.end : fromDate;
  }

  /** {{var}} template rendering */
  render(text, variables = {}) {
    if (!text) return '';
    return String(text).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
      const val = variables[key];
      return val == null ? '' : String(val);
    });
  }

  #map(doc) {
    return doc ? doc.toSafeObject() : null;
  }

  #resolveRecipient(channel, { recipient, patient, user }) {
    if (recipient) return recipient;
    if (channel === NOTIFICATION_CHANNEL.EMAIL) {
      return user?.email || patient?.email || 'unknown@local';
    }
    if (
      channel === NOTIFICATION_CHANNEL.SMS ||
      channel === NOTIFICATION_CHANNEL.WHATSAPP
    ) {
      return user?.phone || patient?.mobile || '0000000000';
    }
    if (channel === NOTIFICATION_CHANNEL.IN_APP || channel === NOTIFICATION_CHANNEL.PUSH) {
      return user?._id?.toString?.() || user?.id || patient?._id?.toString?.() || 'system';
    }
    return 'unknown';
  }

  /**
   * Queue notification(s) for an event. Async dispatch via BullMQ.
   */
  async queueEvent({
    eventName,
    variables = {},
    patientId = null,
    userId = null,
    channels = null,
    scheduledAt = null,
    recipientOverrides = {},
    actorId = null,
    req = null,
  }) {
    const templateCode = EVENT_TEMPLATE_MAP[eventName] || null;
    let template = null;
    if (templateCode) {
      template = await this.templateRepo.findByCode(templateCode);
    }

    const channelList =
      channels ||
      DEFAULT_EVENT_CHANNELS[eventName] ||
      [NOTIFICATION_CHANNEL.IN_APP];

    let patient = null;
    if (patientId) {
      patient = await Patient.findById(patientId).exec();
    }

    const created = [];
    for (const channel of channelList) {
      const subject = this.render(
        template?.subject || variables.subject || eventName,
        variables
      );
      const message = this.render(
        template?.body ||
          variables.message ||
          `Notification for ${eventName}: {{summary}}`,
        { summary: eventName, ...variables }
      );

      const recipient = this.#resolveRecipient(channel, {
        recipient: recipientOverrides[channel],
        patient,
        user: userId ? { id: userId, _id: userId, email: variables.userEmail, phone: variables.userPhone } : null,
      });

      // NTF-006 — marketing messages require marketing consent; service reminders are never suppressed by it.
      const suppressed = await this.#isSuppressed(template?.code || templateCode, patientId);

      // §12.4 — voice reminders respect the clinic's configured quiet-hours window.
      let effectiveScheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      if (channel === NOTIFICATION_CHANNEL.VOICE) {
        effectiveScheduledAt = this.#nextAllowedVoiceTime(effectiveScheduledAt || new Date());
      }

      const status = suppressed
        ? NOTIFICATION_STATUS.CANCELLED
        : effectiveScheduledAt
          ? NOTIFICATION_STATUS.SCHEDULED
          : NOTIFICATION_STATUS.QUEUED;

      const doc = await this.notificationRepo.create({
        notificationId: await generateNotificationId(),
        eventName,
        patientId: patientId || null,
        userId: userId || null,
        recipient,
        channel,
        templateId: template?._id || null,
        templateCode: template?.code || templateCode,
        subject,
        message,
        variables,
        status,
        scheduledAt: effectiveScheduledAt,
        cancelReason: suppressed ? 'MARKETING_CONSENT_NOT_GRANTED' : null,
        createdBy: actorId,
      });

      if (!suppressed) {
        const delayMs = effectiveScheduledAt
          ? Math.max(0, effectiveScheduledAt.getTime() - Date.now())
          : 0;
        await enqueueNotificationDispatch(doc._id.toString(), { delayMs });
      }

      await this.auditService.record(AUDIT_ACTIONS.NOTIFICATION_QUEUED, {
        actorId,
        metadata: {
          notificationId: doc.notificationId,
          eventName,
          channel,
          scheduledAt: doc.scheduledAt,
        },
        req,
      });

      created.push(this.#map(doc));
    }

    return { queued: created.length, notifications: created };
  }

  /** Schedule delayed reminder helpers */
  async scheduleReminder(eventName, payload, when) {
    return this.queueEvent({
      ...payload,
      eventName,
      scheduledAt: when,
    });
  }

  async dispatchOne(mongoId) {
    const doc = await this.notificationRepo.findById(mongoId);
    if (!doc) {
      logger.warn('Notification missing for dispatch', { mongoId });
      return { skipped: true };
    }
    if ([NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.CANCELLED].includes(doc.status)) {
      return { skipped: true, status: doc.status };
    }

    await this.notificationRepo.updateById(mongoId, {
      status: NOTIFICATION_STATUS.SENDING,
    });

    const provider = this.providers[doc.channel];
    if (!provider) {
      return this.#markFailed(doc, `No provider for channel ${doc.channel}`);
    }

    try {
      const meta = {
        notificationId: doc.notificationId,
        eventName: doc.eventName,
        variables: doc.variables,
      };
      const response =
        doc.channel === NOTIFICATION_CHANNEL.VOICE
          ? await provider.call({ to: doc.recipient, script: doc.message, meta })
          : await provider.send({
              to: doc.recipient,
              subject: doc.subject,
              title: doc.subject,
              body: doc.message,
              meta,
            });

      await this.notificationRepo.updateById(mongoId, {
        status: NOTIFICATION_STATUS.SENT,
        sentAt: new Date(),
        providerResponse: response,
        providerMessageId: response?.messageId || response?.callId || null,
        failedReason: null,
      });

      await this.auditService.record(AUDIT_ACTIONS.NOTIFICATION_SENT, {
        actorId: null,
        metadata: {
          notificationId: doc.notificationId,
          channel: doc.channel,
          provider: response?.provider,
        },
      });

      if (doc.channel === NOTIFICATION_CHANNEL.IN_APP && doc.userId) {
        emitQueueEvent(SOCKET_EVENTS.NOTIFICATION_RECEIVED, {
          userId: doc.userId.toString(),
          notificationId: doc.notificationId,
          subject: doc.subject,
          message: doc.message,
          eventName: doc.eventName,
        });
      }

      return { success: true, notificationId: doc.notificationId };
    } catch (err) {
      return this.#markFailed(doc, err.message);
    }
  }

  async #markFailed(doc, reason) {
    const retryCount = (doc.retryCount || 0) + 1;
    await this.notificationRepo.updateById(doc._id, {
      status: NOTIFICATION_STATUS.FAILED,
      failedReason: reason,
      retryCount,
    });

    await this.auditService.record(AUDIT_ACTIONS.NOTIFICATION_FAILED, {
      actorId: null,
      metadata: {
        notificationId: doc.notificationId,
        reason,
        retryCount,
      },
    });

    // Retry via delayed re-queue (BullMQ also retries; this records intent)
    if (retryCount <= 3) {
      await this.auditService.record(AUDIT_ACTIONS.NOTIFICATION_RETRIED, {
        actorId: null,
        metadata: { notificationId: doc.notificationId, retryCount },
      });
      await enqueueNotificationDispatch(doc._id.toString(), {
        delayMs: retryCount * 5000,
      });
    }

    return { success: false, reason, retryCount };
  }

  async retry(id, actorId = null, req = null) {
    const doc = await this.notificationRepo.findById(id);
    if (!doc) throw ApiError.notFound('Notification not found');
    await this.notificationRepo.updateById(id, {
      status: NOTIFICATION_STATUS.QUEUED,
      failedReason: null,
    });
    await this.auditService.record(AUDIT_ACTIONS.NOTIFICATION_RETRIED, {
      actorId,
      metadata: { notificationId: doc.notificationId },
      req,
    });
    await enqueueNotificationDispatch(id, { delayMs: 0 });
    return this.#map(await this.notificationRepo.findById(id));
  }

  /**
   * NTF-005/007 — provider delivery webhook ingestion. Idempotent by (providerMessageId, type):
   * a duplicate/out-of-order callback is recorded but does not regress a later status.
   */
  async recordDeliveryEvent({ providerMessageId, type, raw = {}, occurredAt = new Date() }) {
    if (!providerMessageId) return { skipped: true, reason: 'NO_MESSAGE_ID' };
    const doc = await this.notificationRepo.findOne({ providerMessageId });
    if (!doc) return { skipped: true, reason: 'NOTIFICATION_NOT_FOUND' };

    const alreadyRecorded = (doc.deliveryEvents || []).some(
      (e) => e.type === type && Math.abs(new Date(e.at).getTime() - new Date(occurredAt).getTime()) < 1000
    );
    if (alreadyRecorded) return { skipped: true, reason: 'DUPLICATE' };

    const update = { $push: { deliveryEvents: { type, at: occurredAt, raw } } };
    if (type === 'READ') update.readAt = occurredAt;
    if (type === 'FAILED') {
      update.status = NOTIFICATION_STATUS.FAILED;
      update.failedReason = raw?.reason || 'Provider reported failure';
    }
    if (type === 'OPTED_OUT') {
      update.status = NOTIFICATION_STATUS.CANCELLED;
      update.cancelReason = 'RECIPIENT_OPTED_OUT';
      if (doc.patientId) {
        await this.consentService
          .withdraw({ patientId: doc.patientId, purpose: CONSENT_PURPOSE.MARKETING_MESSAGES, reason: 'Opted out via provider reply' }, null)
          .catch(() => {});
      }
    }

    await this.notificationRepo.updateById(doc._id, update);
    return { updated: true, notificationId: doc.notificationId };
  }

  // —— Backward-compatible appointment hooks (used by Appointment modules) ——

  async sendAppointmentCreated(appointment) {
    const variables = this.#appointmentVars(appointment);
    return this.queueEvent({
      eventName: 'AppointmentCreated',
      variables,
      patientId: appointment.patientId || null,
      userId: null,
      channels: DEFAULT_EVENT_CHANNELS.AppointmentCreated,
    });
  }

  async sendAppointmentCancelled(appointment) {
    return this.queueEvent({
      eventName: 'AppointmentCreated',
      variables: {
        ...this.#appointmentVars(appointment),
        summary: 'Appointment cancelled',
        message: 'Your appointment {{appointmentNumber}} was cancelled.',
      },
      patientId: appointment.patientId || null,
      channels: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.SMS],
    });
  }

  async sendAppointmentReminder(appointment, scheduledAt = null) {
    return this.queueEvent({
      eventName: 'AppointmentReminder',
      variables: this.#appointmentVars(appointment),
      patientId: appointment.patientId || null,
      scheduledAt,
      channels: DEFAULT_EVENT_CHANNELS.AppointmentReminder,
    });
  }

  async sendAppointmentRescheduled(appointment) {
    return this.queueEvent({
      eventName: 'AppointmentConfirmed',
      variables: {
        ...this.#appointmentVars(appointment),
        summary: 'Appointment rescheduled',
      },
      patientId: appointment.patientId || null,
    });
  }

  #appointmentVars(appointment) {
    return {
      appointmentNumber: appointment.appointmentNumber || '',
      appointmentId: appointment.id || appointment._id?.toString?.() || '',
      patientName: appointment.patient?.fullName || appointment.patientName || 'Patient',
      date: appointment.date || appointment.appointmentDate || '',
      time: appointment.startTime || appointment.time || '',
      summary: `Appointment ${appointment.appointmentNumber || ''} confirmed`,
    };
  }

  // —— CRUD / inbox ——

  async list(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.notificationRepo.list({
      channel: query.channel || null,
      status: query.status || null,
      eventName: query.eventName || null,
      userId: query.userId || null,
      patientId: query.patientId || null,
      recipient: query.recipient || null,
      unreadOnly: query.unreadOnly === 'true' || query.unreadOnly === true,
      archived: query.archived === 'true' ? true : query.archived === 'false' ? false : undefined,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((n) => this.#map(n)),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * SEC-030 — `viewerUserId` (when non-null) restricts the read to notifications that are not
   * addressed to a specific member of staff, or are addressed to this one. A staff-addressed
   * notification belonging to somebody else answers 404, not 403: a 403 would confirm the id
   * exists and is someone's, which is the fact being protected.
   */
  async getById(id, { viewerUserId = null } = {}) {
    const doc = await this.notificationRepo.findById(id);
    if (!doc) throw ApiError.notFound('Notification not found');
    if (viewerUserId && doc.userId && String(doc.userId) !== String(viewerUserId)) {
      throw ApiError.notFound('Notification not found');
    }
    return this.#map(doc);
  }

  async inbox(userId, query = {}) {
    return this.list({
      ...query,
      userId,
      channel: NOTIFICATION_CHANNEL.IN_APP,
      archived: query.archived === 'true' ? 'true' : 'false',
    });
  }

  async unreadCount(userId) {
    return { count: await this.notificationRepo.unreadCount(userId) };
  }

  async markRead(id, userId) {
    const doc = await this.notificationRepo.findById(id);
    if (!doc) throw ApiError.notFound('Notification not found');
    if (doc.userId && userId && String(doc.userId) !== String(userId)) {
      throw ApiError.forbidden('Not your notification');
    }
    await this.notificationRepo.updateById(id, { readAt: new Date() });
    return this.#map(await this.notificationRepo.findById(id));
  }

  async markAllRead(userId) {
    await this.notificationRepo.model.updateMany(
      {
        userId,
        channel: NOTIFICATION_CHANNEL.IN_APP,
        readAt: null,
        archivedAt: null,
      },
      { $set: { readAt: new Date() } }
    );
    return this.unreadCount(userId);
  }

  async archive(id, userId) {
    const doc = await this.notificationRepo.findById(id);
    if (!doc) throw ApiError.notFound('Notification not found');
    if (doc.userId && userId && String(doc.userId) !== String(userId)) {
      throw ApiError.forbidden('Not your notification');
    }
    await this.notificationRepo.updateById(id, {
      archivedAt: new Date(),
      readAt: doc.readAt || new Date(),
    });
    return this.#map(await this.notificationRepo.findById(id));
  }

  // —— Templates ——

  async listTemplates(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.templateRepo.list({
      q: query.q || null,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((t) => t.toSafeObject()),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async getTemplate(id) {
    const doc = await this.templateRepo.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Template not found');
    return doc.toSafeObject();
  }

  async updateTemplate(id, payload, actorId, req = null) {
    const doc = await this.templateRepo.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Template not found');
    const updates = { updatedBy: actorId };
    for (const f of ['name', 'description', 'subject', 'body', 'isActive', 'channel', 'eventName']) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    if (payload.variables) updates.variables = payload.variables;
    await this.templateRepo.updateById(id, updates);
    await this.auditService.record(AUDIT_ACTIONS.NOTIFICATION_TEMPLATE_UPDATED, {
      actorId,
      metadata: { templateId: id, code: doc.code },
      req,
    });
    return (await this.templateRepo.findByIdNotDeleted(id)).toSafeObject();
  }

  async createTemplate(payload, actorId, req = null) {
    if (!payload.code || !payload.name || !payload.body) {
      throw ApiError.badRequest('code, name, body required');
    }
    const existing = await this.templateRepo.findByCode(payload.code);
    if (existing) throw ApiError.conflict('Template code already exists');
    const doc = await this.templateRepo.create({
      code: String(payload.code).toUpperCase(),
      name: payload.name,
      description: payload.description || null,
      eventName: payload.eventName || null,
      channel: payload.channel || 'ALL',
      subject: payload.subject || null,
      body: payload.body,
      variables: payload.variables || [],
      createdBy: actorId,
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.NOTIFICATION_TEMPLATE_UPDATED, {
      actorId,
      metadata: { templateId: doc._id.toString(), code: doc.code, created: true },
      req,
    });
    return doc.toSafeObject();
  }

  async reports() {
    const byStatus = await this.notificationRepo.model.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byChannel = await this.notificationRepo.model.aggregate([
      { $group: { _id: '$channel', count: { $sum: 1 } } },
    ]);
    const sent = byStatus.find((r) => r._id === NOTIFICATION_STATUS.SENT)?.count || 0;
    const failed = byStatus.find((r) => r._id === NOTIFICATION_STATUS.FAILED)?.count || 0;
    const total = byStatus.reduce((s, r) => s + r.count, 0);
    return {
      deliverySuccess: sent,
      failedMessages: failed,
      total,
      successRate: total ? Math.round((sent / total) * 1000) / 10 : 0,
      channelUsage: byChannel.map((r) => ({ channel: r._id, count: r.count })),
      byStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    };
  }

  async processBirthdayReminders() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const patients = await Patient.find({
      deletedAt: null,
      dateOfBirth: { $ne: null },
    })
      .limit(500)
      .exec();

    let queued = 0;
    for (const p of patients) {
      const dob = new Date(p.dateOfBirth);
      if (dob.getMonth() + 1 === month && dob.getDate() === day) {
        await this.queueEvent({
          eventName: 'BirthdayWishes',
          patientId: p._id.toString(),
          variables: {
            patientName: `${p.firstName} ${p.lastName || ''}`.trim(),
            summary: 'Happy Birthday!',
          },
          recipientOverrides: {
            SMS: p.mobile,
            WHATSAPP: p.mobile,
            EMAIL: p.email || undefined,
          },
        });
        queued += 1;
      }
    }
    return { queued };
  }

  /** Manual test helper — force immediate dispatch of queued items */
  async processPending(limit = 20) {
    const { items } = await this.notificationRepo.list({
      status: NOTIFICATION_STATUS.QUEUED,
      limit,
    });
    const results = [];
    for (const n of items) {
      results.push(await this.dispatchOne(n._id.toString()));
    }
    return { processed: results.length, results };
  }
}

export default NotificationService;
