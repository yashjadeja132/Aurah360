import { z } from 'zod';

export const staffFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  email: z.string().email('Valid email required'),
  phone: z.string().optional().nullable(),
  password: z.string().optional().or(z.literal('')),
  role: z.enum([
    'ADMIN',
    'BRANCH_MANAGER',
    'DOCTOR',
    'RECEPTIONIST',
    'NURSE',
    'TECHNICIAN',
    'CASHIER',
    'PHARMACIST',
    'CRM_EXECUTIVE',
  ]),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
});

export const createStaffSchema = staffFormSchema.extend({
  password: z
    .string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Za-z]/, 'Include a letter')
    .regex(/[0-9]/, 'Include a number'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z
      .string()
      .min(8, 'Min 8 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const profileSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
