/**
 * Ad-hoc smoke test for the malware-scan gate (Task #23) and signed file-access tokens
 * (Task #24) on FileAccessController. Not part of Vitest — isolated test DB, self-cleaning.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import request from 'supertest';
import config from '../config/index.js';
import App from '../app.js';
import PatientDocument from '../models/PatientDocument.model.js';
import Patient from '../models/Patient.model.js';
import TokenService from '../services/TokenService.js';
import { ROLES } from '../constants/roles.js';
import { SCAN_STATE } from '../enums/patient.js';
import StorageFactory from '../storage/StorageFactory.js';
import { generateFileToken } from '../storage/LocalStorage.js';
import { smokeDbUri } from './smokeDbUri.js';

const tokenService = new TokenService();
const storage = StorageFactory.create();

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_file_access'));
  await mongoose.connection.dropDatabase();

  const app = new App().getExpressApp();

  const patient = await Patient.create({
    mrn: `MRN-FILE-${Date.now()}`,
    firstName: 'File',
    lastName: 'Smoke',
    gender: 'FEMALE',
    mobile: '9800000001',
    primaryBranchId: new mongoose.Types.ObjectId(),
  });

  const staffAccessToken = tokenService.signAccessToken({
    sub: new mongoose.Types.ObjectId().toString(),
    role: ROLES.OWNER,
    permissions: [],
  });

  async function makeDoc(scanState, label) {
    const saved = await storage.save(Buffer.from(`hello-${label}`), {
      folder: `patients/${patient._id}`,
      filename: `${label}.txt`,
      mimeType: 'text/plain',
    });
    return PatientDocument.create({
      patientId: patient._id,
      category: 'LAB_REPORT',
      title: `${label} doc`,
      clinicalDate: new Date(),
      originalName: `${label}.txt`,
      storageKey: saved.key,
      mimeType: 'text/plain',
      scanState,
    });
  }

  // 1. CLEAN document serves normally with a session.
  const cleanDoc = await makeDoc(SCAN_STATE.CLEAN, 'clean');
  const cleanRes = await request(app)
    .get(`${config.app.apiPrefix}/files/documents/${cleanDoc._id}`)
    .set('Authorization', `Bearer ${staffAccessToken}`);
  assert(cleanRes.status === 200, `CLEAN doc should serve 200, got ${cleanRes.status} (${JSON.stringify(cleanRes.body)})`);
  console.log('CLEAN doc served 200: PASS');

  // 2. QUARANTINED document is blocked with 403.
  const quarantinedDoc = await makeDoc(SCAN_STATE.QUARANTINED, 'quarantined');
  const quarantinedRes = await request(app)
    .get(`${config.app.apiPrefix}/files/documents/${quarantinedDoc._id}`)
    .set('Authorization', `Bearer ${staffAccessToken}`);
  assert(quarantinedRes.status === 403, `QUARANTINED doc should be 403, got ${quarantinedRes.status}`);
  console.log('QUARANTINED doc blocked 403: PASS');

  // 3. PENDING document returns a 202 "still scanning" response, not a hard error.
  const pendingDoc = await makeDoc(SCAN_STATE.PENDING, 'pending');
  const pendingRes = await request(app)
    .get(`${config.app.apiPrefix}/files/documents/${pendingDoc._id}`)
    .set('Authorization', `Bearer ${staffAccessToken}`);
  assert(pendingRes.status === 202, `PENDING doc should be 202, got ${pendingRes.status}`);
  console.log('PENDING doc returned 202 "still scanning": PASS');

  // 4. REJECTED document is also blocked with 403 (and audited, same code path as QUARANTINED).
  const rejectedDoc = await makeDoc(SCAN_STATE.REJECTED, 'rejected');
  const rejectedRes = await request(app)
    .get(`${config.app.apiPrefix}/files/documents/${rejectedDoc._id}`)
    .set('Authorization', `Bearer ${staffAccessToken}`);
  assert(rejectedRes.status === 403, `REJECTED doc should be 403, got ${rejectedRes.status}`);
  console.log('REJECTED doc blocked 403: PASS');

  // 5. Issue a signed token for the CLEAN doc via the /token endpoint, then use it with NO
  //    session at all (Task #24) — should still serve 200.
  const tokenIssueRes = await request(app)
    .get(`${config.app.apiPrefix}/files/documents/${cleanDoc._id}/token`)
    .set('Authorization', `Bearer ${staffAccessToken}`);
  assert(tokenIssueRes.status === 200, `Token issuance should be 200, got ${tokenIssueRes.status}`);
  assert(typeof tokenIssueRes.body.token === 'string', 'Token issuance should return a token string');
  console.log('Signed token issued via /token endpoint: PASS');

  const noSessionRes = await request(app).get(
    `${config.app.apiPrefix}/files/documents/${cleanDoc._id}?token=${tokenIssueRes.body.token}`
  );
  assert(noSessionRes.status === 200, `Signed token without a session should serve 200, got ${noSessionRes.status}`);
  console.log('CLEAN doc served 200 via signed token with no session: PASS');

  // 6. Expired token is rejected with 403.
  const { token: expiredToken } = generateFileToken(cleanDoc._id.toString(), -1);
  const expiredRes = await request(app).get(
    `${config.app.apiPrefix}/files/documents/${cleanDoc._id}?token=${expiredToken}`
  );
  assert(expiredRes.status === 403, `Expired token should be 403, got ${expiredRes.status}`);
  console.log('Expired token rejected 403: PASS');

  // 7. Tampered token (signature flipped) is rejected with 403.
  const { token: validToken } = generateFileToken(cleanDoc._id.toString());
  const tamperedToken = validToken.slice(0, -1) + (validToken.endsWith('a') ? 'b' : 'a');
  const tamperedRes = await request(app).get(
    `${config.app.apiPrefix}/files/documents/${cleanDoc._id}?token=${tamperedToken}`
  );
  assert(tamperedRes.status === 403, `Tampered token should be 403, got ${tamperedRes.status}`);
  console.log('Tampered token rejected 403: PASS');

  // 8. A token minted for one file cannot be reused to fetch a different file.
  const otherDoc = await makeDoc(SCAN_STATE.CLEAN, 'other');
  const wrongFileRes = await request(app).get(
    `${config.app.apiPrefix}/files/documents/${otherDoc._id}?token=${validToken}`
  );
  assert(wrongFileRes.status === 403, `Token for a different file should be 403, got ${wrongFileRes.status}`);
  console.log('Token bound to a different file rejected 403: PASS');

  // 9. No session and no token at all is still a hard 401 (existing check not weakened).
  const noAuthRes = await request(app).get(`${config.app.apiPrefix}/files/documents/${cleanDoc._id}`);
  assert(noAuthRes.status === 401, `No session/token should be 401, got ${noAuthRes.status}`);
  console.log('No session and no token rejected 401: PASS');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
