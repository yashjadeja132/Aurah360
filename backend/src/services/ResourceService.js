import RoomRepository from '../repositories/RoomRepository.js';
import DeviceRepository from '../repositories/DeviceRepository.js';
import StaffSkillRepository from '../repositories/StaffSkillRepository.js';
import ApiError from '../libs/ApiError.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { RESOURCE_STATUS } from '../enums/resource.js';

/** Rooms, devices and staff-skills — the resource layer appointments/treatments reserve against. */
class ResourceService {
  constructor() {
    this.roomRepository = new RoomRepository();
    this.deviceRepository = new DeviceRepository();
    this.skillRepository = new StaffSkillRepository();
    this.auditService = new AuditService();
  }

  // --- Rooms -------------------------------------------------------------
  async listRooms(query = {}) {
    const filter = { deletedAt: null };
    if (query.branchId) filter.branchId = query.branchId;
    if (query.status) filter.status = query.status;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;
    const rooms = await this.roomRepository.findManyNotDeleted(filter, { sort: { name: 1 } });
    return rooms.map((r) => r.toSafeObject());
  }

  async createRoom(payload, actorId, req = null) {
    const room = await this.roomRepository.create({ ...payload, createdBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.RESOURCE_CREATED, {
      actorId,
      metadata: { type: 'ROOM', roomId: room._id.toString() },
      req,
    });
    return room.toSafeObject();
  }

  async updateRoomStatus(id, { status, reason }, actorId, req = null) {
    const room = await this.roomRepository.findByIdNotDeleted(id);
    if (!room) throw ApiError.notFound('Room not found');
    room.status = status;
    room.statusReason = reason || null;
    room.statusUpdatedAt = new Date();
    room.updatedBy = actorId;
    await room.save();
    await this.auditService.record(AUDIT_ACTIONS.RESOURCE_STATUS_CHANGED, {
      actorId,
      metadata: { type: 'ROOM', roomId: id, status },
      req,
    });
    return room.toSafeObject();
  }

  async updateRoom(id, payload, actorId) {
    const room = await this.roomRepository.findByIdNotDeleted(id);
    if (!room) throw ApiError.notFound('Room not found');
    Object.assign(room, payload, { updatedBy: actorId });
    await room.save();
    return room.toSafeObject();
  }

  async isRoomAvailable(roomId) {
    if (!roomId) return true;
    const room = await this.roomRepository.findByIdNotDeleted(roomId);
    if (!room || !room.isActive) return false;
    return room.status === RESOURCE_STATUS.AVAILABLE;
  }

  // --- Devices -------------------------------------------------------------
  async listDevices(query = {}) {
    const filter = { deletedAt: null };
    if (query.branchId) filter.branchId = query.branchId;
    if (query.status) filter.status = query.status;
    if (query.capability) filter.capability = query.capability;
    const devices = await this.deviceRepository.findManyNotDeleted(filter, { sort: { name: 1 } });
    return devices.map((d) => d.toSafeObject());
  }

  async createDevice(payload, actorId) {
    const device = await this.deviceRepository.create({ ...payload, createdBy: actorId });
    return device.toSafeObject();
  }

  async updateDeviceStatus(id, { status, reason }, actorId, req = null) {
    const device = await this.deviceRepository.findByIdNotDeleted(id);
    if (!device) throw ApiError.notFound('Device not found');
    device.status = status;
    device.statusReason = reason || null;
    device.statusUpdatedAt = new Date();
    if (status === RESOURCE_STATUS.MAINTENANCE) device.lastMaintenanceAt = new Date();
    device.updatedBy = actorId;
    await device.save();
    await this.auditService.record(AUDIT_ACTIONS.RESOURCE_STATUS_CHANGED, {
      actorId,
      metadata: { type: 'DEVICE', deviceId: id, status },
      req,
    });
    return device.toSafeObject();
  }

  async updateDevice(id, payload, actorId) {
    const device = await this.deviceRepository.findByIdNotDeleted(id);
    if (!device) throw ApiError.notFound('Device not found');
    Object.assign(device, payload, { updatedBy: actorId });
    await device.save();
    return device.toSafeObject();
  }

  async isDeviceAvailable(deviceId) {
    if (!deviceId) return true;
    const device = await this.deviceRepository.findByIdNotDeleted(deviceId);
    if (!device || !device.isActive) return false;
    return device.status === RESOURCE_STATUS.AVAILABLE;
  }

  // --- Staff skills -------------------------------------------------------------
  async listSkills(query = {}) {
    const filter = {};
    if (query.userId) filter.userId = query.userId;
    if (query.branchId) filter.branchId = query.branchId;
    const skills = await this.skillRepository.findMany(filter, { sort: { createdAt: -1 } });
    return skills.map((s) => s.toSafeObject());
  }

  async grantSkill(payload, actorId) {
    const skill = await this.skillRepository.create({ ...payload, createdBy: actorId });
    return skill.toSafeObject();
  }

  async revokeSkill(id, actorId) {
    const skill = await this.skillRepository.updateById(id, { status: 'SUSPENDED', updatedBy: actorId });
    if (!skill) throw ApiError.notFound('Skill grant not found');
    return skill.toSafeObject();
  }

  /**
   * TRT-003 — validate a user is credentialed (and not expired) for a protocol skill,
   * optionally scoped to a branch. Throws ApiError.conflict with a HARD_STOP code on failure.
   */
  async assertOperatorSkilled(userId, skillCode, branchId = null) {
    if (!skillCode) return true;
    const skill = await this.skillRepository.findValidSkill(userId, skillCode, branchId);
    if (!skill) {
      throw ApiError.conflict(
        `Operator is not credentialed for "${skillCode}"`,
        'OPERATOR_SKILL_MISSING'
      );
    }
    if (!skill.isValidNow()) {
      throw ApiError.conflict(
        `Operator's credential for "${skillCode}" has expired`,
        'OPERATOR_SKILL_EXPIRED'
      );
    }
    return true;
  }
}

export default ResourceService;
