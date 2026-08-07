import { z } from 'zod';
import { objectId } from './common.js';
import { CONSENT_PURPOSE_LIST, CONSENT_METHOD_LIST } from '../enums/privacy.js';

export const grantConsentSchema = z.object({
  patientId: objectId,
  purpose: z.enum(CONSENT_PURPOSE_LIST),
  language: z.string().max(5).optional(),
  method: z.enum(CONSENT_METHOD_LIST).optional(),
});

export const withdrawConsentSchema = z.object({
  patientId: objectId,
  purpose: z.enum(CONSENT_PURPOSE_LIST),
  reason: z.string().max(500).optional().nullable(),
});

export const publishDefinitionSchema = z.object({
  purpose: z.enum(CONSENT_PURPOSE_LIST),
  language: z.string().max(5).optional(),
  title: z.string().min(1).max(200),
  bodyText: z.string().min(1).max(10000),
});

export const patientIdParamSchema = z.object({
  patientId: objectId,
});

export default { grantConsentSchema, withdrawConsentSchema, publishDefinitionSchema, patientIdParamSchema };
