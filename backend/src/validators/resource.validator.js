import { z } from 'zod';
import { objectId } from './common.js';
import { ROOM_TYPE_LIST, DEVICE_CAPABILITY_LIST, RESOURCE_STATUS_LIST, SKILL_STATUS_LIST } from '../enums/resource.js';

export const createRoomSchema = z.object({
  branchId: objectId,
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  type: z.enum(ROOM_TYPE_LIST).optional(),
  capacity: z.coerce.number().int().min(1).max(20).optional(),
  cleaningBufferMinutes: z.coerce.number().int().min(0).max(120).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const roomStatusSchema = z.object({
  status: z.enum(RESOURCE_STATUS_LIST),
  reason: z.string().max(300).optional().nullable(),
});

export const createDeviceSchema = z.object({
  branchId: objectId,
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  serialNumber: z.string().max(80).optional().nullable(),
  capability: z.enum(DEVICE_CAPABILITY_LIST).optional(),
  tags: z.array(z.string().max(40)).optional(),
  /** RSC-001 — maintenance schedule; nextMaintenanceDueAt gates bookability once it has passed. */
  lastMaintenanceAt: z.coerce.date().optional().nullable(),
  nextMaintenanceDueAt: z.coerce.date().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateDeviceSchema = createDeviceSchema.partial();

export const deviceStatusSchema = roomStatusSchema;

export const grantSkillSchema = z.object({
  userId: objectId,
  branchId: objectId.optional().nullable(),
  skillCode: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  credentialRef: z.string().max(120).optional().nullable(),
  requiresSupervision: z.boolean().optional(),
  supervisorId: objectId.optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

export const listResourceQuerySchema = z.object({
  branchId: objectId.optional(),
  status: z.enum(RESOURCE_STATUS_LIST).optional(),
  capability: z.enum(DEVICE_CAPABILITY_LIST).optional(),
  isActive: z.union([z.literal('true'), z.literal('false')]).optional(),
});

export const listSkillsQuerySchema = z.object({
  userId: objectId.optional(),
  branchId: objectId.optional(),
});

export default {
  createRoomSchema,
  updateRoomSchema,
  roomStatusSchema,
  createDeviceSchema,
  updateDeviceSchema,
  deviceStatusSchema,
  grantSkillSchema,
  listResourceQuerySchema,
  listSkillsQuerySchema,
};
