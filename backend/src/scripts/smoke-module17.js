/**
 * Module 17 smoke — patient auth, ownership, dashboard, booking, records, billing, feedback.
 */
import '../config/env.js';

const BASE = process.env.API_BASE || 'http://localhost:5000/api/v1';
const PASSWORD = process.env.SEED_PATIENT_PASSWORD || 'Patient@12345';

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
  // Discover a portal patient via staff login + patient list if needed
  const staffLogin = await req('POST', '/auth/login', {
    body: {
      email: process.env.SEED_OWNER_EMAIL || 'admin@aurah360.local',
      password: process.env.SEED_OWNER_PASSWORD || 'ChangeMe@12345',
    },
  });
  assert(staffLogin.status === 200, 'Staff login failed');
  const staffToken = staffLogin.json.data.accessToken;

  const patients = await req('GET', '/patients?limit=50', { token: staffToken });
  const patientRows = patients.json.data?.items || patients.json.data || [];
  assert(patients.status === 200 && patientRows.length, 'No patients');

  const candidates = [
    'aarav.patel@example.local',
    'priya.shah@example.local',
    'rohan.mehta@example.local',
    'ananya.desai@example.local',
    'vikram.joshi@example.local',
  ];

  let login = null;
  let email = null;
  for (const candidate of candidates) {
    const attempt = await req('POST', '/patient/login', {
      body: { email: candidate, password: PASSWORD },
    });
    if (attempt.status === 200 && attempt.json.data?.accessToken) {
      login = attempt;
      email = candidate;
      break;
    }
  }
  assert(login, `Patient login failed for seeded portal accounts — run npm run seed`);
  const token = login.json.data.accessToken;
  const patientId = login.json.data.patient.id;
  const portalPatient = login.json.data.patient;
  console.log('✓ Login', email);

  // JWT type separation — staff token must not work on patient routes
  const staffOnPatient = await req('GET', '/patient/me', { token: staffToken });
  assert(staffOnPatient.status === 401, 'Staff JWT must not access patient portal');
  console.log('✓ JWT separation');

  const me = await req('GET', '/patient/me', { token });
  assert(me.status === 200 && me.json.data?.id === patientId, 'Me failed');
  console.log('✓ JWT / me');

  // Ownership — deny access to another patient's appointment
  let ownershipChecked = false;
  for (const other of patientRows.filter((p) => p.id !== patientId)) {
    const otherHistory = await req('GET', `/appointments/patient/${other.id}/history`, {
      token: staffToken,
    });
    const rows = Array.isArray(otherHistory.json.data)
      ? otherHistory.json.data
      : otherHistory.json.data?.items || [];
    const foreignId = rows[0]?.id;
    if (!foreignId) continue;
    const denied = await req('GET', `/patient/appointments/${foreignId}`, { token });
    assert(denied.status === 403 || denied.status === 404, 'Ownership not enforced');
    console.log('✓ Ownership validation');
    ownershipChecked = true;
    break;
  }
  if (!ownershipChecked) console.log('~ Ownership skipped (no foreign appointment)');

  const dash = await req('GET', '/patient/dashboard', { token });
  assert(dash.status === 200 && dash.json.data, 'Dashboard failed');
  console.log('✓ Dashboard');

  const history = await req('GET', '/patient/appointments', { token });
  assert(history.status === 200, 'Appointments list failed');
  console.log('✓ Appointments', Array.isArray(history.json.data) ? history.json.data.length : 'ok');

  // Book if we can find a doctor + branch from staff data
  const doctors = await req('GET', '/doctors?limit=1', { token: staffToken });
  const doctor = doctors.json.data?.[0];
  const branchId = portalPatient.primaryBranchId || doctor?.branches?.[0];
  if (doctor && branchId) {
    const date = new Date();
    date.setDate(date.getDate() + 10);
    const dateStr = date.toISOString().slice(0, 10);
    const slots = await req(
      'GET',
      `/patient/appointments/slots?doctorId=${doctor.id}&date=${dateStr}&branchId=${branchId}`,
      { token }
    );
    const slot = slots.json.data?.slots?.[0] || slots.json.data?.[0];
    if (slot?.startTime && slot?.endTime) {
      const book = await req('POST', '/patient/appointments', {
        token,
        body: {
          doctorId: doctor.id,
          branchId,
          appointmentDate: dateStr,
          startTime: slot.startTime,
          endTime: slot.endTime,
          appointmentType: 'CONSULTATION',
        },
      });
      assert(book.status === 201, `Booking failed ${JSON.stringify(book.json)}`);
      console.log('✓ Appointment booking', book.json.data?.appointmentNumber);
    } else {
      console.log('~ Booking skipped (no slots)');
    }
  } else {
    console.log('~ Booking skipped (no doctor/branch)');
  }

  const consults = await req('GET', '/patient/consultations', { token });
  assert(consults.status === 200, 'Consultations failed');
  console.log('✓ Medical records (consultations)');

  const plans = await req('GET', '/patient/treatment-plans', { token });
  assert(plans.status === 200, 'Treatment plans failed');
  console.log('✓ Treatment progress');

  const invoices = await req('GET', '/patient/invoices', { token });
  assert(invoices.status === 200, 'Invoices failed');
  const inv =
    invoices.json.data?.items?.[0] ||
    (Array.isArray(invoices.json.data) ? invoices.json.data[0] : null);
  if (inv?.id) {
    const print = await req('GET', `/patient/invoices/${inv.id}/print`, { token });
    assert(print.status === 200, 'Invoice download/print failed');
    console.log('✓ Invoice download');
  } else {
    console.log('~ Invoice download skipped (no invoices)');
  }

  const notif = await req('GET', '/patient/notifications', { token });
  assert(notif.status === 200, 'Notifications failed');
  console.log('✓ Notifications', notif.json.data?.length ?? 0);

  const feedback = await req('POST', '/patient/feedback', {
    token,
    body: {
      clinicRating: 5,
      doctorRating: 5,
      comments: 'Smoke feedback',
      suggestions: 'None',
    },
  });
  assert(feedback.status === 201, `Feedback failed ${JSON.stringify(feedback.json)}`);
  console.log('✓ Feedback');

  const refresh = await req('POST', '/patient/refresh', {
    body: { refreshToken: login.json.data.refreshToken },
  });
  assert(refresh.status === 200 && refresh.json.data?.accessToken, 'Refresh failed');
  console.log('✓ Refresh token');

  console.log('\nModule 17 smoke passed.');
}

main().catch((err) => {
  console.error('Module 17 smoke FAILED:', err.message);
  process.exit(1);
});
