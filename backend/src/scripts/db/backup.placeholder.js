/**
 * Database backup placeholder.
 * Wire to mongodump or managed backup in production.
 *
 * Suggested:
 *   mongodump --uri="$MONGODB_URI" --out=./backups/$(date +%Y%m%d)
 */
import '../../config/env.js';
import config from '../../config/index.js';

console.log(
  JSON.stringify(
    {
      placeholder: true,
      action: 'backup',
      message:
        'Backup is a placeholder. Use mongodump or your cloud provider snapshot tooling.',
      mongoUriHost: config.mongo.uri.replace(/\/\/.*@/, '//***@'),
      suggestedCommand: 'mongodump --uri="$MONGODB_URI" --out=./backups/YYYYMMDD',
    },
    null,
    2
  )
);
