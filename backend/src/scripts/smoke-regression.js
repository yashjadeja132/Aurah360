/**
 * Final QA regression — light probes across Modules 1–18 surfaces.
 * Does not mutate business data. Requires seeded DB + running API.
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
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const login = await req('POST', '/auth/login', {
    body: {
      email: process.env.SEED_OWNER_EMAIL || 'admin@aurah360.local',
      password: process.env.SEED_OWNER_PASSWORD || 'ChangeMe@12345',
    },
  });
  assert(login.status === 200 && login.json.data?.accessToken, 'Authentication failed');
  const token = login.json.data.accessToken;
  console.log('✓ Authentication');

  const probes = [
    ['RBAC /me', '/auth/me'],
    ['Branches', '/branches?page=1&limit=5'],
    ['Doctors', '/doctors?page=1&limit=5'],
    ['Patients', '/patients?page=1&limit=5'],
    ['Scheduling holidays', '/scheduling/holidays?page=1&limit=5'],
    ['Appointments', '/appointments?page=1&limit=5'],
    ['Reception today', '/reception/appointments/today'],
    ['EMR templates', '/consultations/templates'],
    ['Treatments', '/treatment-sessions/dashboard'],
    ['Inventory', '/inventory/dashboard'],
    ['Billing', '/billing?page=1&limit=5'],
    ['CRM', '/crm/dashboard'],
    ['Notifications', '/notifications/inbox?page=1&limit=5'],
    ['Reports', '/reports/dashboards/owner'],
    ['Analytics', '/analytics/dashboard'],
    ['Health readiness', '/health/readyz'],
  ];

  for (const [label, path] of probes) {
    const r = await req('GET', path, { token });
    // 200 OK, 403 forbidden (role), 422 validation — all prove route exists
    assert(
      [200, 403, 422, 400].includes(r.status),
      `${label} unexpected status ${r.status}`
    );
    console.log(`✓ ${label} (${r.status})`);
  }

  // Patient portal auth surface (separate JWT)
  const portal = await req('POST', '/patient/login', {
    body: {
      email: 'aarav.patel@example.local',
      password: process.env.SEED_PATIENT_PASSWORD || 'Patient@12345',
    },
  });
  assert([200, 401].includes(portal.status), `Patient portal login ${portal.status}`);
  console.log(`✓ Patient Portal (${portal.status})`);

  console.log('\nRegression smoke passed (final QA).');
}

main().catch((err) => {
  console.error('Regression FAILED:', err.message);
  process.exit(1);
});
