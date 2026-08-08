import { z } from 'zod';
import {
  LOYALTY_EARNING_EVENT_LIST,
  LOYALTY_POINT_FORMULA_TYPE_LIST,
  LOYALTY_ROUNDING_RULE_LIST,
  LOYALTY_ELIGIBILITY_LIST,
  LOYALTY_MANUAL_REASON_CATEGORY_LIST,
  LOYALTY_ADJUSTMENT_STATUS_LIST,
  LOYALTY_CAMPAIGN_STATUS_LIST,
} from '../enums/loyalty.js';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const idParamSchema = z.object({ id: objectId });
export const patientIdParamSchema = z.object({ patientId: objectId });

export const updateSettingsSchema = z.object({
  programEnabled: z.boolean().optional(),
  // Nullable across the board: the settings form sends null/'' for a cleared field, and
  // updateSettings() treats those as "leave unchanged" rather than an overwrite.
  programDisplayName: z.string().max(100).optional().nullable(),
  redemptionPointsPerRupee: z.number().min(1).optional().nullable(),
  minimumPointsToRedeem: z.number().min(0).optional().nullable(),
  maxRedemptionPercentPerInvoice: z.number().min(0).max(100).optional().nullable(),
  maxRedemptionFlatInrPerInvoice: z.number().min(0).optional().nullable(),
  redemptionStepPoints: z.number().min(1).optional().nullable(),
  pointsExpiryMonths: z.number().min(1).max(120).optional().nullable(),
  expiryReminderDaysBefore: z.array(z.number().int().positive()).optional(),
  excludedRedemptionCategories: z.array(z.string()).optional(),
  earnOnRedeemedPortion: z.boolean().optional(),
  tiersEnabled: z.boolean().optional(),
  ruleChangeApprovalThresholdPercent: z.number().min(0).optional().nullable(),
  manualAdjustmentPointLimitsByRole: z.record(z.string(), z.number().int().min(0)).optional(),
  effectiveFrom: z.string().optional(),
});

export const ruleListQuerySchema = z.object({
  eventType: z.enum(LOYALTY_EARNING_EVENT_LIST).optional(),
  isActive: z.coerce.boolean().optional(),
});

const ruleVersionSchema = z.object({
  formulaType: z.enum(LOYALTY_POINT_FORMULA_TYPE_LIST),
  pointValue: z.number().min(0),
  perAmountInr: z.number().min(1).optional().nullable(),
  roundingRule: z.enum(LOYALTY_ROUNDING_RULE_LIST).optional(),
  branchIds: z.array(objectId).optional(),
  /** Per-branch pointValue override, keyed by branch id — enforced by
   *  LoyaltyEarningEngineService.effectivePointValue. */
  branchOverrides: z.record(objectId, z.object({ pointValue: z.number().min(0) })).optional(),
  serviceIds: z.array(objectId).optional(),
  packageIds: z.array(objectId).optional(),
  perEventCap: z.number().min(0).optional().nullable(),
  perDayCap: z.number().min(0).optional().nullable(),
  perMonthCap: z.number().min(0).optional().nullable(),
  lifetimeCap: z.number().min(0).optional().nullable(),
  eligibility: z.enum(LOYALTY_ELIGIBILITY_LIST).optional(),
  minimumVisits: z.number().min(0).optional().nullable(),
  requiresMarketingConsent: z.boolean().optional(),
  effectiveFrom: z.string().optional(),
});

export const createRuleSchema = z.object({
  ruleCode: z.string().min(2).max(40),
  eventType: z.enum(LOYALTY_EARNING_EVENT_LIST),
  name: z.string().min(1).max(120),
  notes: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  version: ruleVersionSchema,
});

export const addRuleVersionSchema = ruleVersionSchema;

/**
 * POST /loyalty/rules/preview — the rule-version draft being edited plus the sample amount, and
 * optionally a real patient/branch/service so eligibility and ledger-backed caps are simulated for
 * real. Same version shape as addRuleVersionSchema; unknown keys the editor also holds (name,
 * notes, …) are stripped by zod so the UI can post its whole draft.
 */
export const previewRuleSchema = ruleVersionSchema.extend({
  amountInr: z.coerce.number().min(0).optional(),
  ruleCode: z.string().max(40).optional().nullable(),
  eventType: z.enum(LOYALTY_EARNING_EVENT_LIST).optional(),
  patientId: objectId.optional().nullable(),
  branchId: objectId.optional().nullable(),
  serviceId: objectId.optional().nullable(),
  packageId: objectId.optional().nullable(),
  occurredAt: z.string().optional().nullable(),
});

export const upsertTierSchema = z.object({
  name: z.string().min(1).max(60),
  rank: z.number().min(0),
  qualificationBasis: z.enum(['POINTS_EARNED_ROLLING_12M', 'VISITS_COUNT_ROLLING_12M', 'SPEND_ROLLING_12M']),
  threshold: z.number().min(0),
  earningMultiplier: z.number().min(1).optional(),
  benefits: z
    .object({
      birthdayBonusMultiplier: z.number().min(1).optional(),
      priorityBookingFlag: z.boolean().optional(),
      offerSegmentTag: z.string().optional().nullable(),
    })
    .optional(),
  downgradeGracePeriodDays: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const campaignListQuerySchema = z.object({
  status: z.enum(LOYALTY_CAMPAIGN_STATUS_LIST).optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  multiplier: z.number().min(1),
  appliesToRuleCodes: z.array(z.string()).optional(),
  startDate: z.string(),
  endDate: z.string(),
  branchIds: z.array(objectId).optional(),
  serviceIds: z.array(objectId).optional(),
  audienceSegment: z.string().optional().nullable(),
});

export const campaignStatusSchema = z.object({
  status: z.enum(LOYALTY_CAMPAIGN_STATUS_LIST),
});

export const adjustmentQueueQuerySchema = z.object({
  status: z.enum(LOYALTY_ADJUSTMENT_STATUS_LIST).optional(),
  patientId: objectId.optional(),
});

/** The approve/reject dialog sends `note` (+ an informational reasonCategory); `decisionNote`
 *  is the canonical field name. Accept both so either caller shape works. */
export const decisionSchema = z.object({
  decisionNote: z.string().max(1000).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  reasonCategory: z.enum(LOYALTY_MANUAL_REASON_CATEGORY_LIST).optional(),
});

export const createAdjustmentSchema = z
  .object({
    branchId: objectId.optional(),
    direction: z.enum(['CREDIT', 'DEBIT']).optional(),
    entryType: z.enum(['MANUAL_CREDIT', 'MANUAL_DEBIT']).optional(),
    points: z.number().int().positive(),
    reasonCategory: z.enum(LOYALTY_MANUAL_REASON_CATEGORY_LIST),
    note: z.string().min(1).max(1000),
  })
  .refine((v) => v.direction || v.entryType, {
    message: 'Either direction or entryType is required',
    path: ['direction'],
  });

export const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  /** Page-based (patient-360 panel) and cursor-based (`before`) paging are both supported. */
  page: z.coerce.number().int().positive().optional(),
  before: z.string().optional(),
});

export const dashboardQuerySchema = z.object({
  branchId: objectId.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
