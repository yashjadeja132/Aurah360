/**
 * Real database restore (BCM-001) — shells out to `mongorestore`. Requires an explicit
 * --confirm flag so a bare invocation never accidentally restores over a live database.
 * Replaces the RC1 restore.placeholder.js.
 *
 * Usage: node src/scripts/db/restore.js <backupDir> --confirm [--drop]
 */
import '../../config/env.js';
import { spawnSync } from 'child_process';
import fs from 'fs';
import config from '../../config/index.js';

const backupDir = process.argv[2];
const confirmed = process.argv.includes('--confirm');
const drop = process.argv.includes('--drop');

if (!backupDir || !fs.existsSync(backupDir)) {
  console.error(JSON.stringify({ success: false, message: 'Provide an existing backup directory as the first argument.' }));
  process.exit(1);
}

if (!confirmed) {
  console.error(
    JSON.stringify({
      success: false,
      message:
        'Refusing to restore without --confirm. Never restore over production without a verified backup window and change approval.',
      hint: `node src/scripts/db/restore.js ${backupDir} --confirm`,
    })
  );
  process.exit(1);
}

const args = ['--uri', config.mongo.uri, backupDir];
if (drop) args.push('--drop');

const result = spawnSync('mongorestore', args, { stdio: 'inherit' });

if (result.error) {
  console.error(
    JSON.stringify({
      success: false,
      message: 'mongorestore was not found. Install the MongoDB Database Tools on this host/CI runner.',
      error: result.error.message,
    })
  );
  process.exit(1);
}

if (result.status !== 0) {
  console.error(JSON.stringify({ success: false, message: 'mongorestore exited with a non-zero status', exitCode: result.status }));
  process.exit(result.status || 1);
}

console.log(JSON.stringify({ success: true, action: 'restore', backupDir, dropped: drop, completedAt: new Date().toISOString() }, null, 2));
