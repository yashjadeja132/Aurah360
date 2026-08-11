import mongoose from 'mongoose';

/**
 * Free-text patient replies (WhatsApp/SMS/voice inbound) that a bot/automation cannot route
 * anywhere sensible get parked here for a human to handle (CRM-001 — "routed to human escalation
 * inbox"). Patient resolution from the sender's phone number is best-effort and MUST NOT block
 * ingestion: the raw phone number is always stored so the message is never lost even when the
 * patient can't be matched (unknown number, multiple matches, etc).
 */
const escalationTicketSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['WHATSAPP', 'SMS', 'VOICE'], required: true, index: true },
    fromNumber: { type: String, required: true, trim: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
    messageBody: { type: String, required: true },
    receivedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ['OPEN', 'HANDLED'], default: 'OPEN', index: true },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
    relatedNotificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', default: null },
    providerMessageId: { type: String, default: null, index: true },
  },
  { timestamps: true, collection: 'escalation_tickets' }
);

// A given provider inbound message id should only ever create one ticket, even if the provider
// retries the webhook delivery (Meta explicitly documents at-least-once delivery).
escalationTicketSchema.index(
  { providerMessageId: 1 },
  { unique: true, partialFilterExpression: { providerMessageId: { $type: 'string' } } }
);

escalationTicketSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    channel: this.channel,
    fromNumber: this.fromNumber,
    patientId: this.patientId ? this.patientId.toString() : null,
    messageBody: this.messageBody,
    receivedAt: this.receivedAt,
    status: this.status,
    handledBy: this.handledBy ? this.handledBy.toString() : null,
    handledAt: this.handledAt,
    relatedNotificationId: this.relatedNotificationId ? this.relatedNotificationId.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const EscalationTicket = mongoose.model('EscalationTicket', escalationTicketSchema);
export default EscalationTicket;
