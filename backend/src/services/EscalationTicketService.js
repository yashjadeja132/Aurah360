import ApiError from '../libs/ApiError.js';
import EscalationTicket from '../models/EscalationTicket.model.js';
import Patient from '../models/Patient.model.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import logger from '../libs/logger.js';

/** Free-text patient reply -> human escalation inbox (CRM-001). */
class EscalationTicketService {
  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * Best-effort match on the sender's phone number. Never throws — the caller (webhook
   * ingestion) must not lose the inbound message just because the patient couldn't be resolved.
   * Matches on the raw number, or on its last 10 digits (handles +91/00 country-code prefixes
   * the provider may or may not include).
   */
  async #resolvePatientId(fromNumber) {
    try {
      const digits = String(fromNumber || '').replace(/\D/g, '');
      const last10 = digits.slice(-10);
      if (!last10) return null;
      const patient = await Patient.findOne({ mobile: { $regex: last10 + '$' } }).select('_id').lean();
      return patient?._id || null;
    } catch (err) {
      logger.warn('Escalation ticket: patient resolution failed', { error: err.message });
      return null;
    }
  }

  /** Ingest an inbound free-text message. Idempotent per providerMessageId. */
  async createFromInboundMessage({ channel, fromNumber, messageBody, receivedAt, providerMessageId }) {
    const patientId = await this.#resolvePatientId(fromNumber);
    try {
      const ticket = await EscalationTicket.create({
        channel,
        fromNumber,
        messageBody,
        receivedAt: receivedAt || new Date(),
        patientId,
        providerMessageId: providerMessageId || null,
      });
      await this.auditService.record(AUDIT_ACTIONS.ESCALATION_TICKET_CREATED, {
        actorId: null,
        metadata: { ticketId: ticket._id.toString(), channel, patientResolved: Boolean(patientId) },
      });
      return ticket.toSafeObject();
    } catch (err) {
      // Duplicate provider webhook delivery (at-least-once) — not an error, just a no-op.
      if (err?.code === 11000) return null;
      throw err;
    }
  }

  async listTickets(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    const rows = await EscalationTicket.find(filter).sort({ receivedAt: -1 }).limit(200).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async markHandled(id, actorId, req = null) {
    const ticket = await EscalationTicket.findById(id);
    if (!ticket) throw ApiError.notFound('Escalation ticket not found');
    ticket.status = 'HANDLED';
    ticket.handledBy = actorId;
    ticket.handledAt = new Date();
    await ticket.save();

    await this.auditService.record(AUDIT_ACTIONS.ESCALATION_TICKET_HANDLED, {
      actorId,
      metadata: { ticketId: id },
      req,
    });
    return ticket.toSafeObject();
  }
}

export default EscalationTicketService;
