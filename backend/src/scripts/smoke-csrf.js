/**
 * Ad-hoc smoke test for the double-submit-cookie CSRF protection (Task #41).
 * Not part of Vitest — isolated test DB, self-cleaning. Mirrors the supertest
 * pattern used in smoke-file-access.js.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import request from 'supertest';
import config from '../config/index.js';
import App from '../app.js';
import TokenService from '../services/TokenService.js';
import { ROLES } from '../constants/roles.js';

const tokenService = new TokenService();

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_csrf'));
  await mongoose.connection.dropDatabase();

  const app = new App().getExpressApp();

  const userId = new mongoose.Types.ObjectId().toString();
  const accessToken = tokenService.signAccessToken({
    sub: userId,
    role: ROLES.OWNER,
    permissions: [],
  });

  // POST /auth/logout is state-changing, does not require `authenticate`, and tolerates
  // a bogus refresh token (AuthService.logout no-ops if the hash doesn't match anything) —
  // it's a safe target for exercising the CSRF gate in isolation.

  // (a) Cookie-authenticated request, NO X-CSRF-Token header -> rejected 403.
  const noHeaderRes = await request(app)
    .post(`${config.app.apiPrefix}/auth/logout`)
    .set('Cookie', [
      `access_token=${accessToken}`,
      'refresh_token=bogus-refresh-token',
      'csrf_token=abc123',
    ])
    .send({});
  assert(
    noHeaderRes.status === 403,
    `Cookie session without CSRF header should be 403, got ${noHeaderRes.status} (${JSON.stringify(noHeaderRes.body)})`
  );
  console.log('(a) Cookie session, missing CSRF header -> 403: PASS');

  // (a2) Cookie-authenticated request with a MISMATCHED X-CSRF-Token header -> rejected 403.
  const mismatchRes = await request(app)
    .post(`${config.app.apiPrefix}/auth/logout`)
    .set('Cookie', [
      `access_token=${accessToken}`,
      'refresh_token=bogus-refresh-token',
      'csrf_token=abc123',
    ])
    .set('X-CSRF-Token', 'not-the-right-value')
    .send({});
  assert(
    mismatchRes.status === 403,
    `Cookie session with mismatched CSRF header should be 403, got ${mismatchRes.status}`
  );
  console.log('(a2) Cookie session, mismatched CSRF header -> 403: PASS');

  // (b) Same cookie-authenticated request WITH the matching X-CSRF-Token header -> succeeds.
  const matchingRes = await request(app)
    .post(`${config.app.apiPrefix}/auth/logout`)
    .set('Cookie', [
      `access_token=${accessToken}`,
      'refresh_token=bogus-refresh-token',
      'csrf_token=abc123',
    ])
    .set('X-CSRF-Token', 'abc123')
    .send({});
  assert(
    matchingRes.status === 200,
    `Cookie session with matching CSRF header should be 200, got ${matchingRes.status} (${JSON.stringify(matchingRes.body)})`
  );
  console.log('(b) Cookie session, matching CSRF header -> 200: PASS');

  // (c) Bearer-token-authenticated request, no cookies at all -> unaffected by the CSRF
  // check, whether or not an X-CSRF-Token header is present.
  const bearerNoHeaderRes = await request(app)
    .post(`${config.app.apiPrefix}/auth/logout`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({});
  assert(
    bearerNoHeaderRes.status === 200,
    `Bearer auth without CSRF header should be unaffected (200), got ${bearerNoHeaderRes.status} (${JSON.stringify(bearerNoHeaderRes.body)})`
  );
  console.log('(c) Bearer auth, no CSRF header -> 200 (unaffected): PASS');

  const bearerWithHeaderRes = await request(app)
    .post(`${config.app.apiPrefix}/auth/logout`)
    .set('Authorization', `Bearer ${accessToken}`)
    .set('X-CSRF-Token', 'irrelevant-value')
    .send({});
  assert(
    bearerWithHeaderRes.status === 200,
    `Bearer auth with an (irrelevant) CSRF header should still be 200, got ${bearerWithHeaderRes.status}`
  );
  console.log('(c2) Bearer auth, irrelevant CSRF header present -> 200 (unaffected): PASS');

  // (d) Sanity check: GET requests (non-state-changing) are never blocked by the CSRF gate,
  // even with a cookie session and no CSRF header.
  const getRes = await request(app)
    .get(`${config.app.apiPrefix}/auth/me`)
    .set('Cookie', [`access_token=${accessToken}`, 'csrf_token=abc123']);
  assert(
    getRes.status !== 403 || getRes.body?.error?.code !== 'CSRF_TOKEN_INVALID',
    `GET request should never be blocked by the CSRF gate, got ${getRes.status} (${JSON.stringify(getRes.body)})`
  );
  console.log('(d) GET request with cookie session, no CSRF header -> not CSRF-blocked: PASS');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
