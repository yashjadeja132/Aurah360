import mongoose from 'mongoose';

/**
 * Integration tests run against a dedicated `_test_<suite>` database on the same MongoDB
 * instance used for local dev — never the dev/prod database itself. Vitest runs test files
 * concurrently (each in its own isolated worker with its own module/mongoose singleton), so
 * every suite MUST pass a distinct `suiteName` — sharing one database name across files causes
 * "database is currently being dropped" races when one file's afterAll fires mid-query in another.
 */
function testUriFor(suiteName) {
  const base = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aurah360_clinicos';
  return base.replace(/\/([^/?]+)(\?.*)?$/, `/$1_test_${suiteName}$2`);
}

export async function connectTestDb(suiteName) {
  if (!suiteName) throw new Error('connectTestDb(suiteName) requires a unique suite name per test file');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testUriFor(suiteName));
  }
  return mongoose.connection;
}

export async function dropTestDb() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
}
