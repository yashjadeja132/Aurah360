import { z } from 'zod';
import { objectId } from './common.js';

const importRowSchema = z.record(z.string(), z.any());

export const dryRunSchema = z.object({
  sourceSystem: z.string().min(1).max(60),
  rows: z.array(importRowSchema).min(1).max(5000),
});

export const commitSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(5000),
});

export const batchIdParamSchema = z.object({
  batchId: objectId,
});

export default { dryRunSchema, commitSchema, batchIdParamSchema };
