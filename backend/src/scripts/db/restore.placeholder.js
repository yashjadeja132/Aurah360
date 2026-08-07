/**
 * Database restore placeholder.
 * Wire to mongorestore in production after verifying backups.
 *
 * Suggested:
 *   mongorestore --uri="$MONGODB_URI" ./backups/YYYYMMDD
 */
import '../../config/env.js';
import config from '../../config/index.js';

console.log(
  JSON.stringify(
    {
      placeholder: true,
      action: 'restore',
      message:
        'Restore is a placeholder. Never restore over production without a verified backup window.',
      mongoUriHost: config.mongo.uri.replace(/\/\/.*@/, '//***@'),
      suggestedCommand: 'mongorestore --uri="$MONGODB_URI" ./backups/YYYYMMDD',
    },
    null,
    2
  )
);
