import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const queueIdParamSchema = z.object({ id: objectId });

// SEC-030 — branchId/doctorId are optional here because both are resolved server-side from the
// caller's token (branch for every non-OWNER/ADMIN role, doctorId for a DOCTOR). The controllers
// still reject a request when neither the token nor the query yields the required id, so callers
// that legitimately choose a branch/doctor (reception) behave exactly as before.
// PRD §6.5 — `view=PUBLIC` marks the request as coming from a waiting-room display, which the
// controller answers with a masked (token + initials) payload. Default is the staff board.
const queueViewSchema = z.enum(['STAFF', 'PUBLIC']).optional();

export const branchQueueQuerySchema = z.object({
  branchId: objectId.optional(),
  date: z.string().optional(),
  view: queueViewSchema,
});

export const doctorQueueQuerySchema = z.object({
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
  date: z.string().optional(),
  view: queueViewSchema,
});

export const callNextSchema = z.object({
  doctorId: objectId,
});

export const transferQueueSchema = z.object({
  doctorId: objectId,
  reason: z.string().min(3).max(500),
  branchId: objectId.optional().nullable(),
});

export const reorderQueueSchema = z.object({
  beforeId: objectId.optional().nullable(),
  afterId: objectId.optional().nullable(),
  /** A2 — a priority jump always needs a typed justification for the audit trail. */
  reason: z.string().min(3).max(500),
});
