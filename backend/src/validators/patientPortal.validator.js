import { z } from 'zod';
import { PRIVACY_REQUEST_TYPE_LIST } from '../enums/privacy.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParamSchema = z.object({ id: objectId });
export const paymentIdParamSchema = z.object({ paymentId: objectId });
export const dependentIdParamSchema = z.object({ dependentId: objectId });

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    mobile: z.string().min(8).max(20).optional(),
    password: z.string().min(1),
  })
  .refine((d) => d.email || d.mobile, { message: 'Email or mobile is required' });

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export const forgotSchema = z.object({
  email: z.string().email(),
});

export const requestOtpSchema = z.object({
  mobile: z.string().min(8).max(20),
});

export const otpLoginSchema = z.object({
  mobile: z.string().min(8).max(20),
  code: z.string().min(4).max(6),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const profileUpdateSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    middleName: z.string().optional().nullable(),
    lastName: z.string().min(1).optional(),
    alternateMobile: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    preferredLanguage: z.string().optional(),
    occupation: z.string().optional().nullable(),
    photo: z.string().optional().nullable(),
    address: z.record(z.any()).optional(),
    emergencyContact: z.record(z.any()).optional(),
    medical: z.record(z.any()).optional(),
  })
  .passthrough();

export const bookAppointmentSchema = z.object({
  doctorId: objectId,
  branchId: objectId.optional(),
  departmentId: objectId.optional(),
  serviceId: objectId.optional(),
  appointmentDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  appointmentType: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
  // APT-003 — lets a patient submit a custom/unavailable time as a request instead of a
  // pre-validated open slot; AppointmentService.create() already holds this as Pending
  // Approval (skipping slot-claim validation) for the web receptionist flow — this just lets
  // the same flag reach it from the patient portal booking endpoint.
  requiresApproval: z.boolean().optional(),
});

export const cancelSchema = z.object({
  reason: z.string().optional(),
});

export const rescheduleSchema = z.object({
  appointmentDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  doctorId: objectId.optional(),
  reason: z.string().optional(),
});

export const feedbackSchema = z.object({
  clinicRating: z.number().int().min(1).max(5),
  doctorRating: z.number().int().min(1).max(5).optional().nullable(),
  doctorId: objectId.optional().nullable(),
  appointmentId: objectId.optional().nullable(),
  comments: z.string().max(2000).optional().nullable(),
  suggestions: z.string().max(2000).optional().nullable(),
});

export const submitPrivacyRequestSchema = z.object({
  requestType: z.enum(PRIVACY_REQUEST_TYPE_LIST),
  details: z.string().max(2000).optional().nullable(),
});

export default {
  loginSchema,
  refreshSchema,
  forgotSchema,
  changePasswordSchema,
  profileUpdateSchema,
  bookAppointmentSchema,
  cancelSchema,
  rescheduleSchema,
  feedbackSchema,
  submitPrivacyRequestSchema,
  idParamSchema,
  dependentIdParamSchema,
};
