import { z } from 'zod';
import { objectId } from './common.js';
import { HANDOFF_CATEGORY_LIST, HANDOFF_URGENCY_LIST } from '../enums/patient.js';

export const createHandoffSchema = z.object({
  patientId: objectId,
  branchId: objectId,
  appointmentId: objectId.optional().nullable(),
  category: z.enum(HANDOFF_CATEGORY_LIST),
  urgency: z.enum(HANDOFF_URGENCY_LIST).optional(),
  note: z.string().min(1).max(2000),
  assignedDoctorId: objectId.optional().nullable(),
});

export const acknowledgeHandoffSchema = z.object({
  resolutionNote: z.string().max(2000).optional().nullable(),
});

export const amendHandoffSchema = z.object({
  text: z.string().min(1).max(2000),
  reason: z.string().min(1).max(500),
});

export const patientIdParamSchema = z.object({ patientId: objectId });
export const doctorIdParamSchema = z.object({ doctorId: objectId });

export default {
  createHandoffSchema,
  acknowledgeHandoffSchema,
  amendHandoffSchema,
  patientIdParamSchema,
  doctorIdParamSchema,
};
