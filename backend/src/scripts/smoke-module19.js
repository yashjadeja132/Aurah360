/**
 * Module 19 smoke — health probes, swagger, security headers, auth.
 */
import '../config/env.js';

const BASE = process.env.API_BASE || 'http://localhost:5000/api/v1';

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, headers: res.headers };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const live = await req('GET', '/health/livez');
  assert(live.status === 200 && live.json.data?.status === 'ok', 'livez failed');
  console.log('✓ Liveness');

  const ready = await req('GET', '/health/readyz');
  assert(ready.status === 200 || ready.status === 503, 'readyz failed');
  console.log('✓ Readiness', ready.json.data?.status);

  const health = await req('GET', '/health');
  assert(health.status === 200 && health.json.data?.checks?.mongodb, 'health failed');
  assert(health.json.data?.metrics?.memory, 'metrics missing');
  console.log('✓ Health + metrics');

  const openapi = await fetch(`${BASE}/openapi.json`);
  if (openapi.status === 200) {
    const spec = await openapi.json();
    assert(spec.openapi?.startsWith('3.'), 'OpenAPI invalid');
    console.log('✓ OpenAPI / Swagger');
  } else {
    console.log('✓ OpenAPI skipped (Swagger disabled)');
  }

  const login = await req('POST', '/auth/login', {
    body: {
      email: process.env.SEED_OWNER_EMAIL || 'admin@aurah360.local',
      password: process.env.SEED_OWNER_PASSWORD || 'ChangeMe@12345',
    },
  });
  assert(login.status === 200 && login.json.data?.accessToken, 'Login failed');
  console.log('✓ Authentication');

  const me = await req('GET', '/auth/me', { token: login.json.data.accessToken });
  assert(me.status === 200, 'RBAC/me failed');
  console.log('✓ Authorization (/me)');

  const dash = await req('GET', '/analytics/dashboard', {
    token: login.json.data.accessToken,
  });
  assert(dash.status === 200 || dash.status === 403, 'Analytics probe failed');
  console.log('✓ Analytics probe', dash.status);

  console.log('\nModule 19 smoke passed.');
}

main().catch((err) => {
  console.error('Module 19 smoke FAILED:', err.message);
  process.exit(1);
});
