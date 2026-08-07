import { describe, it, expect } from 'vitest';
import PiiRedactor from '../../src/services/ai/PiiRedactor.js';

describe('PiiRedactor (AI-002 de-identification gate)', () => {
  const redactor = new PiiRedactor();

  it('drops blocked identity fields entirely', () => {
    const { manifest, fieldsRemoved } = redactor.buildManifest({
      firstName: 'Aarav',
      lastName: 'Patel',
      mobile: '9876543210',
      mrn: 'MRN0001',
      complaint: 'itchy scalp',
    });
    expect(manifest.firstName).toBeUndefined();
    expect(manifest.lastName).toBeUndefined();
    expect(manifest.mobile).toBeUndefined();
    expect(manifest.mrn).toBeUndefined();
    expect(manifest.complaint).toBe('itchy scalp');
    expect(fieldsRemoved).toEqual(expect.arrayContaining(['firstName', 'lastName', 'mobile', 'mrn']));
  });

  it('scrubs PII-shaped text embedded in free-text fields', () => {
    const { manifest } = redactor.buildManifest({
      note: 'Call 9876543210 or email aarav@example.com about MRN-000123',
    });
    expect(manifest.note).not.toContain('9876543210');
    expect(manifest.note).not.toContain('aarav@example.com');
    expect(manifest.note).toContain('[redacted-phone]');
    expect(manifest.note).toContain('[redacted-email]');
  });

  it('redacts nested objects recursively', () => {
    const { manifest, fieldsRemoved } = redactor.buildManifest({
      patient: { email: 'x@y.com', history: { allergies: 'penicillin' } },
    });
    expect(manifest.patient.email).toBeUndefined();
    expect(manifest.patient.history.allergies).toBe('penicillin');
    expect(fieldsRemoved).toContain('patient.email');
  });

  it('passes through arrays of safe values', () => {
    const { manifest } = redactor.buildManifest({ symptoms: ['itching', 'redness'] });
    expect(manifest.symptoms).toEqual(['itching', 'redness']);
  });

  it('never leaks identity fields even when nested under an unusual key name', () => {
    const { manifest } = redactor.buildManifest({ guardianPhone: '9998887777', note: 'ok' });
    expect(manifest.guardianPhone).toBeUndefined();
  });
});
