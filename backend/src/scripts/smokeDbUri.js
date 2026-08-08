/**
 * Builds a connection URI pointing at a DEDICATED throwaway database for smoke scripts, which
 * call dropDatabase() on connect.
 *
 * This exists because the naive `uri.replace(/\/([^/?]+)$/, '/smoke_db')` silently no-ops on any
 * URI that does not end in a bare database name — e.g. `mongodb+srv://host/` or
 * `mongodb://host/db?retryWrites=true`. When it no-ops, the script connects to the REAL database
 * and drops it. That happened once already and destroyed the seeded development data. Parsing the
 * URI properly and asserting the swap happened turns silent data loss into a loud failure.
 *
 * Parsed by hand rather than with WHATWG URL because a mongodb URI may carry comma-separated
 * seed-list hosts (`mongodb://h1:27017,h2:27017/db`), which `new URL()` rejects outright.
 */
const MONGO_URI_PATTERN = /^(mongodb(?:\+srv)?:\/\/)([^/?]*)(?:\/([^?]*))?(\?.*)?$/;

export function smokeDbUri(baseUri, smokeDbName) {
  if (!smokeDbName || !/^[A-Za-z0-9_-]+$/.test(smokeDbName)) {
    throw new Error(`smokeDbUri: unsafe smoke database name ${JSON.stringify(smokeDbName)}`);
  }

  const match = MONGO_URI_PATTERN.exec(baseUri || '');
  if (!match) {
    throw new Error('smokeDbUri: MONGODB_URI is not a parseable mongodb:// or mongodb+srv:// URI');
  }
  const [, scheme, credentialsAndHosts, appDbName, query = ''] = match;
  if (!credentialsAndHosts) {
    throw new Error('smokeDbUri: MONGODB_URI has no host component');
  }
  if (appDbName && appDbName === smokeDbName) {
    throw new Error(`smokeDbUri: refusing to drop the application database "${appDbName}"`);
  }

  const result = `${scheme}${credentialsAndHosts}/${smokeDbName}${query}`;

  // Belt and braces: the result must actually name the smoke database, so a future regex change
  // that stops matching fails loudly instead of dropping a production database.
  if (!new RegExp(`/${smokeDbName}(\\?|$)`).test(result)) {
    throw new Error(`smokeDbUri: failed to target ${smokeDbName} — refusing to run a destructive smoke test`);
  }
  return result;
}

export default smokeDbUri;
