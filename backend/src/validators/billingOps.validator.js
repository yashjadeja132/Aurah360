import { z } from 'zod';
import { objectId } from './common.js';

export const submitCashCloseSchema = z.object({
  branchId: objectId,
  closeDate: z.coerce.date(),
  openingCash: z.coerce.number().min(0),
  cashCollected: z.coerce.number().min(0),
  cashRefunded: z.coerce.number().min(0).optional(),
  otherModeCollected: z.coerce.number().min(0).optional(),
  countedCash: z.coerce.number().min(0),
  varianceReason: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const createFeeScheduleSchema = z.object({
  serviceId: objectId,
  branchId: objectId.optional().nullable(),
  doctorId: objectId.optional().nullable(),
  price: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export const idParamSchema = z.object({ id: objectId });

export default { submitCashCloseSchema, createFeeScheduleSchema, idParamSchema };
