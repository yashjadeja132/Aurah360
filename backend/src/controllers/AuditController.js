import ApiError from '../libs/ApiError.js';
import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import AuditService from '../services/AuditService.js';
import { resolveBranchScope } from '../helpers/scope.helper.js';
import { hasAnyPermission } from '../helpers/permission.helper.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { ROLES } from '../constants/roles.js';

/**
 * NFR-018 / §14.2 — the audit trail's read side.
 *
 * `AuditService` write coverage was already broad and genuine (~196 action types, correlation ids,
 * a retention TTL), but `AuditLogRepository` was not read by a single controller or route: the
 * audit log was write-only from the API's perspective. Collecting evidence that can never be
 * produced is not an audit trail, it is storage cost — an auditor asking "who opened this
 * patient's record last March" or an incident responder tracing a correlation id had no answer
 * short of direct database access.
 *
 * This endpoint returns the most sensitive data in the system, so three gates apply and each one
 * is deliberate:
 *
 *  1. PERMISSION. `audit.view`, held only by OWNER and ADMIN in the seeded role map. The route
 *     does not accept any wildcard as a substitute.
 *  2. BRANCH SCOPE. `resolveBranchScope` — the same helper every other list uses. Today's holders
 *     are both global-scope roles so it is a no-op for them, but roles are database-backed and
 *     editable: the moment someone grants `audit.view` to a branch-pinned custom role, that role
 *     is confined to rows carrying their branch, without anyone having to remember to add the pin.
 *  3. METADATA. Redacted unless the caller additionally holds `audit.metadata_view` AND asks for
 *     it explicitly (see AuditService's redaction docblock for what survives and why).
 *
 * The read is itself audited, in AuditService#search, alongside the filter that produced it.
 */
class AuditController {
  constructor() {
    this.service = new AuditService();
  }

  /**
   * Whether this caller may see unredacted metadata. Asking without the grant is a 403, not a
   * silent downgrade: an auditor who believes they are holding complete evidence must never be
   * handed a redacted set without being told.
   */
  #resolveMetadataAccess(req) {
    const requested = req.query?.includeMetadata === true;
    if (!requested) return false;

    const permitted =
      req.auth?.role === ROLES.OWNER
      || hasAnyPermission(req.auth?.permissions || [], [PERMISSIONS.AUDIT_METADATA_VIEW]);
    if (!permitted) {
      throw ApiError.forbidden(
        'You may search the audit trail but not read the unredacted details of an entry.',
        'AUDIT_METADATA_NOT_PERMITTED'
      );
    }
    return true;
  }

  search = asyncHandler(async (req, res) => {
    const branchId = resolveBranchScope(req);
    const includeMetadata = this.#resolveMetadataAccess(req);

    const result = await this.service.search(req.query, {
      branchId,
      includeMetadata,
      actorId: req.auth.userId,
      req,
    });

    return ApiResponse.success(res, {
      message: 'Audit entries retrieved',
      data: { entries: result.items },
      meta: result.meta,
    });
  });
}

export default AuditController;
