import { z } from 'zod';
import { objectId } from './common.js';

export const rosterQuerySchema = z.object({
  branchId: objectId.optional(),
  date: z.coerce.date().optional(),
});

export const staffLeaveParamSchema = z.object({ userId: objectId });

export const staffLeaveIdParamSchema = z.object({ userId: objectId, leaveId: objectId });

export const createStaffLeaveSchema = z.object({
  leaveType: z.enum(['FULL_DAY', 'HALF_DAY', 'CUSTOM']).optional(),
  branchId: objectId.optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().min(1).max(500),
});

export default {
  rosterQuerySchema,
  staffLeaveParamSchema,
  staffLeaveIdParamSchema,
  createStaffLeaveSchema,
};
