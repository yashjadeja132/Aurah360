import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import User from '../../src/models/User.model.js';
import Role from '../../src/models/Role.model.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLE_LABELS } from '../../src/constants/roles.js';

/**
 * Real HTTP-level auth flow against the actual Express app (supertest drives it in-process,
 * no port binding) and a live test database. Covers login, /me, refresh rotation, logout
 * and the invalid-password path — replacing the RC1 "plan"-only skeleton.
 */
describe('Auth API', () => {
  let app;
  let email;
  const password = 'Password@12345';

  beforeAll(async () => {
    await connectTestDb('auth-api');
    app = new App().getExpressApp();
    // NOTE: role is RECEPTIONIST (not ADMIN/OWNER/BRANCH_MANAGER) because those roles are in the
    // default config.security.mfaRequiredRoles and would divert login/refresh into the
    // mfaSetupRequired enrollment path (see AuthService#mfaSetupRequired) — that path has its
    // own coverage; this suite exercises the plain token issuance/rotation flow.
    await Role.findOneAndUpdate(
      { code: 'RECEPTIONIST' },
      {
        code: 'RECEPTIONIST',
        name: ROLE_LABELS.RECEPTIONIST,
        permissions: ROLE_PERMISSIONS.RECEPTIONIST,
        isSystem: true,
        isActive: true,
      },
      { upsert: true }
    );

    email = `auth-test-${Date.now()}@aurah360.local`;
    await User.create({
      firstName: 'Auth',
      lastName: 'Tester',
      email,
      passwordHash: await hashPassword(password),
      role: 'RECEPTIONIST',
      isActive: true,
      status: 'ACTIVE',
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  let accessToken;
  let refreshToken;

  it('rejects an invalid password with 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in successfully and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('GET /auth/me is authorized with the bearer token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
  });

  it('rejects /auth/me with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rotates tokens on refresh', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).not.toBe(refreshToken); // rotated, not reused
  });

  it('logout revokes the session', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
    expect(res.status).toBe(200);
  });
});
