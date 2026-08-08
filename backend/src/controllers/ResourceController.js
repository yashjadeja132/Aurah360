import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ResourceService from '../services/ResourceService.js';
import { scopedListQuery, resolveRecordScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — row-level branch scoping for rooms, devices and staff skills.
 *
 * Rooms and devices are physical assets that sit in exactly one branch (`branchId` is required on
 * both models), so both the browse lists and the single-record writes are pinned to the caller's
 * branch; an out-of-scope id answers 404 rather than 403.
 *
 * Staff SKILLS are the subtle one: `StaffSkill.branchId` is nullable and null means "valid
 * everywhere". The list therefore returns the caller's branch grants PLUS the organisation-wide
 * ones (matching how `findValidSkill` enforces them at booking time) — filtering on equality alone
 * would blind a branch to the credentials its own staff are actually working under.
 */
class ResourceController {
  constructor() {
    this.service = new ResourceService();
  }

  /** The caller's branch scope for a single record/write; null for OWNER/ADMIN (unrestricted). */
  #branchScope = async (req) => (await resolveRecordScope(req, { branch: true, doctor: false })).branchId;

  listRooms = asyncHandler(async (req, res) => {
    const rooms = await this.service.listRooms(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { message: 'Rooms retrieved', data: { rooms } });
  });

  createRoom = asyncHandler(async (req, res) => {
    const room = await this.service.createRoom(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Room created', data: { room } });
  });

  updateRoom = asyncHandler(async (req, res) => {
    const room = await this.service.updateRoom(req.params.id, req.body, req.auth.userId, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Room updated', data: { room } });
  });

  updateRoomStatus = asyncHandler(async (req, res) => {
    const room = await this.service.updateRoomStatus(req.params.id, req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Room status updated', data: { room } });
  });

  listDevices = asyncHandler(async (req, res) => {
    const devices = await this.service.listDevices(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { message: 'Devices retrieved', data: { devices } });
  });

  createDevice = asyncHandler(async (req, res) => {
    const device = await this.service.createDevice(req.body, req.auth.userId, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Device created', data: { device } });
  });

  updateDevice = asyncHandler(async (req, res) => {
    const device = await this.service.updateDevice(req.params.id, req.body, req.auth.userId, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Device updated', data: { device } });
  });

  updateDeviceStatus = asyncHandler(async (req, res) => {
    const device = await this.service.updateDeviceStatus(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      { branchId: await this.#branchScope(req) }
    );
    return ApiResponse.success(res, { message: 'Device status updated', data: { device } });
  });

  listSkills = asyncHandler(async (req, res) => {
    const skills = await this.service.listSkills(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { message: 'Skills retrieved', data: { skills } });
  });

  grantSkill = asyncHandler(async (req, res) => {
    const skill = await this.service.grantSkill(req.body, req.auth.userId, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Skill granted', data: { skill } });
  });

  revokeSkill = asyncHandler(async (req, res) => {
    const skill = await this.service.revokeSkill(req.params.id, req.auth.userId, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Skill revoked', data: { skill } });
  });
}

export default ResourceController;
