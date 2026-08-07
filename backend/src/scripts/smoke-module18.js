/**
 * Module 18 smoke — executive dashboard, category reports, exports, cache, permissions.
 */
import '../config/env.js';

const BASE = process.env.API_BASE || 'http://localhost:5000/api/v1';

async function req(method, path, { token, body, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return { status: res.status, text: await res.text(), headers: res.headers };
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
  assert(login.status === 200, 'Login failed');
  const token = login.json.data.accessToken;
  const perms = login.json.data.user?.permissions || [];
  assert(
    perms.includes('dashboard.view') || perms.includes('reports.*') || perms.includes('*'),
    'dashboard.view permission missing — re-seed'
  );
  console.log('✓ Permissions');

  const dash1 = await req('GET', '/analytics/dashboard', { token });
  assert(dash1.status === 200 && dash1.json.data?.widgets, 'Dashboard failed');
  console.log('✓ Dashboard loads', Object.keys(dash1.json.data.widgets).length, 'widgets');

  const dash2 = await req('GET', '/analytics/dashboard', { token });
  assert(dash2.status === 200, 'Dashboard cache miss path failed');
  console.log('✓ Redis cache path', dash2.json.data?.cached ? 'HIT' : 'MISS/OK');

  for (const cat of [
    'appointments',
    'patients',
    'doctors',
    'treatments',
    'billing',
    'inventory',
    'crm',
  ]) {
    const r = await req('GET', `/analytics/reports/${cat}?period=monthly`, { token });
    assert(r.status === 200 && r.json.data?.summary, `${cat} report failed`);
    console.log(`✓ ${cat} report`);
  }

  const ai = await req('GET', '/analytics/reports/ai', { token });
  assert(ai.status === 200 && ai.json.data?.placeholder, 'AI placeholder failed');
  console.log('✓ AI placeholder');

  const csv = await req('GET', '/analytics/reports/appointments/export?format=csv', {
    token,
    raw: true,
  });
  assert(csv.status === 200 && csv.text.includes('Date'), 'CSV export failed');
  console.log('✓ Export CSV');

  const xlsx = await req('GET', '/analytics/reports/billing/export?format=excel', {
    token,
    raw: true,
  });
  assert(xlsx.status === 200 && xlsx.text.length > 100, 'Excel export failed');
  console.log('✓ Export Excel');

  const pdf = await req('GET', '/analytics/reports/patients/export?format=pdf', {
    token,
    raw: true,
  });
  assert(pdf.status === 200 && pdf.text.includes('placeholder'), 'PDF placeholder failed');
  console.log('✓ Export PDF');

  const queued = await req('POST', '/analytics/reports/crm/export/queue', {
    token,
    body: { format: 'csv' },
  });
  assert(queued.status === 202 || queued.status === 200, 'Queue export failed');
  console.log('✓ BullMQ scheduled/heavy export', queued.json.data?.jobId || queued.json.data?.status);

  const filtered = await req(
    'GET',
    '/analytics/reports/appointments?period=weekly',
    { token }
  );
  assert(filtered.status === 200 && filtered.json.data?.trend, 'Charts/filters failed');
  console.log('✓ Charts + filters');

  console.log('\nModule 18 smoke passed.');
}

main().catch((err) => {
  console.error('Module 18 smoke FAILED:', err.message);
  process.exit(1);
});
