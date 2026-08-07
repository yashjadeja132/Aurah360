import crypto from 'crypto';

/** RFC 4648 base32 (no external dependency). */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder) {
    const lastChunk = bits.slice(-remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(input) {
  const clean = input.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP — SHA-1, 6 digits, 30-second step (industry standard, compatible with any TOTP app). */
export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function generateTotpToken(secret, timeMs = Date.now(), step = 30) {
  const counter = Math.floor(timeMs / 1000 / step);
  return hotp(base32Decode(secret), counter);
}

/** Verifies with a ±1 step window to tolerate clock drift. */
export function verifyTotpToken(secret, token, timeMs = Date.now(), step = 30, window = 1) {
  const counter = Math.floor(timeMs / 1000 / step);
  const secretBuffer = base32Decode(secret);
  for (let w = -window; w <= window; w += 1) {
    if (hotp(secretBuffer, counter + w) === String(token).padStart(6, '0')) return true;
  }
  return false;
}

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex'));
}

export default { generateTotpSecret, generateTotpToken, verifyTotpToken, generateBackupCodes };
