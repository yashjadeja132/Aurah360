import BaseRepository from './BaseRepository.js';
import AuditLog from '../models/AuditLog.model.js';
import { paginateModel } from '../helpers/paginate.helper.js';

class AuditLogRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }

  /**
   * NFR-018 — the READ side of the audit trail. This repository had `log()` and nothing else, so
   * the audit log was write-only from the API's point of view: ~196 action types were being
   * recorded and no endpoint could ever produce one of them for an auditor or an incident review.
   *
   * The filter is built by AuditService (which is where the scoping and PHI decisions live); this
   * method deliberately holds no policy. Sort is fixed to `createdAt` descending — an audit review
   * always reads newest-first, and leaving the sort field caller-controlled would let a caller
   * page the collection in an order that hides recent activity behind older rows.
   *
   * `paginateModel` also applies `deletedAt: null`. Audit rows have no `deletedAt` field and are
   * never soft-deleted, and a Mongo `null` match includes missing fields, so this is a no-op here
   * rather than a filter — using the shared helper keeps paging identical to every other list.
   */
  async search({ filter = {}, page = 1, limit = 20 } = {}) {
    return paginateModel(this.model, {
      filter,
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      allowedSort: ['createdAt'],
    });
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
