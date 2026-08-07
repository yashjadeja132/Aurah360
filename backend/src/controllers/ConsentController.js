import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ConsentService from '../services/ConsentService.js';

class ConsentController {
  constructor() {
    this.service = new ConsentService();
  }

  grant = asyncHandler(async (req, res) => {
    const grant = await this.service.grant(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Consent recorded', data: { grant } });
  });

  withdraw = asyncHandler(async (req, res) => {
    const grant = await this.service.withdraw(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Consent withdrawn', data: { grant } });
  });

  currentStates = asyncHandler(async (req, res) => {
    const states = await this.service.currentStates(req.params.patientId);
    return ApiResponse.success(res, { message: 'Consent states retrieved', data: { states } });
  });

  history = asyncHandler(async (req, res) => {
    const history = await this.service.history(req.params.patientId, req.query.purpose);
    return ApiResponse.success(res, { message: 'Consent history retrieved', data: { history } });
  });

  listDefinitions = asyncHandler(async (req, res) => {
    const definitions = await this.service.listDefinitions();
    return ApiResponse.success(res, { message: 'Consent definitions retrieved', data: { definitions } });
  });

  publishDefinition = asyncHandler(async (req, res) => {
    const definition = await this.service.publishNewVersion(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Consent version published', data: { definition } });
  });
}

export default ConsentController;
