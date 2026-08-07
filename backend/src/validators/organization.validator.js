import { z } from 'zod';

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
  supportedLanguages: z.array(z.string().max(5)).optional(),
  defaultLanguage: z.string().max(5).optional(),
  financialYearStartMonth: z.coerce.number().int().min(1).max(12).optional(),
  invoicePrefix: z.string().max(10).optional(),
  invoiceFooterNote: z.string().max(500).optional().nullable(),
});

export default { updateOrganizationSchema };
