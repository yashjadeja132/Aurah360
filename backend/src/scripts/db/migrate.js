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

// Import models so schemas register
import '../../models/User.model.js';
import '../../models/RefreshToken.model.js';
import '../../models/Patient.model.js';
import '../../models/Appointment.model.js';
import '../../models/Invoice.model.js';
import '../../models/Lead.model.js';

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
