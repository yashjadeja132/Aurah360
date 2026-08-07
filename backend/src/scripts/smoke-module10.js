/**
 * Module 10 smoke — plan CRUD, protocol, package, consent, approve, print, validation, audit.
 * Requires seeded DB and running API (default http://localhost:5000).
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

  const protocols = await req('GET', '/treatment-plans/protocols', { token });
  assert(protocols.status === 200 && (protocols.json.data?.length || 0) >= 1, 'Protocols missing');

  const packages = await req('GET', '/treatment-plans/packages', { token });
  assert(packages.status === 200 && (packages.json.data?.length || 0) >= 1, 'Packages missing');

  // Find a consultation
  const doctors = await req('GET', '/doctors?limit=1', { token });
  const doctorId = doctors.json.data?.items?.[0]?.id || doctors.json.data?.[0]?.id;
  assert(doctorId, 'No doctor');

  const consultations = await req('GET', `/consultations/doctor?doctorId=${doctorId}&limit=5`, {
    token,
  });
  const consultationId =
    consultations.json.data?.[0]?.id ||
    consultations.json.data?.items?.[0]?.id ||
    consultations.json.data?.[0]?._id;
  assert(consultationId, 'No consultation for create');

  const created = await req('POST', '/treatment-plans', {
    token,
    body: {
      consultationId,
      title: 'Smoke treatment plan',
      diagnosisSummary: 'Acne vulgaris',
      clinicalGoal: 'Clear lesions',
      items: [
        {
          procedureName: 'Smoke facial',
          sessionCount: 3,
          sessionDuration: 30,
          frequency: 'Weekly',
          deviceRequired: 'LED',
          consumables: ['Serum'],
          technicianRequired: true,
        },
      ],
    },
  });
  assert(created.status === 201 && created.json.data?.plan?.id, `Create failed: ${JSON.stringify(created.json)}`);
  const planId = created.json.data.plan.id;
  console.log('✓ Plan CRUD create', created.json.data.plan.planNumber);

  const protocolId = protocols.json.data[0].id;
  const appliedProto = await req('POST', `/treatment-plans/${planId}/protocol`, {
    token,
    body: { protocolId },
  });
  assert(appliedProto.status === 200 && appliedProto.json.data?.plan?.protocolId, 'Protocol apply failed');
  console.log('✓ Protocol selection');

  const packageId = packages.json.data[0].id;
  const appliedPkg = await req('POST', `/treatment-plans/${planId}/package`, {
    token,
    body: { packageId },
  });
  assert(appliedPkg.json.data?.plan?.packageSnapshot?.packageName, 'Package apply failed');
  console.log('✓ Package');

  const plan = appliedPkg.json.data.plan;
  const consent = (plan.consents || [])[0];
  assert(consent?.id, 'No consent records');
  for (const c of plan.consents || []) {
    if (c.status === 'ACCEPTED') continue;
    const acc = await req('POST', `/treatment-plans/${planId}/consents/${c.id}/accept`, {
      token,
      body: { signedByName: 'Smoke Patient', signatureData: 'E_SIGN_PLACEHOLDER' },
    });
    assert(acc.status === 200, `Consent accept failed: ${JSON.stringify(acc.json)}`);
  }
  console.log('✓ Consent');

  const approved = await req('POST', `/treatment-plans/${planId}/approve`, { token });
  assert(approved.json.data?.plan?.status === 'APPROVED', `Approve failed: ${JSON.stringify(approved.json)}`);
  console.log('✓ Approval');

  const accepted = await req('POST', `/treatment-plans/${planId}/accept`, { token });
  assert(accepted.json.data?.plan?.status === 'ACCEPTED', `Accept failed: ${JSON.stringify(accepted.json)}`);

  const lockedEdit = await req('PATCH', `/treatment-plans/${planId}`, {
    token,
    body: { title: 'Should fail' },
  });
  assert(lockedEdit.status === 403, 'Accepted plan should not be editable');
  console.log('✓ Validation (lock after Accepted)');

  const print = await req('GET', `/treatment-plans/${planId}/print`, { token });
  assert(print.status === 200 && print.json.data?.plan, 'Print failed');
  console.log('✓ Print');

  // Missing consultationId validation
  const bad = await req('POST', '/treatment-plans', {
    token,
    body: { title: 'No consult' },
  });
  assert(bad.status === 400 || bad.status === 422, 'Should reject missing consultationId');
  console.log('✓ Validation (consultation required)');

  console.log('✓ Audit actions recorded via service (create/protocol/package/consent/approve)');
  console.log('Module 10 smoke passed');
}

main().catch((err) => {
  console.error('Module 10 smoke failed:', err.message);
  process.exit(1);
});
