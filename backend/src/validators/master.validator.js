import { z } from 'zod';
import { MASTER_SLUG_TO_TYPE, MASTER_TYPES } from '../constants/masterTypes.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const masterTypeParamSchema = z.object({
  masterType: z.string().refine((v) => Boolean(MASTER_SLUG_TO_TYPE[v]), {
    message: 'Invalid master type',
  }),
});

export const masterIdParamSchema = masterTypeParamSchema.extend({
  id: objectId,
});

const baseMasterSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  code: z.string().max(40).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  color: z.string().max(30).optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export const createMasterBodySchema = baseMasterSchema;

export const createServiceBodySchema = baseMasterSchema.extend({
  categoryId: objectId,
  durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  price: z.coerce.number().min(0).optional(),
});

export const updateMasterBodySchema = baseMasterSchema.partial().extend({
  categoryId: objectId.optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  price: z.coerce.number().min(0).optional(),
});

export const listMasterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  categoryId: objectId.optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export function getCreateMasterSchema(masterTypeSlug) {
  const type = MASTER_SLUG_TO_TYPE[masterTypeSlug];
  if (type === MASTER_TYPES.SERVICE) return createServiceBodySchema;
  return createMasterBodySchema;
}

export function getUpdateMasterSchema() {
  return updateMasterBodySchema;
}
