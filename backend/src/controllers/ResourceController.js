import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ResourceService from '../services/ResourceService.js';

class ResourceController {
  constructor() {
    this.service = new ResourceService();
  }

  listRooms = asyncHandler(async (req, res) => {
    const rooms = await this.service.listRooms(req.query);
    return ApiResponse.success(res, { message: 'Rooms retrieved', data: { rooms } });
  });

  createRoom = asyncHandler(async (req, res) => {
    const room = await this.service.createRoom(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Room created', data: { room } });
  });

  updateRoom = asyncHandler(async (req, res) => {
    const room = await this.service.updateRoom(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Room updated', data: { room } });
  });

  updateRoomStatus = asyncHandler(async (req, res) => {
    const room = await this.service.updateRoomStatus(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Room status updated', data: { room } });
  });

  listDevices = asyncHandler(async (req, res) => {
    const devices = await this.service.listDevices(req.query);
    return ApiResponse.success(res, { message: 'Devices retrieved', data: { devices } });
  });

  createDevice = asyncHandler(async (req, res) => {
    const device = await this.service.createDevice(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Device created', data: { device } });
  });

  updateDevice = asyncHandler(async (req, res) => {
    const device = await this.service.updateDevice(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Device updated', data: { device } });
  });

  updateDeviceStatus = asyncHandler(async (req, res) => {
    const device = await this.service.updateDeviceStatus(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Device status updated', data: { device } });
  });

  listSkills = asyncHandler(async (req, res) => {
    const skills = await this.service.listSkills(req.query);
    return ApiResponse.success(res, { message: 'Skills retrieved', data: { skills } });
  });

  grantSkill = asyncHandler(async (req, res) => {
    const skill = await this.service.grantSkill(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Skill granted', data: { skill } });
  });

  revokeSkill = asyncHandler(async (req, res) => {
    const skill = await this.service.revokeSkill(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Skill revoked', data: { skill } });
  });
}

export default ResourceController;
