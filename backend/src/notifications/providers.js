/**
 * Channel provider interfaces + mock adapters.
 * Real WhatsApp/SMS/Email integrations replace only these adapters.
 */

import { BULKSENDERS_TEMPLATES, EVENT_DLT_MAP } from './bulksendersTemplates.js';

export class EmailProvider {
  async send(/* { to, subject, body, meta } */) {
    throw new Error('EmailProvider.send must be implemented');
  }
}

export class SmsProvider {
  async send(/* { to, body, meta } */) {
    throw new Error('SmsProvider.send must be implemented');
  }
}

export class WhatsAppProvider {
  async send(/* { to, body, meta } */) {
    throw new Error('WhatsAppProvider.send must be implemented');
  }
}

export class PushProvider {
  async send(/* { to, title, body, meta } */) {
    throw new Error('PushProvider.send must be implemented');
  }
}

export class VoiceProvider {
  async call(/* { to, script, meta } */) {
    throw new Error('VoiceProvider.call must be implemented');
  }
}

/** In-app is persistence-only — no external send */
export class InAppProvider {
  async send({ to, body, meta }) {
    return {
      success: true,
      provider: 'mock-in-app',
      messageId: `inapp-${Date.now()}`,
      to,
      preview: body?.slice?.(0, 80),
      meta,
    };
  }
}

export class MockEmailProvider extends EmailProvider {
  async send({ to, subject, body, meta }) {
    return {
      success: true,
      provider: 'mock-email',
      messageId: `email-mock-${Date.now()}`,
      to,
      subject,
      preview: body?.slice?.(0, 120),
      meta,
    };
  }
}

export class MockSmsProvider extends SmsProvider {
  async send({ to, body, meta }) {
    return {
      success: true,
      provider: 'mock-sms',
      messageId: `sms-mock-${Date.now()}`,
      to,
      preview: body?.slice?.(0, 120),
      meta,
    };
  }
}

export class MockWhatsAppProvider extends WhatsAppProvider {
  async send({ to, body, meta }) {
    return {
      success: true,
      provider: 'mock-whatsapp',
      messageId: `wa-mock-${Date.now()}`,
      to,
      preview: body?.slice?.(0, 120),
      meta,
    };
  }
}

export class MockPushProvider extends PushProvider {
  async send({ to, title, body, meta }) {
    return {
      success: true,
      provider: 'mock-push',
      messageId: `push-mock-${Date.now()}`,
      to,
      title,
      preview: body?.slice?.(0, 120),
      meta,
    };
  }
}

export class MockVoiceProvider extends VoiceProvider {
  async call({ to, script, meta }) {
    return {
      success: true,
      provider: 'mock-voice',
      callId: `voice-mock-${Date.now()}`,
      to,
      preview: script?.slice?.(0, 120),
      meta,
    };
  }
}

/**
 * WhatsApp Cloud API adapter — real HTTP integration, active only when
 * WHATSAPP_PROVIDER=WHATSAPP_CLOUD and credentials are configured (§12.1, NTF-002).
 * Falls back to a clear error rather than silently mocking if misconfigured.
 */
export class WhatsAppCloudProvider extends WhatsAppProvider {
  constructor({ phoneNumberId, accessToken }) {
    super();
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  async send({ to, body, meta }) {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('WhatsApp Cloud API is not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)');
    }
    const res = await fetch(`https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`WhatsApp Cloud API error: ${json?.error?.message || res.statusText}`);
    }
    return {
      success: true,
      provider: 'whatsapp-cloud',
      messageId: json?.messages?.[0]?.id || null,
      to,
      meta,
    };
  }
}

/**
 * Registered DLT template *shapes* for {@link HttpDltSmsProvider} — each entry is a regex
 * with placeholder slots (`.*`/`\d+` etc.) that mirrors an actual DLT-approved template on
 * file with the telecom operator. Callers never pass arbitrary free text: they pass a
 * `templateId` (key into this map) plus the params needed to build the exact approved
 * wording, and the provider itself renders the text — the same pattern
 * `BulkSendersSmsProvider#buildOtpMessage` uses — so no unregistered text can go out
 * (NTF-003, §12.4).
 */
export const HTTP_DLT_REGISTERED_TEMPLATES = Object.freeze({
  OTP: {
    build: ({ otpCode, validityMinutes }) =>
      `Your OTP is ${otpCode}. Valid for ${validityMinutes} minutes. Do not share it with anyone. - Aurah 360`,
    // Exact shape the built text must match, for defense-in-depth against future edits.
    pattern: /^Your OTP is \d{4,8}\. Valid for \d+ minutes\. Do not share it with anyone\. - Aurah 360$/,
    requiredParams: ['otpCode', 'validityMinutes'],
  },
  APPOINTMENT_REMINDER: {
    build: ({ patientName, dateTime, clinicName }) =>
      `Dear ${patientName}, this is a reminder for your appointment on ${dateTime} at ${clinicName}. - Aurah 360`,
    pattern: /^Dear .+, this is a reminder for your appointment on .+ at .+\. - Aurah 360$/,
    requiredParams: ['patientName', 'dateTime', 'clinicName'],
  },
});

/** Generic DLT-aware SMS adapter — POSTs to a configured HTTP endpoint (NTF-003, §12.4). */
export class HttpDltSmsProvider extends SmsProvider {
  constructor({ apiUrl, apiKey, dltPrincipalEntityId, dltSenderHeader, registeredTemplates }) {
    super();
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.dltPrincipalEntityId = dltPrincipalEntityId;
    this.dltSenderHeader = dltSenderHeader;
    // Allow injecting a custom template map (e.g. in tests); default to the built-in registry.
    this.registeredTemplates = registeredTemplates || HTTP_DLT_REGISTERED_TEMPLATES;
  }

  /**
   * Builds the exact approved DLT template text from a registered templateId + params.
   * Never accepts free-form `body` — this is the enforcement point that keeps every send
   * locked to a pre-registered template shape.
   */
  #buildFromTemplate(meta = {}) {
    const { templateId, templateParams } = meta;
    if (!templateId) {
      throw new Error(
        'HttpDltSmsProvider requires meta.templateId referencing a registered DLT template — refusing to send free-text SMS'
      );
    }
    const template = this.registeredTemplates[templateId];
    if (!template) {
      throw new Error(`HttpDltSmsProvider: "${templateId}" is not a registered DLT template`);
    }
    const params = templateParams || {};
    for (const key of template.requiredParams) {
      if (params[key] == null) {
        throw new Error(`HttpDltSmsProvider: template "${templateId}" requires meta.templateParams.${key}`);
      }
    }
    const message = template.build(params);
    if (!template.pattern.test(message)) {
      throw new Error(
        `HttpDltSmsProvider: rendered text for template "${templateId}" does not match its registered shape — refusing to send`
      );
    }
    return message;
  }

  async send({ to, meta }) {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('SMS provider is not configured (SMS_API_URL / SMS_API_KEY)');
    }
    if (!this.dltSenderHeader) {
      throw new Error('DLT sender header is not registered — refusing to send unregistered SMS in production');
    }
    const message = this.#buildFromTemplate(meta);
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        message,
        senderId: this.dltSenderHeader,
        principalEntityId: this.dltPrincipalEntityId,
        templateId: meta?.templateId,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`SMS provider error: ${json?.message || res.statusText}`);
    return { success: true, provider: 'http-dlt-sms', messageId: json?.messageId || null, to, meta };
  }
}

/**
 * BulkSenders.in DLT SMS gateway — a GET-based API with a fixed, pre-approved DLT template.
 * The registered template text must be reproduced exactly (only the variable slots differ),
 * so this adapter builds the message itself from `meta` rather than using the generic `body`
 * text other providers accept (NTF-003, §12.4).
 */
export class BulkSendersSmsProvider extends SmsProvider {
  constructor({ baseUrl, apiKey, campaign, routeId, senderId, templateId, peId }) {
    super();
    this.baseUrl = baseUrl || 'https://login.bulksenders.in/app/smsapi/index.php';
    this.apiKey = apiKey;
    this.campaign = campaign;
    this.routeId = routeId;
    this.senderId = senderId;
    this.templateId = templateId;
    this.peId = peId;
  }

  /**
   * Resolves the registered DLT template for this send. Priority:
   * 1. `variables.dltTemplate` — an explicit key into BULKSENDERS_TEMPLATES;
   * 2. `EVENT_DLT_MAP[meta.eventName]` — the notification pipeline's event name;
   * 3. the legacy OTP meta shape ({ otpCode, validityMinutes }) used by PatientAuthService.
   * No match → refuse: free text can never reach the DLT gateway (NTF-003, §12.4).
   */
  #resolveTemplate(meta) {
    const variables = meta.variables || {};
    const key =
      (variables.dltTemplate && BULKSENDERS_TEMPLATES[variables.dltTemplate] && variables.dltTemplate) ||
      EVENT_DLT_MAP[meta.eventName] ||
      (meta.otpCode != null ? 'OTP' : null);
    return key ? { key, template: BULKSENDERS_TEMPLATES[key] } : null;
  }

  async send({ to, meta = {} }) {
    if (!this.apiKey || !this.senderId || !this.peId) {
      throw new Error(
        'BulkSenders SMS is not configured (SMS_BULKSENDERS_API_KEY / SENDER_ID / PE_ID)'
      );
    }

    const resolved = this.#resolveTemplate(meta);
    if (!resolved) {
      throw new Error(
        `BulkSendersSmsProvider has no registered DLT template for event "${meta.eventName || 'unknown'}" — refusing to send free-text SMS`
      );
    }

    // Legacy OTP callers pass otpCode/validityMinutes at the meta root; template builders
    // read from a single variables bag, so fold those in.
    const variables = {
      ...(meta.templateParams || {}),
      ...(meta.variables || {}),
    };
    if (meta.otpCode != null && variables.otpCode == null) variables.otpCode = meta.otpCode;
    if (meta.validityMinutes != null && variables.validityMinutes == null) {
      variables.validityMinutes = meta.validityMinutes;
    }

    const message = resolved.template.build(variables);
    const params = new URLSearchParams({
      key: this.apiKey,
      campaign: this.campaign || '',
      routeid: this.routeId,
      type: 'text',
      contacts: to,
      senderid: this.senderId,
      msg: message,
      template_id: resolved.template.id,
      pe_id: this.peId,
    });

    const res = await fetch(`${this.baseUrl}?${params.toString()}`, { method: 'GET' });
    const text = (await res.text()).trim();
    if (!res.ok) throw new Error(`BulkSenders SMS error: ${text || res.statusText}`);

    // The gateway answers HTTP 200 for failures too, signalling them in the body
    // (e.g. "ERR: Invalid Template"), so the status code alone is not a success check.
    if (!/^SMS-SHOOT-ID\//i.test(text)) {
      throw new Error(`BulkSenders SMS error: ${text || 'unrecognised gateway response'}`);
    }

    // Success body is "SMS-SHOOT-ID/<id>" — the id is what the delivery webhook
    // reports back, so it has to land in messageId for the delivery log to correlate.
    const messageId = text.slice(text.indexOf('/') + 1) || null;

    return { success: true, provider: 'bulksenders-sms', messageId, to, template: resolved.key, raw: text };
  }
}

/** Exotel voice adapter — fixed script/TTS outbound call (NTF-004, §12.1 30-minute reminder). */
export class ExotelVoiceProvider extends VoiceProvider {
  constructor({ sid, token, callerId }) {
    super();
    this.sid = sid;
    this.token = token;
    this.callerId = callerId;
  }

  async call({ to, script, meta }) {
    if (!this.sid || !this.token || !this.callerId) {
      throw new Error('Exotel voice is not configured (VOICE_EXOTEL_SID / TOKEN / CALLER_ID)');
    }
    const auth = Buffer.from(`${this.sid}:${this.token}`).toString('base64');
    const res = await fetch(`https://api.exotel.com/v1/Accounts/${this.sid}/Calls/connect.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: this.callerId, To: to, CallerId: this.callerId, ...meta }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Exotel error: ${json?.RestException?.Message || res.statusText}`);
    return { success: true, provider: 'exotel-voice', callId: json?.Call?.Sid || null, to, preview: script?.slice?.(0, 120), meta };
  }
}

/**
 * Provider factory — resolves MOCK vs real adapter per channel from config (NTF-001).
 * Defaults to mock so local/dev/test never depend on external credentials.
 */
export function createDefaultProviders(config = {}) {
  const np = config.notificationProviders || {};

  const whatsapp =
    np.whatsapp?.provider === 'WHATSAPP_CLOUD'
      ? new WhatsAppCloudProvider(np.whatsapp)
      : new MockWhatsAppProvider();

  const sms =
    np.sms?.provider === 'HTTP_DLT'
      ? new HttpDltSmsProvider(np.sms)
      : np.sms?.provider === 'BULKSENDERS'
        ? new BulkSendersSmsProvider(np.sms.bulkSenders)
        : new MockSmsProvider();

  // Hard production guard (consistent with the required-secret guards in config/env.js):
  // SMS_PROVIDER unset/invalid silently resolves to MockSmsProvider everywhere else, but in
  // production that means real patient-facing SMS (OTPs, reminders) would silently go nowhere
  // instead of being sent — fail startup loudly rather than proceeding with a mock.
  if (process.env.NODE_ENV === 'production' && sms instanceof MockSmsProvider) {
    throw new Error(
      'SMS_PROVIDER is unset or invalid in production — refusing to start with MockSmsProvider. ' +
        'Set SMS_PROVIDER=HTTP_DLT or SMS_PROVIDER=BULKSENDERS with valid credentials.'
    );
  }

  const voice = np.voice?.provider === 'EXOTEL' ? new ExotelVoiceProvider(np.voice) : new MockVoiceProvider();

  return {
    EMAIL: new MockEmailProvider(), // real SMTP transport requires adding a mail library — documented limitation
    SMS: sms,
    WHATSAPP: whatsapp,
    IN_APP: new InAppProvider(),
    PUSH: new MockPushProvider(), // real FCM requires firebase-admin — documented limitation
    VOICE: voice,
  };
}

export default {
  EmailProvider,
  SmsProvider,
  WhatsAppProvider,
  PushProvider,
  VoiceProvider,
  createDefaultProviders,
};
