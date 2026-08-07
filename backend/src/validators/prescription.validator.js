import { z } from 'zod';
import {
  DOSAGE_FORM_LIST,
  MEDICINE_ROUTE_LIST,
  PRESCRIPTION_STATUS_LIST,
} from '../enums/prescription.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const medicineItemSchema = z.object({
  medicineId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  medicineName: z.string().min(1).max(200).optional(),
  genericName: z.string().max(200).optional().nullable(),
  strength: z.string().max(100).optional().nullable(),
  dosage: z.string().max(100).optional().nullable(),
  frequency: z.string().max(100).optional().nullable(),
  duration: z.string().max(100).optional().nullable(),
  route: z.enum(MEDICINE_ROUTE_LIST).optional(),
  instructions: z.string().max(1000).optional().nullable(),
  quantity: z.coerce.number().min(0).optional().nullable(),
  morning: z.boolean().optional(),
  afternoon: z.boolean().optional(),
  night: z.boolean().optional(),
  beforeFood: z.boolean().optional(),
  afterFood: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

export const createPrescriptionSchema = z.object({
  consultationId: objectId,
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(medicineItemSchema).min(1),
});

export const updatePrescriptionSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(medicineItemSchema).min(1).optional(),
});

export const prescriptionIdParamSchema = z.object({ id: objectId });
export const consultationIdParamSchema = z.object({ consultationId: objectId });
export const patientIdParamSchema = z.object({ patientId: objectId });

export const doctorQuerySchema = z.object({
  doctorId: objectId,
  status: z.enum(PRESCRIPTION_STATUS_LIST).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const medicineSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const medicineListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const createMedicineSchema = z.object({
  medicineCode: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional().nullable(),
  brand: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  strength: z.string().max(100).optional().nullable(),
  dosageForm: z.enum(DOSAGE_FORM_LIST).optional().nullable(),
  defaultRoute: z.enum(MEDICINE_ROUTE_LIST).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  mrp: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateMedicineSchema = createMedicineSchema.partial();

export const templateCreateSchema = z.object({
  doctorId: objectId,
  name: z.string().min(1).max(200),
  isFavorite: z.boolean().optional(),
  medicineId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  items: z.array(medicineItemSchema).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const applyTemplateSchema = z.object({
  consultationId: objectId,
});
