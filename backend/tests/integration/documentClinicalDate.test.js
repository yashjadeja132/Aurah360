import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Patient from '../../src/models/Patient.model.js';
import PatientDocumentService from '../../src/services/PatientDocumentService.js';
import { uploadDocumentSchema } from '../../src/validators/patient.validator.js';
import { DOCUMENT_SOURCE_LIST } from '../../src/enums/patient.js';

/**
 * DOC-001 (P0) — a document's clinical date is the date printed ON the report, never the upload
 * date, because that date is what orders the clinical timeline a doctor reads to reconstruct a
 * history.
 *
 * The original defect lived in the UI: `clinicalDate` and `source` were held in React state and
 * appended to the FormData, but no input for either was ever rendered. Every scanned external
 * report was therefore filed under TODAY with source PATIENT — silently, with nobody asked. The
 * server side of that contract is what these tests pin down:
 *
 *  - a supplied past date survives to the stored row byte-for-byte (nothing "helpfully" replaces
 *    it with now), which is the assertion the fabricated-date bug fails;
 *  - the date is mandatory and has NO server-side default, so a UI that omits it gets a hard
 *    error instead of a plausible wrong answer;
 *  - a future date — the signature of a mistyped year or a mis-set clock — is refused; and
 *  - `source` is enum-checked at the boundary, since the model enforces the enum and an off-list
 *    value would otherwise surface as a 500 rather than a named 400.
 */
describe('DOC-001 document clinical date and source', () => {
  const service = new PatientDocumentService();
  const actorId = new mongoose.Types.ObjectId().toString();
  let patient;
  let seq = 0;

  /** Real PDF magic bytes — upload content-sniffs the buffer before storing it. */
  function pdf(name = 'external-report.pdf') {
    return {
      buffer: Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.from(`-body-${(seq += 1)}`)]),
      originalname: name,
      mimetype: 'application/pdf',
    };
  }

  beforeAll(async () => {
    await connectTestDb('docdate');
    patient = await Patient.create({
      mrn: `MRN-DD-${Date.now()}`,
      firstName: 'Doc',
      lastName: 'Date',
      gender: 'FEMALE',
      mobile: '9000000701',
      primaryBranchId: new mongoose.Types.ObjectId(),
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('stores the clinical date it was given, not the upload date', async () => {
    // Three months back: exactly the scanned-external-report case the bug mis-filed under today.
    const reportDate = new Date('2026-05-02T00:00:00.000Z');

    const doc = await service.upload(
      patient._id,
      { file: pdf(), category: 'LAB_REPORT', title: 'CBC', clinicalDate: reportDate, source: 'LABORATORY' },
      actorId
    );

    expect(new Date(doc.clinicalDate).toISOString()).toBe(reportDate.toISOString());
    // The guard that actually catches the regression: an upload-date default would land on today.
    expect(new Date(doc.clinicalDate).getTime()).not.toBeCloseTo(Date.now(), -6);
    expect(doc.source).toBe('LABORATORY');
  });

  it('refuses an upload with no clinical date rather than defaulting to today', async () => {
    // A silently-defaulted date is worse than a rejected upload: the record looks correct and the
    // timeline is wrong forever.
    await expect(
      service.upload(
        patient._id,
        { file: pdf(), category: 'MEDICAL_REPORT', title: 'No date' },
        actorId
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('has no server-side default for clinicalDate in the upload validator', async () => {
    // The validator is the other half of "mandatory": if it grew a default, the service's own
    // check would never fire and the fabricated date would come back through the front door.
    const parsed = uploadDocumentSchema.safeParse({ category: 'LAB_REPORT' });
    expect(parsed.success).toBe(false);
  });

  it('accepts a past clinical date through the validator and preserves the calendar day', async () => {
    const parsed = uploadDocumentSchema.safeParse({
      category: 'LAB_REPORT',
      clinicalDate: '2025-11-20',
      source: 'HOSPITAL',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data.clinicalDate.toISOString().slice(0, 10)).toBe('2025-11-20');
    expect(parsed.data.source).toBe('HOSPITAL');
  });

  it('rejects a clinical date in the future', async () => {
    // A report cannot be issued tomorrow. A far-future date is a mistyped year or a bad device
    // clock, and accepting it parks the document permanently at the top of the timeline.
    const parsed = uploadDocumentSchema.safeParse({
      category: 'LAB_REPORT',
      clinicalDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
    });

    expect(parsed.success).toBe(false);
  });

  it('tolerates a same-day date entered from a timezone ahead of UTC', async () => {
    // A browser sends a bare YYYY-MM-DD, which coerces to MIDNIGHT UTC. Staff in IST picking
    // "today" before 05:30 local therefore submit an instant that is future in UTC terms. The
    // future check must not turn that ordinary morning upload into an outage.
    const parsed = uploadDocumentSchema.safeParse({
      category: 'LAB_REPORT',
      clinicalDate: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects a source outside DOCUMENT_SOURCE and accepts every value inside it', async () => {
    // The UI previously offered CLINIC_GENERATED / INSURANCE_PROVIDER, which are not in the enum
    // the model enforces — so the picker's own options were unsaveable.
    expect(
      uploadDocumentSchema.safeParse({
        category: 'LAB_REPORT',
        clinicalDate: '2026-01-05',
        source: 'CLINIC_GENERATED',
      }).success
    ).toBe(false);

    for (const source of DOCUMENT_SOURCE_LIST) {
      expect(
        uploadDocumentSchema.safeParse({ category: 'LAB_REPORT', clinicalDate: '2026-01-05', source })
          .success
      ).toBe(true);
    }
  });

  it('falls back to source PATIENT only when the caller genuinely sent none', async () => {
    const doc = await service.upload(
      patient._id,
      { file: pdf(), category: 'OTHER', title: 'Handed in at desk', clinicalDate: new Date('2026-02-14') },
      actorId
    );

    expect(doc.source).toBe('PATIENT');
    expect(new Date(doc.clinicalDate).toISOString().slice(0, 10)).toBe('2026-02-14');
  });
});
