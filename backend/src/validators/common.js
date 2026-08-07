import { z } from 'zod';

/** Shared Zod primitives — prefer these over per-file copies going forward. */

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const idParamSchema = z.object({
  id: objectId,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  sort: z.string().max(80).optional(),
});

export const strongPasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number');

export default {
  objectId,
  emptyToNull,
  timeRegex,
  idParamSchema,
  paginationQuerySchema,
  strongPasswordSchema,
};
