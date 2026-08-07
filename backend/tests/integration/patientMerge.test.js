import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import Patient from '../../src/models/Patient.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import PatientMergeService from '../../src/services/PatientMergeService.js';

/**
 * PAT-001 — real merge workflow against a live database: records reassign, the duplicate
 * is soft-deleted (never destroyed), and the merge is reconcilable afterward.
 */
describe('Patient merge (real DB)', () => {
  const mergeService = new PatientMergeService();
  let primary;
  let duplicate;
  const branchId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await connectTestDb('patient-merge');
    primary = await Patient.create({
      mrn: `MRN-PRIMARY-${Date.now()}`,
      firstName: 'Primary',
      lastName: 'Record',
      gender: 'FEMALE',
      mobile: '9000000010',
      primaryBranchId: branchId,
    });
    duplicate = await Patient.create({
      mrn: `MRN-DUPE-${Date.now()}`,
      firstName: 'Duplicate',
      lastName: 'Record',
      gender: 'FEMALE',
      mobile: '9000000010',
      email: 'dupe-only@example.com',
      primaryBranchId: branchId,
    });

    await Appointment.create({
      appointmentNumber: `APT-DUPE-${Date.now()}`,
      patientId: duplicate._id,
      doctorId: new mongoose.Types.ObjectId(),
      branchId,
      serviceId: new mongoose.Types.ObjectId(),
      appointmentDate: new Date('2026-09-05'),
      startTime: '11:00',
      endTime: '11:15',
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('preview reports the appointment that would move', async () => {
    const preview = await mergeService.previewMerge(primary._id, duplicate._id);
    expect(preview.recordsToMove.Appointment).toBe(1);
  });

  it('merge reassigns the appointment and folds in the missing email', async () => {
    const result = await mergeService.merge(primary._id, duplicate._id, new mongoose.Types.ObjectId());
    expect(result.mergedRecordCounts.Appointment).toBe(1);

    const movedAppointment = await Appointment.findOne({ patientId: primary._id });
    expect(movedAppointment).not.toBeNull();

    const refreshedPrimary = await Patient.findById(primary._id);
    expect(refreshedPrimary.email).toBe('dupe-only@example.com');
  });

  it('the duplicate record is soft-deleted, never destroyed', async () => {
    const refreshedDuplicate = await Patient.findById(duplicate._id);
    expect(refreshedDuplicate).not.toBeNull(); // still exists
    expect(refreshedDuplicate.deletedAt).not.toBeNull();
    expect(refreshedDuplicate.isActive).toBe(false);
  });

  it('refuses to merge a patient into itself', async () => {
    await expect(mergeService.merge(primary._id, primary._id, new mongoose.Types.ObjectId())).rejects.toThrow();
  });
});
