import AuditLogRepository from '../repositories/AuditLogRepository.js';
import logger from '../libs/logger.js';
import { AUDIT_ACTIONS, AUDIT_ACTIONS_BY_FAMILY } from '../enums/auditAction.js';

/**
 * NFR-018 — METADATA REDACTION POLICY.
 *
 * `AuditLog.metadata` is `Schema.Types.Mixed`: ~50 services write whatever context made sense at
 * the call site, and a good deal of it is PHI. Real examples already in the codebase: the previous
 * and new TITLE of a renamed report (PatientDocumentService#rename), the free-text REASON on a
 * break-glass grant or a treatment hard-stop override, the matched restricted BODY REGION on a
 * blocked photo capture, diagnosis text on an EMR amendment. Returning that blob verbatim from a
 * search endpoint would turn "show me who touched this record" into a bulk PHI export.
 *
 * So the default view is REDACTED, by value shape rather than by key name — a key-name allowlist
 * silently leaks every new key a future service invents, whereas this fails closed:
 *
 *   KEPT   — booleans, numbers, dates, 24-hex ObjectId strings, ISO date strings, and
 *            SCREAMING_SNAKE enum tokens (statuses, states, channels, action names).
 *   DROPPED— every other string, replaced with '[redacted]'. Free text is exactly the shape PHI
 *            arrives in, so anything that is not structurally an id/enum/number is withheld.
 *
 * What survives is enough to do the job an audit search exists for: correlate a sequence of
 * actions, follow ids between rows, and see the state a record moved through. What does not
 * survive is the narrative detail.
 *
 * The unredacted blob requires the separate AUDIT_METADATA_VIEW permission (OWNER only by seed)
 * and is itself audited under AUDIT_LOG_METADATA_REVEALED. Nesting is capped so a pathological
 * metadata object cannot make redaction the expensive part of the request.
 */
const REDACTED = '[redacted]';
const MAX_REDACTION_DEPTH = 5;
const MAX_ARRAY_ITEMS = 50;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const ENUM_TOKEN_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([T ]|$)/;

const isSafeString = (value) =>
  OBJECT_ID_PATTERN.test(value) || ENUM_TOKEN_PATTERN.test(value) || ISO_DATE_PATTERN.test(value);

const redactValue = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return isSafeString(value) ? value : REDACTED;
  if (depth >= MAX_REDACTION_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, redactValue(nested, depth + 1)])
    );
  }
  // Anything else (function, symbol, bigint) is not something a service should be logging.
  return REDACTED;
};

export const redactAuditMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return {};
  return redactValue(metadata, 0);
};

const asDate = (value) => (value ? new Date(value) : null);

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

  /**
   * Translates the validated query into a Mongo filter.
   *
   * `branchId` is NOT taken from the query here — the controller resolves it through
   * `resolveBranchScope` and passes the answer in, so a caller cannot widen their own reach by
   * typing a branch id. A branch-pinned caller sees ONLY rows that carry their branch: rows with
   * `branchId: null` (the majority — most `record()` call sites never pass one) are withheld
   * rather than shown to everyone, because an unbranched row may well concern another site and
   * fail-closed is the only safe default for this collection.
   *
   * `patientId` has no column of its own. Almost every PHI-touching call site puts the patient in
   * `metadata.patientId`, and a few identify them through `resourceType/resourceId`, so both are
   * matched — otherwise "every access to this patient's record", the single most-asked audit
   * question, would return a partial and misleading answer.
   */
  #buildFilter(query = {}, branchId = null) {
    const filter = {};
    const and = [];

    if (query.action) filter.action = query.action;
    // Family narrows further: if both are given, `action` must also belong to the family, or the
    // combination is contradictory and should return nothing rather than silently widen to
    // the whole family (which would ignore the caller's explicit `action`).
    if (query.family) {
      const familyActions = AUDIT_ACTIONS_BY_FAMILY[query.family] || [];
      if (query.action) {
        filter.action = familyActions.includes(query.action) ? query.action : { $in: [] };
      } else {
        filter.action = { $in: familyActions };
      }
    }
    if (query.actorId) filter.actorId = query.actorId;
    if (query.targetUserId) filter.targetUserId = query.targetUserId;
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.resourceId) filter.resourceId = query.resourceId;
    if (query.correlationId) filter.correlationId = query.correlationId;
    if (branchId) filter.branchId = branchId;

    const from = asDate(query.from);
    const to = asDate(query.to);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    if (query.patientId) {
      const patientId = String(query.patientId);
      and.push({
        $or: [
          { 'metadata.patientId': patientId },
          { resourceType: 'Patient', resourceId: patientId },
        ],
      });
    }

    if (and.length) filter.$and = and;
    return filter;
  }

  /**
   * NFR-018 — the authorised audit search. Access control lives in the route
   * (`requirePermission(AUDIT_VIEW)`) and the controller (branch scope, metadata gate); this
   * method owns the query shape and the PHI decision that follows from `includeMetadata`.
   *
   * The read is recorded before the rows are handed back, with the filter that produced them and
   * the number of rows returned. That row is what makes a fishing expedition against the audit
   * trail visible to the next person who reads it.
   */
  async search(query = {}, { branchId = null, includeMetadata = false, actorId = null, req = null } = {}) {
    const filter = this.#buildFilter(query, branchId);
    const result = await this.auditLogRepository.search({
      filter,
      page: query.page || 1,
      limit: query.limit || 20,
    });

    const items = result.items.map((entry) => {
      const safe = entry.toSafeObject();
      return includeMetadata
        ? { ...safe, metadataRedacted: false }
        : { ...safe, metadata: redactAuditMetadata(safe.metadata), metadataRedacted: true };
    });

    await this.record(AUDIT_ACTIONS.AUDIT_LOG_SEARCHED, {
      actorId,
      branchId,
      req,
      metadata: {
        filter: {
          action: query.action || null,
          family: query.family || null,
          actorId: query.actorId || null,
          targetUserId: query.targetUserId || null,
          resourceType: query.resourceType || null,
          resourceId: query.resourceId || null,
          patientId: query.patientId || null,
          correlationId: query.correlationId || null,
          from: query.from || null,
          to: query.to || null,
          branchId: branchId || null,
        },
        page: result.page,
        limit: result.limit,
        returned: items.length,
        total: result.total,
        includeMetadata,
      },
    });

    if (includeMetadata) {
      // Separate row: revealing PHI is a materially different act from searching, and an auditor
      // reviewing the reviewers should be able to find these without parsing a flag on a filter.
      await this.record(AUDIT_ACTIONS.AUDIT_LOG_METADATA_REVEALED, {
        actorId,
        branchId,
        req,
        metadata: { returned: items.length, total: result.total },
      });
    }

    return {
      items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        metadataRedacted: !includeMetadata,
      },
    };
  }
}

export default AuditService;
