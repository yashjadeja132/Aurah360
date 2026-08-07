import BaseRepository from './BaseRepository.js';
import Notification from '../models/Notification.model.js';
import NotificationTemplate from '../models/NotificationTemplate.model.js';
import { NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } from '../enums/notification.js';

export class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  async findByNotificationId(notificationId) {
    return this.model.findOne({ notificationId }).exec();
  }

  async list({
    channel,
    status,
    eventName,
    userId,
    patientId,
    recipient,
    unreadOnly,
    archived,
    limit = 50,
    skip = 0,
  } = {}) {
    const filter = {};
    if (channel) filter.channel = channel;
    if (status) filter.status = status;
    if (eventName) filter.eventName = eventName;
    if (userId) filter.userId = userId;
    if (patientId) filter.patientId = patientId;
    if (recipient) filter.recipient = new RegExp(recipient, 'i');
    if (unreadOnly) filter.readAt = null;
    if (archived === true) filter.archivedAt = { $ne: null };
    else if (archived === false) filter.archivedAt = null;

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async unreadCount(userId) {
    return this.model
      .countDocuments({
        userId,
        channel: NOTIFICATION_CHANNEL.IN_APP,
        readAt: null,
        archivedAt: null,
        status: { $in: [NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.QUEUED] },
      })
      .exec();
  }
}

export class NotificationTemplateRepository extends BaseRepository {
  constructor() {
    super(NotificationTemplate);
  }

  async findByCode(code) {
    return this.model.findOne({ code, deletedAt: null, isActive: true }).exec();
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async list({ q, limit = 50, skip = 0 } = {}) {
    const filter = { deletedAt: null };
    if (q) {
      filter.$or = [
        { code: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') },
        { eventName: new RegExp(q, 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ code: 1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export default { NotificationRepository, NotificationTemplateRepository };
