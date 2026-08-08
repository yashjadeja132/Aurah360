import mongoose from 'mongoose';

/**
 * Integration tests run against a dedicated `_test_<suite>` database on the same MongoDB
 * instance used for local dev — never the dev/prod database itself. Vitest runs test files
 * concurrently (each in its own isolated worker with its own module/mongoose singleton), so
 * every suite MUST pass a distinct `suiteName` — sharing one database name across files causes
 * "database is currently being dropped" races when one file's afterAll fires mid-query in another.
 */
/**
 * MongoDB caps a database name at 38 bytes on Windows/Atlas. The old scheme prefixed the app
 * database name (`aurah360_clinicos_test_<suite>` = up to 46 bytes) so EVERY suite failed to
 * connect — which is why most of this suite had never actually run. A short fixed prefix keeps the
 * longest current name at 29 bytes.
 */
const TEST_DB_PREFIX = 'a360t_';
const MONGO_MAX_DB_NAME_BYTES = 38;

/** scheme://[credentials@]hosts[/db][?query] — parsed by hand because a mongodb URI may carry a
 *  comma-separated seed list, which `new URL()` rejects. */
const MONGO_URI_PATTERN = /^(mongodb(?:\+srv)?:\/\/)([^/?]*)(?:\/([^?]*))?(\?.*)?$/;

export function testDbNameFor(suiteName) {
  const name = `${TEST_DB_PREFIX}${suiteName}`;
  if (Buffer.byteLength(name, 'utf8') > MONGO_MAX_DB_NAME_BYTES) {
    throw new Error(
      `Test database name "${name}" is ${Buffer.byteLength(name, 'utf8')} bytes; MongoDB allows `
        + `${MONGO_MAX_DB_NAME_BYTES}. Shorten the suiteName passed to connectTestDb().`
    );
  }
  return name;
}

/**
 * Guarded deliberately: dropTestDb() calls dropDatabase(), so a silent failure to swap the
 * database name would destroy the developer's app database. Any uncertainty throws.
 */
function testUriFor(suiteName) {
  const base = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aurah360_clinicos';
  const match = MONGO_URI_PATTERN.exec(base);
  if (!match) throw new Error('MONGODB_URI is not a parseable mongodb:// or mongodb+srv:// URI');

  const [, scheme, credentialsAndHosts, appDbName, query = ''] = match;
  if (!credentialsAndHosts) throw new Error('MONGODB_URI has no host component');

  const testDbName = testDbNameFor(suiteName);
  if (appDbName && testDbName === appDbName) {
    throw new Error(`Refusing to run tests against the application database "${appDbName}"`);
  }

  const uri = `${scheme}${credentialsAndHosts}/${testDbName}${query}`;
  if (!new RegExp(`/${testDbName}(\\?|$)`).test(uri)) {
    throw new Error(`Failed to target test database ${testDbName} — refusing to connect and drop`);
  }
  return uri;
}

export async function connectTestDb(suiteName) {
  if (!suiteName) throw new Error('connectTestDb(suiteName) requires a unique suite name per test file');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testUriFor(suiteName));
    /**
     * Drop on the way IN as well as on the way out.
     *
     * afterAll/dropTestDb only runs when a suite finishes. A suite that dies in beforeAll leaves its
     * entire database behind, and those leaks accumulate: this cluster hit its hard 500-collection
     * ceiling that way, at which point EVERY suite fails at beforeAll and no suite can ever reach
     * its own cleanup — a leak that permanently wedges the test environment.
     *
     * Dropping here makes each suite self-healing: it reclaims its own previous leak before
     * allocating anything. It is also what makes a run reproducible, since a suite now always
     * starts from an empty database rather than inheriting a half-written one.
     */
    await mongoose.connection.dropDatabase();
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
