import fs from 'fs/promises';
import path from 'path';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import config from '../config/index.js';

/**
 * Signed file-access tokens (Task #24).
 *
 * Additive alternative to session auth for short-lived shareable links — HMAC-SHA256
 * over `fileId + expiresAt` keyed with `config.security.fileTokenSecret`. Not tied to
 * the local storage driver's key layout, so these helpers work the same once S3/etc.
 * lands behind StorageFactory.
 *
 * Token format: `${expiresAtEpochMs}.${hexHmac}`
 */
function signFileToken(fileId, expiresAt) {
  return createHmac('sha256', config.security.fileTokenSecret)
    .update(`${fileId}.${expiresAt}`)
    .digest('hex');
}

/** Issues a token for `fileId` valid for `ttlMinutes` (default config.security.fileTokenTtlMinutes). */
export function generateFileToken(fileId, ttlMinutes = config.security.fileTokenTtlMinutes) {
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  const signature = signFileToken(fileId, expiresAt);
  return { token: `${expiresAt}.${signature}`, expiresAt };
}

/** Verifies a token against `fileId`. Rejects malformed, tampered, and expired tokens. */
export function verifyFileToken(fileId, token) {
  if (!fileId || !token || typeof token !== 'string') return false;

  const separatorIndex = token.indexOf('.');
  if (separatorIndex === -1) return false;

  const expiresAtRaw = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || !signature) return false;
  if (Date.now() > expiresAt) return false;

  const expected = signFileToken(fileId, expiresAt);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Local filesystem storage adapter.
 * S3-compatible adapter will be added later behind the same interface.
 */
class LocalStorage {
  constructor(basePath = config.storage.localPath) {
    this.basePath = path.resolve(basePath);
  }

  async #ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  async save(buffer, { folder = 'misc', filename, mimeType } = {}) {
    const safeName = filename || `${randomUUID()}`;
    const relative = path.join(folder, safeName);
    const absolute = path.join(this.basePath, relative);

    await this.#ensureDir(path.dirname(absolute));
    await fs.writeFile(absolute, buffer);

    return {
      driver: 'local',
      key: relative.replace(/\\/g, '/'),
      mimeType: mimeType || null,
      size: buffer.length,
    };
  }

  async getAbsolutePath(key) {
    return path.join(this.basePath, key);
  }

  async delete(key) {
    const absolute = path.join(this.basePath, key);
    try {
      await fs.unlink(absolute);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Real short-lived signed URL (Task #24) — HMAC-signed token over `fileId` + expiry,
   * appended as `?token=` on the auth-gated file route. `fileId` is the Mongo document/photo
   * id (not the storage key), so the same token scheme carries over once S3/etc. lands.
   */
  async getSignedUrl(key, { fileId, ttlMinutes } = {}) {
    if (!fileId) throw new Error('getSignedUrl requires a fileId to sign the token against');
    const { token, expiresAt } = generateFileToken(fileId, ttlMinutes);
    return { url: `/uploads/${key}?token=${token}`, token, expiresAt };
  }
}

export default LocalStorage;
