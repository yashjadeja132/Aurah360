/**
 * Lightweight XSS hardening for string inputs.
 * Strips common script/event patterns without mutating non-strings.
 * Zod validators remain the primary input contract.
 */

const DANGEROUS =
  /<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|data\s*:\s*text\/html/gi;

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value.replace(DANGEROUS, '').trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return value;
}

export function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const cleaned = sanitizeValue(req.query);
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, cleaned);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }
  next();
}

export default sanitizeRequest;
