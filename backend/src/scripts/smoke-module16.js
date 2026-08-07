/**
 * Module 16 smoke — dashboards, aggregations, exports, scheduled reports.
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
  if (raw) {
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  }
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const t0 = Date.now();
  const login = await req('POST', '/auth/login', {
    body: {
      email: process.env.SEED_OWNER_EMAIL || 'admin@aurah360.local',
      password: process.env.SEED_OWNER_PASSWORD || 'ChangeMe@12345',
    },
  });
  assert(login.status === 200 && login.json?.data?.accessToken, 'Login failed');
  const token = login.json.data.accessToken;

  for (const type of ['owner', 'branch-manager', 'doctor', 'reception', 'crm', 'pharmacy']) {
    const dash = await req('GET', `/reports/dashboards/${type}`, { token });
    assert(dash.status === 200 && dash.json.data?.summary, `${type} dashboard failed`);
    console.log(`✓ ${type} dashboard`, Object.keys(dash.json.data.summary).length, 'metrics');
  }

  const analytics = await req('GET', '/reports/analytics', { token });
  assert(analytics.status === 200 && analytics.json.data?.kpis, 'Analytics failed');
  assert(analytics.json.data?.charts?.revenueTrend, 'Charts missing');
  console.log('✓ Aggregations / analytics KPIs', analytics.json.data.kpis);

  const report = await req('GET', '/reports/generate/appointments', { token });
  assert(report.status === 200 && Array.isArray(report.json.data?.rows), 'Generate report failed');
  console.log('✓ Report generate', report.json.data.rowCount, 'rows');

  const csv = await req('GET', '/reports/export/revenue?format=csv', { token, raw: true });
  assert(csv.status === 200 && csv.text.includes('Date'), `CSV export failed ${csv.status}`);
  console.log('✓ Export CSV', csv.text.split(/\r?\n/).length, 'lines');

  const excel = await req('GET', '/reports/export/payments?format=excel', { token, raw: true });
  assert(excel.status === 200 && excel.text.includes('Workbook'), 'Excel export failed');
  console.log('✓ Export Excel');

  const pdf = await req('GET', '/reports/export/leads?format=pdf', { token, raw: true });
  assert(pdf.status === 200 && pdf.text.includes('placeholder'), 'PDF placeholder failed');
  console.log('✓ Export PDF placeholder');

  const scheduled = await req('GET', '/reports/scheduled', { token });
  assert(scheduled.status === 200 && Array.isArray(scheduled.json.data), 'Scheduled list failed');
  console.log('✓ Scheduled reports', scheduled.json.data.length);

  const created = await req('POST', '/reports/scheduled', {
    token,
    body: {
      name: `Smoke schedule ${Date.now()}`,
      reportType: 'queue',
      frequency: 'DAILY',
      format: 'csv',
      filters: {},
    },
  });
  assert(created.status === 201 && created.json.data?.id, `Create schedule failed ${JSON.stringify(created.json)}`);
  console.log('✓ Scheduled report created', created.json.data.id);

  const due = await req('POST', '/reports/scheduled/run-due', { token });
  assert(due.status === 200, 'Run due failed');
  console.log('✓ Scheduled run-due', due.json.data);

  const queued = await req('POST', '/reports/export/invoices/queue', {
    token,
    body: { format: 'csv', filters: {} },
  });
  assert(queued.status === 202 || queued.status === 200, `Queue export failed ${queued.status}`);
  console.log('✓ Heavy report queued', queued.json.data?.runId);

  const elapsed = Date.now() - t0;
  assert(elapsed < 30000, `Performance too slow: ${elapsed}ms`);
  console.log('✓ Performance', `${elapsed}ms`);

  console.log('\nModule 16 smoke passed.');
}

main().catch((err) => {
  console.error('Module 16 smoke FAILED:', err.message);
  process.exit(1);
});
