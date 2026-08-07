/**
 * Ad-hoc smoke test for the mfa-setup-required enrollment flow (SEC-021, not part of Vitest).
 *
 * Proves:
 *  1. A privileged-role user (role in MFA_REQUIRED_ROLES) with MFA not yet enabled who logs in
 *     with the correct password gets `mfaSetupRequired: true` + `mfaSetupToken` — no session.
 *  2. Using ONLY that mfaSetupToken (no Bearer/cookie session), the user can call
 *     POST /auth/mfa/setup/start then POST /auth/mfa/setup/confirm.
 *  3. A valid TOTP code on confirm enables MFA AND returns real access/refresh tokens (login
 *     is completed in the same call).
 *  4. An invalid TOTP code on confirm is rejected (and does not enable MFA / issue tokens).
 *
 * Forces MFA_REQUIRED_ROLES via process.env before config/env.js is imported, so this does not
 * require flipping the setting in the real .env (left empty there intentionally).
 */
// NOTE: ES module `import` statements are hoisted above ordinary statements, so setting
// process.env here and relying on later `import '../config/env.js'` would be too late — dotenv
// would already have run. Everything that depends on MFA_REQUIRED_ROLES is loaded dynamically
// below, after the env var is set, to guarantee ordering.
process.env.MFA_REQUIRED_ROLES = 'OWNER';

const mongoose = (await import('mongoose')).default;
const request = (await import('supertest')).default;
await import('../config/env.js');
const config = (await import('../config/index.js')).default;
const App = (await import('../app.js')).default;
const User = (await import('../models/User.model.js')).default;
const TokenService = (await import('../services/TokenService.js')).default;
const { hashPassword } = await import('../helpers/crypto.helper.js');
const { generateTotpToken } = await import('../helpers/totp.helper.js');

const tokenService = new TokenService();
const app = new App().getExpressApp();

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_mfa_enrollment'));
  await mongoose.connection.dropDatabase();

  const email = 'mfa-enrollment-owner@example.com';
  const password = 'SuperSecret123!';

  await User.create({
    firstName: 'Enroll',
    lastName: 'Owner',
    email,
    passwordHash: await hashPassword(password),
    role: 'OWNER',
  });

  // 1. Login gets routed into enrollment, no session issued.
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  console.log('login status:', loginRes.status, 'body:', loginRes.body.data);

  if (loginRes.status !== 200 || !loginRes.body.data?.mfaSetupRequired) {
    throw new Error('Expected mfaSetupRequired: true from login');
  }
  const { mfaSetupToken } = loginRes.body.data;
  if (!mfaSetupToken) throw new Error('mfaSetupToken missing from login response');
  if (loginRes.body.data.accessToken) throw new Error('Login must NOT issue a session/accessToken here');

  // Sanity: the token really is a mfa_setup_required token for this user.
  const decoded = tokenService.verifyMfaSetupToken(mfaSetupToken);
  console.log('mfaSetupToken subject verified:', decoded.sub);

  // 2. setup/start using ONLY the mfaSetupToken (no Authorization header, no cookie).
  const startRes = await request(app)
    .post('/api/v1/auth/mfa/setup/start')
    .send({ mfaSetupToken });
  console.log('setup/start status:', startRes.status, 'has secret:', Boolean(startRes.body.data?.secret));

  if (startRes.status !== 200 || !startRes.body.data?.secret) {
    throw new Error('setup/start with mfaSetupToken should have succeeded and returned a secret');
  }
  const { secret } = startRes.body.data;

  // 3a. setup/confirm with an INVALID TOTP code must fail, no tokens, MFA stays disabled.
  const badConfirmRes = await request(app)
    .post('/api/v1/auth/mfa/setup/confirm')
    .send({ token: '000000', mfaSetupToken });
  console.log('setup/confirm (invalid code) status:', badConfirmRes.status, 'message:', badConfirmRes.body.message);

  if (badConfirmRes.status < 400) {
    throw new Error('setup/confirm with an invalid TOTP code should have failed');
  }
  const userAfterBadConfirm = await User.findOne({ email });
  if (userAfterBadConfirm.mfaEnabled) {
    throw new Error('MFA should not be enabled after a failed confirm');
  }

  // 3b. setup/confirm with a VALID TOTP code succeeds, enables MFA, and completes login.
  const validCode = generateTotpToken(secret);
  const confirmRes = await request(app)
    .post('/api/v1/auth/mfa/setup/confirm')
    .send({ token: validCode, mfaSetupToken });
  console.log(
    'setup/confirm (valid code) status:',
    confirmRes.status,
    'enabled:',
    confirmRes.body.data?.enabled,
    'has accessToken:',
    Boolean(confirmRes.body.data?.accessToken),
    'has refreshToken:',
    Boolean(confirmRes.body.data?.refreshToken)
  );

  if (confirmRes.status !== 200 || !confirmRes.body.data?.enabled) {
    throw new Error('setup/confirm with a valid TOTP code should have enabled MFA');
  }
  if (!confirmRes.body.data.accessToken || !confirmRes.body.data.refreshToken) {
    throw new Error('setup/confirm completed via mfaSetupToken should have returned real tokens');
  }

  // Those tokens must actually work as a normal session.
  const meRes = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${confirmRes.body.data.accessToken}`);
  console.log('me status with new accessToken:', meRes.status, 'email:', meRes.body.data?.user?.email);
  if (meRes.status !== 200 || meRes.body.data?.user?.email !== email) {
    throw new Error('accessToken issued by setup/confirm should authenticate /auth/me');
  }

  const userAfterConfirm = await User.findOne({ email });
  if (!userAfterConfirm.mfaEnabled) {
    throw new Error('MFA should be enabled after a successful confirm');
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch(async (err) => {
  console.error('SMOKE FAIL', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
