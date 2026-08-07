import { z } from 'zod';

export const doctorFormSchema = z.object({
  userId: z.string().optional().nullable(),
  doctorCode: z.string().min(2, 'Code required'),
  licenseNumber: z.string().min(2, 'License required'),
  registrationNumber: z.string().min(2, 'Registration required'),
  qualification: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  experienceYears: z.coerce.number().min(0).optional(),
  consultationDuration: z.coerce.number().min(5).optional(),
  consultationFee: z.coerce.number().min(0).optional(),
  followUpFee: z.coerce.number().min(0).optional(),
  branches: z.array(z.string()).min(1, 'Select at least one branch'),
  departments: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
  languages: z.string().optional(),
  gender: z.string().optional().nullable(),
  colorCode: z.string().optional(),
  isAvailableOnline: z.boolean().optional(),
  bio: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  // userId required only when creating (presence of empty string from create form)
  if (data.userId === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a doctor user', path: ['userId'] });
  }
});

export const leaveFormSchema = z.object({
  leaveType: z.enum(['FULL_DAY', 'HALF_DAY', 'CUSTOM']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
});
