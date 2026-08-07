import { z } from 'zod';
import { objectId } from './common.js';
import { AI_USE_CASE_LIST, AI_DISPOSITION_LIST } from '../enums/ai.js';

export const runAiSchema = z.object({
  useCase: z.enum(AI_USE_CASE_LIST),
  context: z.record(z.any()).default({}),
  patientId: objectId.optional().nullable(),
  consultationId: objectId.optional().nullable(),
});

export const dispositionSchema = z.object({
  disposition: z.enum(AI_DISPOSITION_LIST),
  editedOutput: z.record(z.any()).optional().nullable(),
});

export const setFlagSchema = z.object({
  enabled: z.boolean(),
  disabledReason: z.string().max(500).optional().nullable(),
});

export const listRunsQuerySchema = z.object({
  useCase: z.enum(AI_USE_CASE_LIST).optional(),
  patientId: objectId.optional(),
  status: z.string().optional(),
});

export const runIdParamSchema = z.object({ runId: objectId });
export const useCaseParamSchema = z.object({ useCase: z.enum(AI_USE_CASE_LIST) });

export default { runAiSchema, dispositionSchema, setFlagSchema, listRunsQuerySchema, runIdParamSchema, useCaseParamSchema };
