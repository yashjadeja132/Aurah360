/**
 * Index / schema sync utility (placeholder migrations).
 * Mongoose models define indexes; this ensures they are applied.
 *
 * Usage: node src/scripts/db/migrate.js
 */
import '../../config/env.js';
import database from '../../config/database.js';
import logger from '../../libs/logger.js';
import mongoose from 'mongoose';

/**
 * Register EVERY model, via the barrel, so syncIndexes covers the whole schema.
 *
 * This used to hand-list six models, which quietly made the utility useless for the rest: an index
 * change on any unlisted model (LoyaltyLedgerEntry's redemption idempotency guard, for one) would
 * report "Migration utility complete" having never touched it. A migration tool that silently skips
 * the collection you changed is worse than no tool, because it reports success.
 */
import '../../models/index.js';

async function migrate() {
  await database.connect();
  logger.info('Syncing indexes for registered models…');
  const names = Object.keys(mongoose.models);
  for (const name of names) {
    try {
      await mongoose.models[name].syncIndexes();
      logger.info('Indexes synced', { model: name });
    } catch (err) {
      logger.warn('Index sync failed', { model: name, message: err.message });
    }
  }
  logger.info('Migration utility complete', { models: names.length });
  await database.disconnect();
}

migrate().catch(async (err) => {
  logger.error('Migration failed', { message: err.message });
  try {
    await database.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
