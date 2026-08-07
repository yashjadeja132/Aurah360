import crypto from 'crypto';
import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import NotificationService from '../services/NotificationService.js';
import config from '../config/index.js';
import logger from '../libs/logger.js';

const notificationService = new NotificationService();

/** NTF-005/007 — signature-verified, deduplicated provider delivery webhooks. */
class NotificationWebhookController {
  /** Meta verification handshake for the WhatsApp Cloud webhook subscription. */
  verifyWhatsApp = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expected = config.notificationProviders?.whatsapp?.webhookVerifyToken;
    if (mode === 'subscribe' && expected && token === expected) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  };

  whatsapp = asyncHandler(async (req, res) => {
    const appSecret = config.notificationProviders?.whatsapp?.appSecret;
    if (!appSecret) {
      logger.warn('WhatsApp webhook rejected: WhatsApp app secret is not configured');
      return res.sendStatus(403);
    }
    const signature = req.headers['x-hub-signature-256'];
    const expected =
      'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody || '').digest('hex');
    if (!signature || signature !== expected) {
      logger.warn('WhatsApp webhook signature mismatch');
      return res.sendStatus(401);
    }

    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const statuses = change.value?.statuses || [];
        for (const s of statuses) {
          const typeMap = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };
          await notificationService.recordDeliveryEvent({
            providerMessageId: s.id,
            type: typeMap[s.status] || s.status?.toUpperCase() || 'SENT',
            raw: s,
            occurredAt: s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date(),
          });
        }
      }
    }
    return ApiResponse.success(res, { message: 'Webhook processed' });
  });

  /**
   * Generic HTTP-DLT / BulkSenders SMS provider delivery callback.
   *
   * BulkSenders.in (and generic HTTP-DLT gateways) have no documented/configurable
   * webhook-signing scheme (no HMAC header equivalent to WhatsApp's
   * `x-hub-signature-256`) — many budget SMS gateways simply don't support one. The
   * next-best mitigation used here is a shared-secret verification token that the
   * callback URL must carry (`?token=` query param, or `x-webhook-token` header as a
   * fallback for providers that can be configured to send a custom header instead of a
   * query string), checked against `SMS_WEBHOOK_SECRET`. Same reject-before-processing
   * shape as the WhatsApp HMAC check above: missing config -> log+401 rather than
   * silently accepting unsigned requests.
   */
  sms = asyncHandler(async (req, res) => {
    const expected = config.notificationProviders?.sms?.webhookSecret;
    const provided = req.query?.token || req.headers['x-webhook-token'];
    if (!expected) {
      logger.warn('SMS webhook rejected: SMS_WEBHOOK_SECRET is not configured');
      return res.sendStatus(403);
    }
    if (!provided || provided !== expected) {
      logger.warn('SMS webhook token mismatch');
      return res.sendStatus(401);
    }

    await notificationService.recordDeliveryEvent({
      providerMessageId: req.body.messageId,
      type: (req.body.status || 'SENT').toUpperCase(),
      raw: req.body,
    });
    return ApiResponse.success(res, { message: 'Webhook processed' });
  });

  /**
   * Exotel voice call status callback.
   *
   * Exotel's exact callback signing scheme couldn't be confirmed from the code/config
   * already present in this repo (only SID/token/callerId for outbound calls are
   * configured, not a webhook secret), so the same shared-secret token fallback used for
   * SMS is applied here: the callback URL configured with Exotel must carry
   * `?token=<VOICE_WEBHOOK_SECRET>` (or an `x-webhook-token` header), checked before any
   * processing — same reject-first shape as WhatsApp/SMS above.
   */
  voice = asyncHandler(async (req, res) => {
    const expected = config.notificationProviders?.voice?.webhookSecret;
    const provided = req.query?.token || req.headers['x-webhook-token'];
    if (!expected) {
      logger.warn('Voice webhook rejected: VOICE_WEBHOOK_SECRET is not configured');
      return res.sendStatus(403);
    }
    if (!provided || provided !== expected) {
      logger.warn('Voice webhook token mismatch');
      return res.sendStatus(401);
    }

    const statusMap = { completed: 'CALL_ANSWERED', 'no-answer': 'CALL_NO_ANSWER', busy: 'CALL_NO_ANSWER', failed: 'FAILED' };
    await notificationService.recordDeliveryEvent({
      providerMessageId: req.body.CallSid,
      type: statusMap[req.body.Status] || 'SENT',
      raw: req.body,
    });
    return ApiResponse.success(res, { message: 'Webhook processed' });
  });
}

export default NotificationWebhookController;
