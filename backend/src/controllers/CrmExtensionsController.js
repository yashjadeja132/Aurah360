import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import CrmExtensionsService from '../services/CrmExtensionsService.js';

class CrmExtensionsController {
  constructor() {
    this.service = new CrmExtensionsService();
  }

  createRecallEntry = asyncHandler(async (req, res) => {
    const entry = await this.service.createRecallEntry(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Recall entry created', data: { entry } });
  });

  listRecallWorklist = asyncHandler(async (req, res) => {
    const entries = await this.service.listRecallWorklist(req.query);
    return ApiResponse.success(res, { message: 'Recall worklist retrieved', data: { entries } });
  });

  recordRecallOutcome = asyncHandler(async (req, res) => {
    const entry = await this.service.recordRecallOutcome(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Recall outcome recorded', data: { entry } });
  });

  createOffer = asyncHandler(async (req, res) => {
    const offer = await this.service.createOffer(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Offer created', data: { offer } });
  });

  updateOffer = asyncHandler(async (req, res) => {
    const offer = await this.service.updateOffer(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Offer updated', data: { offer } });
  });

  listOffers = asyncHandler(async (req, res) => {
    const offers = await this.service.listOffers(req.query);
    return ApiResponse.success(res, { message: 'Offers retrieved', data: { offers } });
  });

  submitFeedback = asyncHandler(async (req, res) => {
    const feedback = await this.service.submitFeedback(req.body, req.auth?.userId || null, req);
    return ApiResponse.created(res, { message: 'Feedback submitted', data: { feedback } });
  });

  listFeedback = asyncHandler(async (req, res) => {
    const feedback = await this.service.listFeedback(req.query);
    return ApiResponse.success(res, { message: 'Feedback retrieved', data: { feedback } });
  });

  escalateFeedback = asyncHandler(async (req, res) => {
    const feedback = await this.service.escalateFeedback(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Feedback escalated', data: { feedback } });
  });

  resolveFeedback = asyncHandler(async (req, res) => {
    const feedback = await this.service.resolveFeedback(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Feedback resolved', data: { feedback } });
  });
}

export default CrmExtensionsController;
