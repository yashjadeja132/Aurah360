import { z } from 'zod';
import { objectId } from './common.js';
import { PRIVACY_REQUEST_TYPE_LIST, PRIVACY_REQUEST_STATUS_LIST } from '../enums/privacy.js';

export const breakGlassSchema = z.object({
  patientId: objectId.optional().nullable(),
  resourceType: z.string().min(1).max(60),
  resourceId: z.string().max(120).optional().nullable(),
  reason: z.string().min(1).max(500),
});

export const openPrivacyRequestSchema = z.object({
  patientId: objectId,
  type: z.enum(PRIVACY_REQUEST_TYPE_LIST),
  description: z.string().max(2000).optional().nullable(),
  dueDate: z.coerce.date().optional(),
  ownerId: objectId.optional().nullable(),
});

export const resolvePrivacyRequestSchema = z.object({
  status: z.enum(PRIVACY_REQUEST_STATUS_LIST),
  resolutionNotes: z.string().max(2000).optional().nullable(),
  denialReason: z.string().max(1000).optional().nullable(),
  exceptionReasoned: z.string().max(1000).optional().nullable(),
});

export const idParamSchema = z.object({ id: objectId });

export default { breakGlassSchema, openPrivacyRequestSchema, resolvePrivacyRequestSchema, idParamSchema };
