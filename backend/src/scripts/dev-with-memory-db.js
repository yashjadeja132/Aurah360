/**
 * DEV-ONLY launcher for machines with no local mongod and no Docker: starts an in-process
 * MongoDB (mongodb-memory-server), seeds it, then boots the real server against it.
 *
 * Data is EPHEMERAL unless MEMORY_DB_PATH is set — it lives only as long as this process, which
 * is why the seed runs on every start. Seeding happens in a CHILD process because seed.js
 * self-executes on import and disconnects when done, so it cannot be awaited in-process.
 *
 * Never use this in production: real deployments point MONGODB_URI at a real cluster and use
 * `npm start`. Redis stays optional either way — server.js already downgrades an unreachable
 * Redis to a warning, so this comes up with the HTTP API and event bus live but the BullMQ
 * workers disabled.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { MongoMemoryServer } from 'mongodb-memory-server';

const here = path.dirname(fileURLToPath(import.meta.url));

const instance = { dbName: 'aurah360_clinicos', port: 27017 };
if (process.env.MEMORY_DB_PATH) {
  fs.mkdirSync(process.env.MEMORY_DB_PATH, { recursive: true });
  instance.dbPath = process.env.MEMORY_DB_PATH;
  instance.storageEngine = 'wiredTiger';
}

const mongod = await MongoMemoryServer.create({ instance });
const uri = mongod.getUri('aurah360_clinicos');
process.env.MONGODB_URI = uri;
console.log(`[dev-memory-db] MongoDB ready at ${uri}`);

if (process.env.SKIP_SEED !== 'true') {
  console.log('[dev-memory-db] seeding…');
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, 'seed.js')], {
      env: { ...process.env, MONGODB_URI: uri },
      stdio: 'inherit',
    });
    child.on('exit', resolve);
  });
  if (code !== 0) {
    console.error(`[dev-memory-db] seed failed with exit code ${code} — aborting`);
    await mongod.stop();
    process.exit(1);
  }
  console.log('[dev-memory-db] seed complete');
}

await import('../server.js');

const shutdown = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
