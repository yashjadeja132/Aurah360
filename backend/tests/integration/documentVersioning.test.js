import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Patient from '../../src/models/Patient.model.js';
import PatientDocument from '../../src/models/PatientDocument.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import PatientDocumentService from '../../src/services/PatientDocumentService.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';

/**
 * DOC-002 / DOC-003 — `version` and `supersedesDocumentId` sat on the model with ZERO write sites,
 * and `rename()` overwrote a title with no audit row. Both are the same defect in different
 * clothes: the schema advertised a capability the service never performed, so staff re-uploading a
 * corrected report got two unrelated documents with no way to tell which was current, and a title
 * could be changed after the fact leaving no trace.
 *
 * The immutability of the superseded original is the point of the feature, so it is asserted
 * directly rather than inferred.
 */
describe('DOC-002/003 document versioning and auditable rename', () => {
  const service = new PatientDocumentService();
  const actorId = new mongoose.Types.ObjectId().toString();
  let patient;
  let otherPatient;
  let seq = 0;

  /**
   * DOC-002 — upload now verifies the file's LEADING BYTES against its declared type, so a
   * fixture has to begin like a real PDF (`%PDF-`). The trailing counter keeps each version's
   * sha256 checksum distinct, which is what the versioning assertions rely on.
   */
  function fileFixture(name = 'report.pdf') {
    return {
      buffer: Buffer.from(`%PDF-1.4\n% pdf-bytes-${(seq += 1)}\n%%EOF\n`),
      originalname: name,
      mimetype: 'application/pdf',
    };
  }

  async function uploadDoc(patientId, extra = {}) {
    return service.upload(
      patientId,
      {
        file: fileFixture(),
        category: 'LAB_REPORT',
        title: 'Blood panel',
        clinicalDate: new Date('2026-01-15'),
        ...extra,
      },
      actorId
    );
  }

  beforeAll(async () => {
    await connectTestDb('docver');
    patient = await Patient.create({
      mrn: `MRN-DV-${Date.now()}`,
      firstName: 'Doc',
      lastName: 'Version',
      gender: 'FEMALE',
      mobile: '9000000501',
      primaryBranchId: new mongoose.Types.ObjectId(),
    });
    otherPatient = await Patient.create({
      mrn: `MRN-DV-O-${Date.now()}`,
      firstName: 'Other',
      lastName: 'Patient',
      gender: 'MALE',
      mobile: '9000000502',
      primaryBranchId: new mongoose.Types.ObjectId(),
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('starts a fresh document at version 1 with no predecessor', async () => {
    const doc = await uploadDoc(patient._id);
    expect(doc.version ?? 1).toBe(1);
    expect(doc.supersedesDocumentId ?? null).toBeNull();
  });

  it('bumps the version and links back when a document supersedes another', async () => {
    const first = await uploadDoc(patient._id);
    const second = await uploadDoc(patient._id, { supersedesDocumentId: first.id });

    const stored = await PatientDocument.findById(second.id).exec();
    expect(stored.version).toBe(2);
    expect(stored.supersedesDocumentId.toString()).toBe(first.id);

    // A third replacement continues the chain rather than resetting it.
    const third = await uploadDoc(patient._id, { supersedesDocumentId: second.id });
    expect((await PatientDocument.findById(third.id).exec()).version).toBe(3);
  });

  it('leaves the superseded original completely untouched', async () => {
    // DOC-003: a correction must never mutate or remove the record it replaces.
    const first = await uploadDoc(patient._id);
    const before = await PatientDocument.findById(first.id).lean();

    await uploadDoc(patient._id, { supersedesDocumentId: first.id });

    const after = await PatientDocument.findById(first.id).lean();
    expect(after.deletedAt).toBeNull();
    expect(after.storageKey).toBe(before.storageKey);
    expect(after.checksum).toBe(before.checksum);
    expect(after.title).toBe(before.title);
    expect(after.version).toBe(before.version);
  });

  it('refuses to chain a document onto another patient record', async () => {
    // Without this check a caller could graft one patient's history onto another's.
    const foreign = await uploadDoc(otherPatient._id);
    await expect(uploadDoc(patient._id, { supersedesDocumentId: foreign.id })).rejects.toThrow(
      /not found for this patient/i
    );
  });

  it('records the previous title when a document is renamed', async () => {
    const doc = await uploadDoc(patient._id, { title: 'Original title' });

    await service.rename(patient._id, doc.id, 'Corrected title', actorId, 'typo in report name');

    const entry = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PATIENT_DOCUMENT_RENAMED,
      'metadata.documentId': doc.id,
    }).exec();

    expect(entry).toBeTruthy();
    // An audit row that says only "title changed" cannot answer the question anyone actually asks.
    expect(entry.metadata.previousTitle).toBe('Original title');
    expect(entry.metadata.newTitle).toBe('Corrected title');
    expect(entry.metadata.reason).toBe('typo in report name');
    expect((await PatientDocument.findById(doc.id).exec()).title).toBe('Corrected title');
  });
});
