/**
 * Module 12 smoke — payment gate, session CRUD, progress, complete, timeline.
 * Does not mutate billing or treatment plan documents via session APIs.
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

  const dash = await req('GET', '/treatment-sessions/dashboard', { token });
  assert(dash.status === 200, `Dashboard failed ${JSON.stringify(dash.json)}`);
  console.log('✓ Dashboard', dash.json.data?.summary);

  const list = await req('GET', '/treatment-sessions?limit=50', { token });
  assert(list.status === 200 && Array.isArray(list.json.data), 'List failed');
  console.log('✓ Session list', list.json.data.length);

  const sessions = list.json.data || [];
  const sample = sessions[0];
  assert(sample?.treatmentPlanId, 'Need seeded sessions');

  // Progress / remaining / timeline
  const planId = sample.treatmentPlan?.id || sample.treatmentPlanId;
  const prog = await req('GET', `/treatment-sessions/progress/${planId}`, { token });
  assert(prog.status === 200 && prog.json.data?.progress, 'Progress failed');
  const progress = prog.json.data.progress;
  assert(typeof progress.completionPercent === 'number', 'completion % missing');
  assert(Array.isArray(progress.sessions), 'Timeline missing');
  console.log('✓ Progress / remaining / timeline', {
    completed: progress.completedSessions,
    remaining: progress.remainingSessions,
    pct: progress.completionPercent,
    timeline: progress.sessions.length,
  });

  // Payment gate — create unpaid finalized invoice and expect block
  const draft = await req('POST', '/billing', {
    token,
    body: {
      patientId: sample.patientId || sample.patient?.id,
      branchId: sample.branchId || sample.branch?.id,
      items: [
        {
          itemType: 'SERVICE',
          description: 'Unpaid gate test',
          quantity: 1,
          unitPrice: 100,
        },
      ],
    },
  });
  assert(draft.status === 201 && draft.json.data?.invoice?.id, 'Draft invoice failed');
  const unpaidId = draft.json.data.invoice.id;
  await req('POST', `/billing/${unpaidId}/finalize`, { token });
  const blocked = await req('POST', '/treatment-sessions', {
    token,
    body: {
      treatmentPlanId: planId,
      invoiceId: unpaidId,
      scheduledDate: new Date().toISOString(),
    },
  });
  assert(blocked.status >= 400, `Expected payment gate, got ${blocked.status}`);
  console.log('✓ Payment validation blocks unpaid');

  // Free capacity by cancelling active sessions (cancelled do not count toward limit).
  // Seed may have over-allocated past the plan limit.
  let createPlanId = planId;
  let createInvoiceId = sample.invoice?.id || sample.invoiceId;
  let remaining = progress.remainingSessions || 0;
  if (remaining <= 0) {
    const used = progress.usedSessions ?? progress.sessions?.length ?? 0;
    const limit = progress.totalSessions || 1;
    const over = Math.max(0, used - limit) + 1;
    const toFree = sessions.filter(
      (s) =>
        (s.treatmentPlan?.id || s.treatmentPlanId) === planId &&
        ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'].includes(s.status)
    );
    for (const s of toFree.slice(0, Math.min(toFree.length, Math.max(over, 1)))) {
      const c = await req('POST', `/treatment-sessions/${s.id}/cancel`, { token });
      assert(c.status === 200, `Cancel to free capacity failed ${JSON.stringify(c.json)}`);
    }
    const p2 = await req('GET', `/treatment-sessions/progress/${planId}`, { token });
    remaining = p2.json.data?.progress?.remainingSessions || 0;
    console.log('~ Freed capacity via cancel; remaining', remaining, {
      used,
      limit,
      over,
      cancelled: Math.min(toFree.length, Math.max(over, 1)),
    });
  }
  assert(remaining > 0 && createInvoiceId, 'No plan capacity for create test');
  const created = await req('POST', '/treatment-sessions', {
    token,
    body: {
      treatmentPlanId: createPlanId,
      invoiceId: createInvoiceId,
      scheduledDate: new Date().toISOString(),
      remarks: 'Smoke session',
    },
  });
  assert(
    created.status === 201 && created.json.data?.session?.id,
    `Create failed ${JSON.stringify(created.json)}`
  );
  const sessionId = created.json.data.session.id;
  console.log('✓ Session CRUD create', created.json.data.session.sessionNumber);

  const detail = await req('GET', `/treatment-sessions/${sessionId}`, { token });
  assert(detail.status === 200 && detail.json.data?.session?.progress, 'Detail missing');
  const planStatusBefore = detail.json.data.session.treatmentPlan?.status;
  const invPayBefore = detail.json.data.session.invoice?.paymentStatus;

  await req('POST', `/treatment-sessions/${sessionId}/check-in`, { token });
  const started = await req('POST', `/treatment-sessions/${sessionId}/start`, {
    token,
    body: {
      deviceUsage: {
        device: 'Laser-A',
        machine: 'Unit-1',
        laserHead: 'H1',
        settings: { joules: 10 },
      },
    },
  });
  assert(
    started.status === 200 && started.json.data?.session?.status === 'IN_PROGRESS',
    `Start failed ${JSON.stringify(started.json)}`
  );
  console.log('✓ Session start');

  const completed = await req('POST', `/treatment-sessions/${sessionId}/complete`, {
    token,
    body: {
      outcome: 'Smoke complete',
      followUp: {
        nextSessionDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        notes: 'Review',
      },
    },
  });
  assert(
    completed.status === 200 && completed.json.data?.session?.status === 'COMPLETED',
    `Complete failed ${JSON.stringify(completed.json)}`
  );
  console.log('✓ Session completion');

  const after = await req('GET', `/treatment-sessions/${sessionId}`, { token });
  assert(
    after.json.data?.session?.treatmentPlan?.status === planStatusBefore,
    'Session must not mutate plan status'
  );
  assert(
    after.json.data?.session?.invoice?.paymentStatus === invPayBefore,
    'Session must not mutate invoice'
  );
  assert(after.json.data?.session?.logs?.length >= 1, 'Session log missing');
  console.log('✓ Plan/billing unchanged; logs', after.json.data.session.logs.length);

  // Reschedule another scheduled session
  const scheduled = sessions.find((s) => s.status === 'SCHEDULED' && s.id !== sessionId);
  if (scheduled) {
    const rs = await req('POST', `/treatment-sessions/${scheduled.id}/reschedule`, {
      token,
      body: { scheduledDate: new Date(Date.now() + 3 * 864e5).toISOString() },
    });
    assert(rs.status === 200, `Reschedule failed ${JSON.stringify(rs.json)}`);
    console.log('✓ Reschedule');
  }

  const print = await req('GET', `/treatment-sessions/${sessionId}/print`, { token });
  assert(print.status === 200 && print.json.data?.session, 'Print failed');
  console.log('✓ Print summary');

  console.log('\nModule 12 smoke passed.');
}

main().catch((err) => {
  console.error('Module 12 smoke FAILED:', err.message);
  process.exit(1);
});
