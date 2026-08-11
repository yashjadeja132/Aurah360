import { z } from 'zod';
import { objectId } from './common.js';

export const createRecallEntrySchema = z.object({
  patientId: objectId,
  consultationId: objectId.optional().nullable(),
  branchId: objectId.optional().nullable(),
  preferredDoctorId: objectId.optional().nullable(),
  dueDate: z.coerce.date(),
  purpose: z.string().max(500).optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export const recallOutcomeSchema = z.object({
  status: z.enum(['PENDING', 'BOOKED', 'CALL_LATER', 'NOT_INTERESTED', 'UNREACHABLE', 'WRONG_NUMBER', 'OPTED_OUT']),
  outcomeNotes: z.string().max(1000).optional().nullable(),
  resultingAppointmentId: objectId.optional().nullable(),
});

const localizedText = z.object({ en: z.string().optional(), gu: z.string().optional(), hi: z.string().optional() });

export const createOfferSchema = z.object({
  title: localizedText,
  description: localizedText.optional(),
  imageUrl: z.string().max(500).optional().nullable(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  branchIds: z.array(objectId).optional(),
  serviceIds: z.array(objectId).optional(),
  audience: z.enum(['ALL', 'NEW_PATIENTS', 'EXISTING_PATIENTS', 'VIP']).optional(),
  requiresMarketingConsent: z.boolean().optional(),
  /** Tier names, referencing LoyaltyTier.model.js. Empty/omitted = no tier targeting. */
  targetTiers: z.array(z.string()).optional(),
  terms: localizedText.optional(),
  bookingCta: z.string().max(60).optional(),
});

export const updateOfferSchema = createOfferSchema.partial().extend({ isActive: z.boolean().optional() });

export const submitFeedbackSchema = z.object({
  patientId: objectId,
  doctorId: objectId.optional().nullable(),
  appointmentId: objectId.optional().nullable(),
  doctorRating: z.coerce.number().min(1).max(5).optional().nullable(),
  clinicRating: z.coerce.number().min(1).max(5),
  npsScore: z.coerce.number().min(0).max(10).optional().nullable(),
  comments: z.string().max(2000).optional().nullable(),
  suggestions: z.string().max(2000).optional().nullable(),
  isComplaint: z.boolean().optional(),
});

export const escalateFeedbackSchema = z.object({
  escalatedTo: objectId,
});

export const resolveFeedbackSchema = z.object({
  resolutionNotes: z.string().max(2000).optional().nullable(),
});

export const idParamSchema = z.object({ id: objectId });

export default {
  createRecallEntrySchema,
  recallOutcomeSchema,
  createOfferSchema,
  updateOfferSchema,
  submitFeedbackSchema,
  escalateFeedbackSchema,
  resolveFeedbackSchema,
  idParamSchema,
};
