import BaseRepository from './BaseRepository.js';
import AuditLog from '../models/AuditLog.model.js';

class AuditLogRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }

  async log({
    action,
    actorId = null,
    targetUserId = null,
    metadata = {},
    ipAddress = null,
    userAgent = null,
    correlationId = null,
    branchId = null,
    resourceType = null,
    resourceId = null,
  }) {
    return this.model.create({
      action,
      actorId,
      targetUserId,
      metadata,
      ipAddress,
      userAgent,
      correlationId,
      branchId,
      resourceType,
      resourceId,
    });
  }
}

export default AuditLogRepository;
