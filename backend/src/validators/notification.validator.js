import { z } from 'zod';
import {
  NOTIFICATION_CHANNEL_LIST,
  NOTIFICATION_STATUS_LIST,
  PHI_BLOCKED_KEYWORDS,
  PHI_BLOCKED_MERGE_FIELDS,
  WHATSAPP_APPROVAL_STATUS_LIST,
} from '../enums/notification.js';

/**
 * PHI / clinical-content guard (PRD high-risk rule, §NTF templates): scans template
 * subject/body text — including the field names inside `{{mergeField}}` placeholders —
 * for diagnosis/treatment/lab-value/clinical-photo content and rejects the save if found.
 * Returns the matched term, or null if the text is clean.
 */
function findPhiViolation(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();

  for (const keyword of PHI_BLOCKED_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return `blocked keyword "${keyword}"`;
    }
  }

  const mergeFieldPattern = /\{\{\s*([\w.]+)\s*\}\}/g;
  let match;
  while ((match = mergeFieldPattern.exec(text)) !== null) {
    const fieldName = match[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (PHI_BLOCKED_MERGE_FIELDS.some((blocked) => fieldName === blocked.toLowerCase())) {
      return `blocked merge field "{{${match[1]}}}"`;
    }
  }

  return null;
}

/** Applied to both create (full) and update (partial) template schemas. */
function addPhiGuard(schema) {
  return schema.superRefine((data, ctx) => {
    for (const field of ['subject', 'body']) {
      const violation = findPhiViolation(data[field]);
      if (violation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `Template ${field} contains clinical/PHI content that must not be sent via notification channels (${violation}). Remove diagnosis, treatment, lab-value, or clinical-photo references — clinical content must never appear in WhatsApp/SMS/push/email text.`,
        });
      }
    }
  });
}

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const idParamSchema = z.object({ id: objectId });

export const listQuerySchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNEL_LIST).optional(),
  status: z.enum(NOTIFICATION_STATUS_LIST).optional(),
  eventName: z.string().optional(),
  userId: objectId.optional(),
  patientId: objectId.optional(),
  recipient: z.string().optional(),
  unreadOnly: z.string().optional(),
  archived: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const scheduleSchema = z.object({
  eventName: z.string().min(1),
  variables: z.record(z.any()).optional(),
  patientId: objectId.optional().nullable(),
  userId: objectId.optional().nullable(),
  channels: z.array(z.enum(NOTIFICATION_CHANNEL_LIST)).optional(),
  scheduledAt: z.string().or(z.date()).optional().nullable(),
  recipientOverrides: z.record(z.string()).optional(),
});

const baseTemplateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  eventName: z.string().optional().nullable(),
  channel: z.enum([...NOTIFICATION_CHANNEL_LIST, 'ALL']).optional(),
  subject: z.string().optional().nullable(),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  // DLT SMS registration fields — meaningful only for channel === 'SMS', but accepted
  // regardless of channel so the schema never blocks saving other channel types.
  dltHeader: z.string().optional().nullable(),
  dltTemplateId: z.string().optional().nullable(),
  // WhatsApp Business/Meta approval state — meaningful only for channel === 'WHATSAPP'.
  whatsappApprovalStatus: z.enum(WHATSAPP_APPROVAL_STATUS_LIST).optional().nullable(),
});

export const templateSchema = addPhiGuard(baseTemplateSchema);

export const updateTemplateSchema = addPhiGuard(
  baseTemplateSchema.partial().omit({ code: true })
);
