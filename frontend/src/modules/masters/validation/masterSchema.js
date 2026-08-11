import { z } from 'zod';

export const masterFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  code: z.string().max(40).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  color: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().min(1).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo: z.string().optional().nullable(),
});

export const branchFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  branchCode: z.string().min(2, 'Code is required').max(20),
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().email(),
  phone: z.string().min(8, 'Phone is required'),
  alternatePhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  workingHours: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
