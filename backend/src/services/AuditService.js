import AuditLogRepository from '../repositories/AuditLogRepository.js';
import logger from '../libs/logger.js';

class AuditService {
  constructor() {
    this.auditLogRepository = new AuditLogRepository();
  }

  async record(
    action,
    {
      actorId = null,
      targetUserId = null,
      metadata = {},
      req = null,
      correlationId = null,
      branchId = null,
      resourceType = null,
      resourceId = null,
    } = {}
  ) {
    try {
      await this.auditLogRepository.log({
        action,
        actorId,
        targetUserId,
        metadata,
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
        // Auto-populate correlation id from the request's requestId/id when available,
        // falling back to an explicitly passed value (e.g. background jobs without a req).
        correlationId: correlationId || req?.requestId || req?.id || null,
        branchId,
        resourceType,
        resourceId,
      });
    } catch (error) {
      // Audit failures must not break primary flows
      logger.error('Audit log failed', { action, message: error.message });
    }
  }
}

export default AuditService;
