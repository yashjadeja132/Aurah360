import { AI_BLOCKED_FIELD_PATTERNS } from '../../enums/ai.js';

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const MRN_RE = /\bMRN[-\s]?\w+\b/gi;
const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g; // 12-digit government-ID shaped numbers

/**
 * De-identification filter (AI-002, §9.2). Strips identity fields from any object recursively
 * and scrubs residual PII-shaped text (emails, Indian mobile numbers, MRN tokens, 12-digit IDs)
 * from free-text fields. This is the mandatory gate before anything reaches an AI provider.
 */
class PiiRedactor {
  redactText(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(EMAIL_RE, '[redacted-email]')
      .replace(PHONE_RE, '[redacted-phone]')
      .replace(MRN_RE, '[redacted-mrn]')
      .replace(AADHAAR_RE, '[redacted-id]');
  }

  redactObject(input) {
    if (input == null) return input;
    if (Array.isArray(input)) return input.map((v) => this.redactObject(v));
    if (typeof input === 'string') return this.redactText(input);
    if (typeof input !== 'object') return input;

    const out = {};
    for (const [key, value] of Object.entries(input)) {
      if (AI_BLOCKED_FIELD_PATTERNS.some((blocked) => key.toLowerCase() === blocked.toLowerCase())) {
        continue; // drop entirely — never forwarded, not even redacted
      }
      out[key] = this.redactObject(value);
    }
    return out;
  }

  /** Builds the explicit input manifest actually sent to the provider (AI-002). */
  buildManifest(context) {
    const redacted = this.redactObject(context);
    return {
      manifest: redacted,
      fieldsRemoved: this.#diffKeys(context, redacted),
    };
  }

  #diffKeys(original, redacted, prefix = '') {
    if (!original || typeof original !== 'object') return [];
    const removed = [];
    for (const key of Object.keys(original)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in (redacted || {}))) {
        removed.push(path);
      } else if (typeof original[key] === 'object' && original[key] !== null) {
        removed.push(...this.#diffKeys(original[key], redacted[key], path));
      }
    }
    return removed;
  }
}

export default PiiRedactor;
