import { z } from 'zod';
import { ORG_SHADOWED_BRANCH_FIELDS } from '../constants/branchOverrides.js';

export const updateOrganizationSchema = z.object({
  legalName: z.string().min(1).max(200).optional(),
  displayName: z.string().min(1).max(200).optional(),
  gstNumber: z.string().max(20).optional().nullable(),
  panNumber: z.string().max(20).optional().nullable(),
  logo: z.string().max(500).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  privacyContactEmail: z.string().email().optional().nullable(),
  grievanceContactEmail: z.string().email().optional().nullable(),
  timezone: z.string().max(60).optional(),
  // Must match frontend/src/i18n/index.js SUPPORTED_LANGUAGES codes.
  languages: z.array(z.enum(['en', 'gu', 'hi'])).min(1).optional(),
  financialYearStartMonth: z.coerce.number().int().min(1).max(12).optional(),
  // Becomes part of a unique invoice number, so restrict it to number-safe characters.
  invoicePrefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9-]+$/, 'invoicePrefix may contain only letters, digits and hyphens')
    .optional(),
  invoiceFooterNote: z.string().max(500).optional().nullable(),
  // Only org-shadowed branch fields can be listed — see constants/branchOverrides.js.
  branchOverridableFields: z.array(z.enum(ORG_SHADOWED_BRANCH_FIELDS)).optional(),
});

export default { updateOrganizationSchema };
