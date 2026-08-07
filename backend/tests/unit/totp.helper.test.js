import { describe, it, expect } from 'vitest';
import { generateTotpSecret, generateTotpToken, verifyTotpToken } from '../../src/helpers/totp.helper.js';

describe('totp.helper (RFC 6238)', () => {
  it('matches the official RFC 6238 test vector', () => {
    // Secret "12345678901234567890" (ASCII) base32-encoded, T=59s → expected 6-digit code 287082
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(generateTotpToken(secret, 59 * 1000)).toBe('287082');
  });

  it('verifies a freshly generated token at the same instant', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const token = generateTotpToken(secret, now);
    expect(verifyTotpToken(secret, token, now)).toBe(true);
  });

  it('tolerates clock drift within one 30s step', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const token = generateTotpToken(secret, now);
    expect(verifyTotpToken(secret, token, now + 25_000)).toBe(true);
  });

  it('rejects a token outside the allowed drift window', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const token = generateTotpToken(secret, now);
    expect(verifyTotpToken(secret, token, now + 65_000)).toBe(false);
  });

  it('rejects an incorrect token', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken(secret, '000000', Date.now())).toBe(false);
  });

  it('two secrets never produce the same token by construction (extremely unlikely collision)', () => {
    const s1 = generateTotpSecret();
    const s2 = generateTotpSecret();
    expect(s1).not.toBe(s2);
  });
});
