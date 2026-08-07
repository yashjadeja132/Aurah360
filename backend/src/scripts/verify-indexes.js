/**
 * Lists indexes for core collections (performance checklist helper).
 */
import '../config/env.js';
import database from '../config/database.js';
import mongoose from 'mongoose';
import logger from '../libs/logger.js';

const COLLECTIONS = [
  'users',
  'patients',
  'appointments',
  'invoices',
  'leads',
  'refreshtokens',
  'notifications',
];

async function main() {
  await database.connect();
  const db = mongoose.connection.db;
  for (const name of COLLECTIONS) {
    try {
      const indexes = await db.collection(name).indexes();
      console.log(`\n=== ${name} (${indexes.length}) ===`);
      for (const idx of indexes) {
        console.log(JSON.stringify({ name: idx.name, key: idx.key, unique: idx.unique }));
      }
    } catch (err) {
      console.log(`\n=== ${name} === missing (${err.message})`);
    }
  }
  await database.disconnect();
  logger.info('Index verification complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
