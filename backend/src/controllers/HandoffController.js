import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import HandoffService from '../services/HandoffService.js';

class HandoffController {
  constructor() {
    this.service = new HandoffService();
  }

  create = asyncHandler(async (req, res) => {
    const note = await this.service.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Handoff note created', data: { note } });
  });

  listForPatient = asyncHandler(async (req, res) => {
    const notes = await this.service.listForPatient(req.params.patientId);
    return ApiResponse.success(res, { message: 'Handoff notes retrieved', data: { notes } });
  });

  listUnacknowledgedForDoctor = asyncHandler(async (req, res) => {
    const notes = await this.service.listUnacknowledgedForDoctor(req.params.doctorId);
    return ApiResponse.success(res, { message: 'Unacknowledged handoff notes retrieved', data: { notes } });
  });

  acknowledge = asyncHandler(async (req, res) => {
    const note = await this.service.acknowledge(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Handoff note acknowledged', data: { note } });
  });

  amend = asyncHandler(async (req, res) => {
    const note = await this.service.amend(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Handoff note amended', data: { note } });
  });
}

export default HandoffController;
