/**
 * Real database backup (BCM-001) — shells out to `mongodump` (must be installed on the host/
 * CI runner; it is not an npm package). Writes a timestamped folder, prints its size, and prunes
 * dumps older than BACKUP_RETENTION_DAYS. Replaces the RC1 backup.placeholder.js.
 *
 * Usage: node src/scripts/db/backup.js [outDir]
 */
import '../../config/env.js';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import config from '../../config/index.js';

const outRoot = process.argv[2] || './backups';
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outRoot, stamp);

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSizeBytes(full) : fs.statSync(full).size;
  }
  return total;
}

function pruneOld(root, days) {
  if (!fs.existsSync(root)) return [];
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const removed = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(entry.name);
    }
  }
  return removed;
}

fs.mkdirSync(outDir, { recursive: true });

const result = spawnSync('mongodump', ['--uri', config.mongo.uri, '--out', outDir], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(
    JSON.stringify({
      success: false,
      message: 'mongodump was not found. Install the MongoDB Database Tools on this host/CI runner.',
      error: result.error.message,
    })
  );
  process.exit(1);
}

if (result.status !== 0) {
  console.error(JSON.stringify({ success: false, message: 'mongodump exited with a non-zero status', exitCode: result.status }));
  process.exit(result.status || 1);
}

const sizeBytes = dirSizeBytes(outDir);
const pruned = pruneOld(outRoot, retentionDays);

console.log(
  JSON.stringify(
    {
      success: true,
      action: 'backup',
      outDir,
      sizeBytes,
      sizeMb: Number((sizeBytes / (1024 * 1024)).toFixed(2)),
      prunedOlderThanDays: retentionDays,
      pruned,
      completedAt: new Date().toISOString(),
    },
    null,
    2
  )
);
