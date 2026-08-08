import { z } from 'zod';
import { objectId } from './common.js';
import { AUDIT_ACTION_LIST } from '../enums/auditAction.js';

/**
 * NFR-018 — audit search query.
 *
 * A field absent from this schema is DELETED from `req.query` before the controller sees it, so
 * this list is the complete set of ways the trail can be sliced. `branchId` is accepted so a
 * global-scope caller (OWNER/ADMIN) can narrow to one site; it is NOT authoritative — the
 * controller runs it through `resolveBranchScope`, which rejects any value that would widen a
 * branch-pinned caller's reach.
 *
 * `action` is validated against the enum rather than left as a free string: an unknown action can
 * only ever return nothing, and echoing it back as a filter would let the endpoint be used to
 * probe which action names exist.
 *
 * `limit` is capped at 100 for the same reason every other list is — the audit collection is the
 * largest in the system and is the one place a generous page size doubles as a bulk export.
 */
export const searchAuditLogQuerySchema = z.object({
  action: z.enum(AUDIT_ACTION_LIST).optional(),
  actorId: objectId.optional(),
  targetUserId: objectId.optional(),
  patientId: objectId.optional(),
  resourceType: z.string().min(1).max(60).optional(),
  resourceId: z.string().min(1).max(120).optional(),
  correlationId: z.string().min(1).max(120).optional(),
  branchId: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  /**
   * Opt-in, never the default: asking for the unredacted `metadata` blob requires
   * AUDIT_METADATA_VIEW and is refused (403) rather than silently downgraded, so a caller who
   * believes they are reading complete evidence is never handed a redacted set without knowing.
   */
  includeMetadata: z
    .enum(['true', 'false', '1', '0'])
    .transform((value) => value === 'true' || value === '1')
    .optional(),
});

export default { searchAuditLogQuerySchema };
