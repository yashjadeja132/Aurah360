/**
 * Module 14 smoke — lead CRUD, kanban status, follow-ups, convert, tasks, reminders, reports.
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
  assert(login.status === 200 && login.json?.data?.accessToken, 'Login failed');
  const token = login.json.data.accessToken;

  const dash = await req('GET', '/crm/dashboard', { token });
  assert(dash.status === 200, `Dashboard failed ${JSON.stringify(dash.json)}`);
  console.log('✓ CRM dashboard', dash.json.data?.summary);

  const branches = await req('GET', '/branches?limit=1', { token });
  const branchId = branches.json.data?.items?.[0]?.id || branches.json.data?.[0]?.id;
  assert(branchId, 'No branch');

  const sources = await req('GET', '/masters/lead-sources?limit=5', { token });
  const sourceId =
    sources.json.data?.items?.[0]?.id ||
    sources.json.data?.[0]?.id ||
    null;

  const created = await req('POST', '/crm/leads', {
    token,
    body: {
      firstName: 'Smoke',
      lastName: 'Lead',
      phone: '9898989898',
      email: 'smoke.lead@example.local',
      gender: 'FEMALE',
      age: 28,
      city: 'Surat',
      branchId,
      sourceId,
      source: 'Google',
      campaign: 'Smoke Test',
      interestedServices: ['Hydrafacial'],
      budget: 15000,
      priority: 'HIGH',
      nextFollowUp: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  assert(created.status === 201 && created.json.data?.lead?.id, `Create failed ${JSON.stringify(created.json)}`);
  const leadId = created.json.data.lead.id;
  console.log('✓ Lead CRUD create', created.json.data.lead.leadNumber);

  const updated = await req('PATCH', `/crm/leads/${leadId}`, {
    token,
    body: { remarks: 'Updated by smoke' },
  });
  assert(updated.status === 200, 'Update failed');
  console.log('✓ Lead CRUD update');

  const users = await req('GET', '/users?limit=1', { token });
  const userId = users.json.data?.items?.[0]?.id || users.json.data?.[0]?.id;
  if (userId) {
    const assigned = await req('POST', `/crm/leads/${leadId}/assign`, {
      token,
      body: { assignedTo: userId },
    });
    assert(assigned.status === 200, `Assign failed ${JSON.stringify(assigned.json)}`);
    console.log('✓ Assign');
  }

  const status = await req('POST', `/crm/leads/${leadId}/status`, {
    token,
    body: { status: 'CONTACTED' },
  });
  assert(status.status === 200, `Kanban status failed ${JSON.stringify(status.json)}`);
  console.log('✓ Kanban status transition');

  const fu = await req('POST', `/crm/leads/${leadId}/follow-ups`, {
    token,
    body: {
      type: 'CALL',
      notes: 'Smoke follow-up',
      outcome: 'Interested',
      nextFollowUp: new Date(Date.now() + 2 * 86400000).toISOString(),
    },
  });
  assert(fu.status === 201, `Follow-up failed ${JSON.stringify(fu.json)}`);
  console.log('✓ Follow-ups');

  const task = await req('POST', '/crm/tasks', {
    token,
    body: {
      leadId,
      title: 'Smoke task',
      assigneeRole: 'CRM_EXECUTIVE',
      assignedTo: userId || undefined,
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    },
  });
  assert(task.status === 201 && task.json.data?.task?.id, `Task failed ${JSON.stringify(task.json)}`);
  console.log('✓ Task assignment');

  const pipeline = await req('GET', '/crm/pipeline', { token });
  assert(pipeline.status === 200 && pipeline.json.data?.columns, 'Pipeline failed');
  console.log('✓ Kanban pipeline columns', Object.keys(pipeline.json.data.columns).length);

  const reminders = await req('POST', '/crm/reminders/run', { token });
  assert(reminders.status === 200, `Reminders failed ${JSON.stringify(reminders.json)}`);
  console.log('✓ BullMQ reminder scan', reminders.json.data);

  const report = await req('GET', '/crm/reports/source', { token });
  assert(report.status === 200, 'Source report failed');
  console.log('✓ Reports source', report.json.data?.items?.length);

  const conv = await req('POST', `/crm/leads/${leadId}/convert`, {
    token,
    body: { lastName: 'Lead' },
  });
  assert(conv.status === 200 && conv.json.data?.patient?.id, `Convert failed ${JSON.stringify(conv.json)}`);
  assert(conv.json.data.lead.status === 'WON', 'Lead should be WON');
  assert(conv.json.data.lead.convertedPatientId, 'convertedPatientId missing');
  console.log('✓ Conversion via PatientService', conv.json.data.patient.mrn);

  const detail = await req('GET', `/crm/leads/${leadId}`, { token });
  assert(detail.json.data?.lead?.followUps?.length >= 1, 'CRM history missing after convert');
  console.log('✓ CRM history retained');

  console.log('\nModule 14 smoke passed.');
}

main().catch((err) => {
  console.error('Module 14 smoke FAILED:', err.message);
  process.exit(1);
});
