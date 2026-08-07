import { z } from 'zod';
import { ROLES } from '../constants/roles.js';
import { GENDER } from '../enums/gender.js';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')
  .optional()
  .nullable();

const staffRoles = [
  ROLES.ADMIN,
  ROLES.BRANCH_MANAGER,
  ROLES.DOCTOR,
  ROLES.RECEPTIONIST,
  ROLES.NURSE,
  ROLES.TECHNICIAN,
  ROLES.CASHIER,
  ROLES.PHARMACIST,
  ROLES.CRM_EXECUTIVE,
];

export const staffRoleEnum = z.enum(staffRoles);

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');

export const createStaffSchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  phone: z.string().min(8).max(20).optional().nullable(),
  password: passwordSchema,
  role: staffRoleEnum,
  permissions: z.array(z.string()).optional().default([]),
  branch: objectId,
  department: z.string().max(120).optional().nullable(),
  designation: z.string().max(120).optional().nullable(),
  employeeId: z.string().max(60).optional().nullable(),
  profileImage: z.string().optional().nullable(),
  gender: z.enum([
    GENDER.MALE,
    GENDER.FEMALE,
    GENDER.OTHER,
    GENDER.PREFER_NOT_TO_SAY,
  ]).optional().nullable(),
  dob: z.coerce.date().optional().nullable(),
  mustChangePassword: z.boolean().optional(),
});

export const updateStaffSchema = z.object({
  firstName: z.string().min(1).max(80).trim().optional(),
  lastName: z.string().min(1).max(80).trim().optional(),
  email: z.string().email().transform((v) => v.toLowerCase().trim()).optional(),
  phone: z.string().min(8).max(20).optional().nullable(),
  role: staffRoleEnum.optional(),
  permissions: z.array(z.string()).optional(),
  branch: objectId,
  department: z.string().max(120).optional().nullable(),
  designation: z.string().max(120).optional().nullable(),
  employeeId: z.string().max(60).optional().nullable(),
  profileImage: z.string().optional().nullable(),
  gender: z.enum([
    GENDER.MALE,
    GENDER.FEMALE,
    GENDER.OTHER,
    GENDER.PREFER_NOT_TO_SAY,
  ]).optional().nullable(),
  dob: z.coerce.date().optional().nullable(),
});

export const listStaffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  role: z.enum([
    ROLES.OWNER,
    ROLES.ADMIN,
    ROLES.BRANCH_MANAGER,
    ROLES.DOCTOR,
    ROLES.RECEPTIONIST,
    ROLES.NURSE,
    ROLES.TECHNICIAN,
    ROLES.CASHIER,
    ROLES.PHARMACIST,
    ROLES.CRM_EXECUTIVE,
  ]).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  branch: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user id'),
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(80).trim().optional(),
  lastName: z.string().min(1).max(80).trim().optional(),
  phone: z.string().min(8).max(20).optional().nullable(),
  profileImage: z.string().optional().nullable(),
  gender: z.enum([
    GENDER.MALE,
    GENDER.FEMALE,
    GENDER.OTHER,
    GENDER.PREFER_NOT_TO_SAY,
  ]).optional().nullable(),
  dob: z.coerce.date().optional().nullable(),
});
