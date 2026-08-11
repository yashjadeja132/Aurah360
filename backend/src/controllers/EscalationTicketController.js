import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import EscalationTicketService from '../services/EscalationTicketService.js';

/** Human escalation inbox for free-text patient replies (CRM-001). */
class EscalationTicketController {
  constructor() {
    this.service = new EscalationTicketService();
  }

  listTickets = asyncHandler(async (req, res) => {
    const tickets = await this.service.listTickets(req.query);
    return ApiResponse.success(res, { message: 'Escalation tickets retrieved', data: { tickets } });
  });

  markHandled = asyncHandler(async (req, res) => {
    const ticket = await this.service.markHandled(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Escalation ticket marked handled', data: { ticket } });
  });
}

export default EscalationTicketController;
