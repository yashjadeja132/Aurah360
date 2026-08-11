import { z } from 'zod';
import {
  FOLLOW_UP_TYPE_LIST,
  LEAD_PRIORITY_LIST,
  LEAD_STATUS_LIST,
  LEAD_TASK_ASSIGNEE_ROLE_LIST,
  LEAD_TASK_STATUS_LIST,
} from '../enums/crm.js';
import { GENDER_LIST } from '../enums/gender.js';
import { PATIENT_SOURCE_CATEGORY_LIST } from '../enums/patient.js';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const idParamSchema = z.object({ id: objectId });

export const leadListQuerySchema = z.object({
  branchId: objectId.optional(),
  status: z.enum(LEAD_STATUS_LIST).optional(),
  assignedTo: objectId.optional(),
  source: z.string().optional(),
  q: z.string().optional(),
  priority: z.enum(LEAD_PRIORITY_LIST).optional(),
  followUpBefore: z.string().optional(),
  followUpAfter: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const createLeadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  phone: z.string().min(8),
  alternatePhone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  gender: z.enum(GENDER_LIST).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  city: z.string().optional().nullable(),
  sourceId: objectId.optional().nullable(),
  source: z.string().optional().nullable(),
  sourceCategory: z.enum(PATIENT_SOURCE_CATEGORY_LIST).optional().nullable(),
  campaign: z.string().optional().nullable(),
  adSet: z.string().optional().nullable(),
  keyword: z.string().optional().nullable(),
  referralCode: z.string().optional().nullable(),
  referrerPatientId: objectId.optional().nullable(),
  branchId: objectId,
  assignedTo: objectId.optional().nullable(),
  interestedServices: z.array(z.string()).optional(),
  budget: z.number().min(0).optional().nullable(),
  priority: z.enum(LEAD_PRIORITY_LIST).optional(),
  remarks: z.string().optional().nullable(),
  nextFollowUp: z.string().or(z.date()).optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial().omit({ branchId: true });

export const assignLeadSchema = z.object({
  assignedTo: objectId,
});

export const statusSchema = z.object({
  status: z.enum(LEAD_STATUS_LIST),
  lostReason: z.string().optional().nullable(),
});

export const followUpSchema = z.object({
  date: z.string().or(z.date()).optional(),
  type: z.enum(FOLLOW_UP_TYPE_LIST),
  notes: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  nextFollowUp: z.string().or(z.date()).optional().nullable(),
  assignedTo: objectId.optional().nullable(),
});

export const convertSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.enum(GENDER_LIST).optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  primaryBranchId: objectId.optional(),
  primaryDoctorId: objectId.optional().nullable(),
  city: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  /** PAT-DUP — lead conversion creates a Patient, so it needs the same deliberate override. */
  allowDuplicate: z.coerce.boolean().optional(),
  /** LOY Flow C — referring patient's code, entered by the counsellor on this lead's behalf. */
  referralCode: z.string().trim().max(20).optional().nullable(),
});

export const createTaskSchema = z.object({
  leadId: objectId,
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assigneeRole: z.enum(LEAD_TASK_ASSIGNEE_ROLE_LIST).optional().nullable(),
  assignedTo: objectId.optional().nullable(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  reminderAt: z.string().or(z.date()).optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  assigneeRole: z.enum(LEAD_TASK_ASSIGNEE_ROLE_LIST).optional().nullable(),
  assignedTo: objectId.optional().nullable(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  reminderAt: z.string().or(z.date()).optional().nullable(),
  status: z.enum(LEAD_TASK_STATUS_LIST).optional(),
});

export const communicationSchema = z.object({
  channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'PHONE', 'CALL']),
  notes: z.string().optional().nullable(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
});

export const reportTypeParamSchema = z.object({
  type: z.enum(['source', 'conversion', 'counsellor', 'lost-reasons']),
});

export const taskListQuerySchema = z.object({
  leadId: objectId.optional(),
  assignedTo: objectId.optional(),
  status: z.enum(LEAD_TASK_STATUS_LIST).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
