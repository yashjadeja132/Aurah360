import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const queueIdParamSchema = z.object({ id: objectId });

export const branchQueueQuerySchema = z.object({
  branchId: objectId,
  date: z.string().optional(),
});

export const doctorQueueQuerySchema = z.object({
  doctorId: objectId,
  date: z.string().optional(),
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
});
