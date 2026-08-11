import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Patient from '../../src/models/Patient.model.js';
import Consultation from '../../src/models/Consultation.model.js';
import ConsultationSoap from '../../src/models/ConsultationSoap.model.js';
import Prescription from '../../src/models/Prescription.model.js';
import AiRun from '../../src/models/AiRun.model.js';
import ClinicalCopilotService from '../../src/services/ai/ClinicalCopilotService.js';

/**
 * AI-008 — automated proof that the clinical copilot has no cross-patient memory or retrieval.
 *
 * There is no vector store / embedding / RAG layer in this codebase (grepped clean), so the
 * isolation guarantee is structural: `ClinicalCopilotService.buildContext()` must assemble its
 * context from exactly one consultation/patient, and `.refine()` must only ever replay that same
 * run's own prior `inputManifest` — never another patient's. This test proves both directions:
 * building context for patient A never surfaces any fact recorded for patient B, and refining
 * patient A's run never picks up patient B's recorded answers even though both exist in the same
 * database at the same time.
 */
describe('AI copilot — cross-patient isolation (AI-008)', () => {
  const branchId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();
  const appointmentId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId().toString();
  const service = new ClinicalCopilotService();

  let patientA;
  let patientB;
  let consultationA;
  let consultationB;

  beforeAll(async () => {
    await connectTestDb('aiCopilotPatientIsolation');

    patientA = await Patient.create({
      mrn: `MRN-AI-A-${Date.now()}`,
      firstName: 'Alpha',
      lastName: 'Patient',
      mobile: '9000000001',
      branchId,
      primaryBranchId: branchId,
      gender: 'FEMALE',
      medical: { allergies: 'Penicillin — anaphylaxis on record for Alpha' },
    });
    patientB = await Patient.create({
      mrn: `MRN-AI-B-${Date.now()}`,
      firstName: 'Beta',
      lastName: 'Patient',
      mobile: '9000000002',
      branchId,
      primaryBranchId: branchId,
      gender: 'MALE',
      medical: { allergies: 'Sulfa drugs — rash, unique to Beta' },
    });

    consultationA = await Consultation.create({
      consultationNumber: `CONS-AI-A-${Date.now()}`,
      appointmentId,
      patientId: patientA._id,
      doctorId,
      branchId,
      chiefComplaint: 'Alpha-only chief complaint: facial pigmentation',
    });
    consultationB = await Consultation.create({
      consultationNumber: `CONS-AI-B-${Date.now()}`,
      appointmentId: new mongoose.Types.ObjectId(),
      patientId: patientB._id,
      doctorId,
      branchId,
      chiefComplaint: 'Beta-only chief complaint: hair loss',
    });

    await ConsultationSoap.create({
      consultationId: consultationA._id,
      subjective: 'Alpha-only subjective note about pigmentation duration',
      objective: 'Alpha-only objective note',
    });
    await ConsultationSoap.create({
      consultationId: consultationB._id,
      subjective: 'Beta-only subjective note about hair loss duration',
      objective: 'Beta-only objective note',
    });

    await Prescription.create({
      consultationId: consultationA._id,
      patientId: patientA._id,
      doctorId,
      branchId,
      items: [{ medicineName: 'Alpha-Only-Med', genericName: 'AlphaGeneric' }],
    });
    await Prescription.create({
      consultationId: consultationB._id,
      patientId: patientB._id,
      doctorId,
      branchId,
      items: [{ medicineName: 'Beta-Only-Med', genericName: 'BetaGeneric' }],
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('builds context for patient A containing no fact recorded for patient B', async () => {
    const { context } = await service.buildContext(consultationA._id);
    const serialized = JSON.stringify(context);

    expect(serialized).toContain('Alpha-only');
    expect(serialized).toContain('AlphaGeneric');

    expect(serialized).not.toContain('Beta-only');
    expect(serialized).not.toContain('BetaGeneric');
    expect(serialized).not.toContain('Sulfa drugs');
  });

  it('builds context for patient B containing no fact recorded for patient A', async () => {
    const { context } = await service.buildContext(consultationB._id);
    const serialized = JSON.stringify(context);

    expect(serialized).toContain('Beta-only');
    expect(serialized).toContain('BetaGeneric');

    expect(serialized).not.toContain('Alpha-only');
    expect(serialized).not.toContain('AlphaGeneric');
    expect(serialized).not.toContain('Penicillin');
  });

  it('never lets patient B answers leak into a refine() of patient A\'s run', async () => {
    // Simulate a prior AiRun for patient A that already has recorded answers of its own.
    const runA = await AiRun.create({
      useCase: 'CLINICAL_COPILOT',
      patientId: patientA._id,
      consultationId: consultationA._id,
      requestedBy: actorId,
      provider: 'MOCK',
      model: 'mock-test-model',
      status: 'SUCCESS',
      inputManifest: {
        chiefComplaint: 'Alpha-only chief complaint: facial pigmentation',
        recordedAnswers: [{ question: 'Duration?', answer: 'Alpha-only answer: 3 months' }],
      },
      fieldsRemoved: [],
      output: { summary: 'stub' },
      outputHash: 'stub-hash-a',
    });

    // A separate run exists for patient B in the same collection at the same time.
    await AiRun.create({
      useCase: 'CLINICAL_COPILOT',
      patientId: patientB._id,
      consultationId: consultationB._id,
      requestedBy: actorId,
      provider: 'MOCK',
      model: 'mock-test-model',
      status: 'SUCCESS',
      inputManifest: {
        chiefComplaint: 'Beta-only chief complaint: hair loss',
        recordedAnswers: [{ question: 'Duration?', answer: 'Beta-only answer: 6 weeks' }],
      },
      fieldsRemoved: [],
      output: { summary: 'stub' },
      outputHash: 'stub-hash-b',
    });

    const result = await service.refine(runA._id, {
      answers: [{ question: 'Any new symptom?', answer: 'Alpha-only answer: none' }],
    }, actorId);

    // The gateway is fail-open (mock provider when no key configured); either way the run it
    // records must only ever have replayed runA's own manifest, never runB's.
    const persisted = await AiRun.findById(result.runId).exec();
    const serialized = JSON.stringify(persisted.inputManifest);

    expect(String(persisted.patientId)).toBe(String(patientA._id));
    expect(serialized).toContain('Alpha-only');
    expect(serialized).not.toContain('Beta-only');
  });
});
