import RefreshToken from '../models/RefreshToken.model.js';
import PatientRefreshToken from '../models/PatientRefreshToken.model.js';
import logger from '../libs/logger.js';
import { securityLogger } from '../libs/logChannels.js';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const REVOKED_RETENTION_DAYS = 30;

/**
 * Purges expired / long-revoked refresh tokens.
 * Mongo TTL handles expiresAt; this cleans revoked leftovers and logs metrics.
 */
export async function runTokenCleanup() {
  const cutoff = new Date(Date.now() - REVOKED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [staffExpired, staffRevoked, patientExpired, patientRevoked] = await Promise.all([
    RefreshToken.deleteMany({ expiresAt: { $lte: now } }),
    RefreshToken.deleteMany({ revokedAt: { $ne: null, $lte: cutoff } }),
    PatientRefreshToken.deleteMany({ expiresAt: { $lte: now } }),
    PatientRefreshToken.deleteMany({ revokedAt: { $ne: null, $lte: cutoff } }),
  ]);

  const summary = {
    staffExpired: staffExpired.deletedCount || 0,
    staffRevoked: staffRevoked.deletedCount || 0,
    patientExpired: patientExpired.deletedCount || 0,
    patientRevoked: patientRevoked.deletedCount || 0,
  };

  securityLogger.info('Token cleanup completed', summary);
  logger.info('Token cleanup completed', summary);
  return summary;
}

let timer;

export function startTokenCleanupJob() {
  if (timer) return;
  // Initial delay so boot is not blocked
  setTimeout(() => {
    runTokenCleanup().catch((err) =>
      logger.warn('Token cleanup failed', { message: err.message })
    );
  }, 60_000);

  timer = setInterval(() => {
    runTokenCleanup().catch((err) =>
      logger.warn('Token cleanup failed', { message: err.message })
    );
  }, CLEANUP_INTERVAL_MS);

  if (typeof timer.unref === 'function') timer.unref();
  logger.info('Token cleanup job scheduled', { intervalHours: 6 });
}

export function stopTokenCleanupJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export default { runTokenCleanup, startTokenCleanupJob, stopTokenCleanupJob };
