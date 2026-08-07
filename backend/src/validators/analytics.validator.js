import { z } from 'zod';
import { ANALYTICS_CATEGORY_LIST, ANALYTICS_PERIOD_LIST } from '../enums/analytics.js';
import { EXPORT_FORMAT_LIST } from '../enums/report.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const categoryParamSchema = z.object({
  category: z.enum(ANALYTICS_CATEGORY_LIST),
});

export const analyticsQuerySchema = z
  .object({
    branchId: objectId.optional(),
    doctorId: objectId.optional(),
    departmentId: objectId.optional(),
    serviceId: objectId.optional(),
    paymentStatus: z.string().optional(),
    paymentMethod: z.string().optional(),
    leadSource: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    period: z.enum(ANALYTICS_PERIOD_LIST).optional(),
    format: z.enum([...EXPORT_FORMAT_LIST, 'xlsx']).optional(),
  })
  .passthrough();

export const queueExportSchema = z.object({
  format: z.enum([...EXPORT_FORMAT_LIST, 'xlsx']).optional(),
  filters: z.record(z.any()).optional(),
});

export default {
  categoryParamSchema,
  analyticsQuerySchema,
  queueExportSchema,
};
