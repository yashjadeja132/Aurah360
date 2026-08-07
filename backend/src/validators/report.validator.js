import { z } from 'zod';
import {
  DASHBOARD_TYPE_LIST,
  REPORT_TYPE_LIST,
  EXPORT_FORMAT_LIST,
  SCHEDULE_FREQUENCY_LIST,
  CHART_TYPE_LIST,
} from '../enums/report.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParamSchema = z.object({
  id: objectId,
});

export const dashboardParamSchema = z.object({
  type: z.enum(DASHBOARD_TYPE_LIST),
});

export const reportTypeParamSchema = z.object({
  type: z.enum(REPORT_TYPE_LIST),
});

export const chartTypeParamSchema = z.object({
  type: z.enum(CHART_TYPE_LIST),
});

export const filterQuerySchema = z
  .object({
    branchId: objectId.optional(),
    doctorId: objectId.optional(),
    departmentId: objectId.optional(),
    serviceId: objectId.optional(),
    paymentStatus: z.string().optional(),
    leadSource: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    format: z.enum(EXPORT_FORMAT_LIST).optional(),
    scope: z.string().optional(),
    isActive: z.union([z.string(), z.boolean()]).optional(),
  })
  .passthrough();

export const createScheduleSchema = z.object({
  name: z.string().min(2).max(120),
  reportType: z.enum(REPORT_TYPE_LIST),
  frequency: z.enum(SCHEDULE_FREQUENCY_LIST),
  format: z.enum(EXPORT_FORMAT_LIST).optional(),
  filters: z.record(z.any()).optional(),
  recipients: z.array(z.string().email()).optional(),
});

export const updateScheduleSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  frequency: z.enum(SCHEDULE_FREQUENCY_LIST).optional(),
  format: z.enum(EXPORT_FORMAT_LIST).optional(),
  filters: z.record(z.any()).optional(),
  recipients: z.array(z.string().email()).optional(),
  isActive: z.boolean().optional(),
});

export const saveFilterSchema = z.object({
  name: z.string().min(1).max(120),
  scope: z.string().min(1),
  filters: z.record(z.any()).optional(),
  isDefault: z.boolean().optional(),
});

export const queueExportSchema = z.object({
  format: z.enum(EXPORT_FORMAT_LIST).optional(),
  filters: z.record(z.any()).optional(),
});

export default {
  idParamSchema,
  dashboardParamSchema,
  reportTypeParamSchema,
  chartTypeParamSchema,
  filterQuerySchema,
  createScheduleSchema,
  updateScheduleSchema,
  saveFilterSchema,
  queueExportSchema,
};
