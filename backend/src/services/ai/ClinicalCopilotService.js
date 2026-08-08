import ApiError from '../../libs/ApiError.js';
import AiRun from '../../models/AiRun.model.js';
import Consultation from '../../models/Consultation.model.js';
import ConsultationSoap from '../../models/ConsultationSoap.model.js';
import ConsultationExamination from '../../models/ConsultationExamination.model.js';
import ConsultationVitals from '../../models/ConsultationVitals.model.js';
import ClinicalPhoto from '../../models/ClinicalPhoto.model.js';
import Prescription from '../../models/Prescription.model.js';
import Patient from '../../models/Patient.model.js';
import AiGatewayService from './AiGatewayService.js';
import { AI_USE_CASE } from '../../enums/ai.js';

/** Coarse age band — an exact age is not needed for clinical reasoning and is more identifying. */
function ageBand(age) {
  if (age == null) return 'not recorded';
  if (age < 2) return 'infant (under 2)';
  if (age < 13) return `child (${age} years)`;
  if (age < 20) return `adolescent (${age} years)`;
  return `adult (${age} years)`;
}

function clean(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

/**
 * Clinical copilot (Module 9, §9.2). Assembles the doctor-visible consultation facts into a
 * de-identified context, runs it through the AI gateway (which performs the mandatory PII
 * redaction and writes the audit row), and returns the structured suggestion set.
 *
 * The consultation is NEVER blocked: an unavailable, disabled, refused, or malformed AI
 * response returns { degraded: true, reason } instead of an error.
 */
class ClinicalCopilotService {
  constructor() {
    this.gateway = new AiGatewayService();
  }

  /**
   * SEC-030 — branch scope for a single consultation. `scope` is `{ branchId }` from
   * `resolveRecordScope`; a null branchId means the caller is unrestricted (OWNER/ADMIN).
   * Out of scope answers 404, never 403 — a 403 would confirm the consultation/run exists.
   */
  #assertConsultationInScope(consultation, scope = null, message = 'Consultation not found') {
    if (!scope?.branchId) return;
    if (String(consultation?.branchId || '') !== String(scope.branchId)) {
      throw ApiError.notFound(message);
    }
  }

  /** Loads the consultation bundle and shapes the raw (pre-redaction) copilot context. */
  async buildContext(consultationId, { includePhotos = false, scope = null } = {}) {
    const consultation = await Consultation.findOne({ _id: consultationId, deletedAt: null }).exec();
    if (!consultation) throw ApiError.notFound('Consultation not found');
    this.#assertConsultationInScope(consultation, scope);

    const [patient, soap, examination, vitals, prescriptions] = await Promise.all([
      Patient.findOne({ _id: consultation.patientId, deletedAt: null }).exec(),
      ConsultationSoap.findOne({ consultationId, deletedAt: null }).exec(),
      ConsultationExamination.findOne({ consultationId, deletedAt: null }).exec(),
      ConsultationVitals.findOne({ consultationId, deletedAt: null }).exec(),
      Prescription.find({ consultationId, deletedAt: null }).limit(20).exec(),
    ]);
    if (!patient) throw ApiError.notFound('Patient not found for this consultation');

    const medical = patient.medical || {};

    const bodyAreas = [];
    if (clean(examination?.skinExamination)) bodyAreas.push('skin');
    if (clean(examination?.hairExamination)) bodyAreas.push('hair');
    if (clean(examination?.scalpExamination)) bodyAreas.push('scalp');
    if (clean(examination?.laserAssessment)) bodyAreas.push('laser-treatment area');

    const priorPrescribed = prescriptions
      .flatMap((p) => (p.items || []).map((i) => clean(i.genericName) || clean(i.medicineName)))
      .filter(Boolean);

    const context = {
      ageBand: ageBand(patient.computeAge()),
      sex: patient.gender || 'not recorded',
      chiefComplaint: clean(consultation.chiefComplaint) || 'not recorded',
      // Duration is captured inside the doctor's subjective narrative; passed as-is for the
      // model to read rather than guessed at here.
      durationAndHistoryOfPresentComplaint: clean(soap?.subjective) || 'not recorded',
      bodyAreas: bodyAreas.length ? bodyAreas : ['not recorded'],
      examinationFindings: {
        general: clean(examination?.generalExamination),
        skin: clean(examination?.skinExamination),
        hair: clean(examination?.hairExamination),
        scalp: clean(examination?.scalpExamination),
        laserAssessment: clean(examination?.laserAssessment),
        clinicalFindings: clean(examination?.clinicalFindings),
      },
      objectiveNote: clean(soap?.objective) || 'not recorded',
      allergies: clean(medical.allergies) || 'none recorded',
      currentMedications: clean(medical.currentMedications) || 'none recorded',
      relevantHistory: {
        chronicDiseases: clean(medical.chronicDiseases) || 'none recorded',
        pastMedicalHistory: clean(medical.pastMedicalHistory) || 'none recorded',
        pastSurgicalHistory: clean(medical.pastSurgicalHistory) || 'none recorded',
        smoking: clean(medical.smoking) || 'not recorded',
        alcohol: clean(medical.alcohol) || 'not recorded',
      },
      pregnancyStatus: clean(medical.pregnancyStatus) || 'not recorded',
      vitals: vitals
        ? {
            temperatureC: vitals.temperatureC,
            pulseBpm: vitals.pulseBpm,
            bloodPressure:
              vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic
                ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
                : null,
            oxygenSaturation: vitals.oxygenSaturation,
            painScale: vitals.painScale,
          }
        : 'not recorded',
      medicationsAlreadyPrescribedThisConsultation: priorPrescribed.length ? priorPrescribed : 'none',
    };

    if (includePhotos) {
      // Image bytes are never sent to the provider — only the fact that photos exist and which
      // body regions they cover, so the model knows what the doctor can already see.
      const photos = await ClinicalPhoto.find({ consultationId, deletedAt: null }).limit(50).exec();
      context.clinicalPhotos = {
        count: photos.length,
        bodyRegions: [...new Set(photos.map((p) => clean(p.bodyRegion)).filter(Boolean))],
        note: 'Photo images are not shared with the AI. Reason only from the text above.',
      };
    }

    return { consultation, context };
  }

  /** First call — full structured suggestion set. */
  async generate({ consultationId, patientId = null, includePhotos = false }, actorId, req = null, scope = null) {
    const { consultation, context } = await this.buildContext(consultationId, { includePhotos, scope });

    const result = await this.gateway.run(
      {
        useCase: AI_USE_CASE.CLINICAL_COPILOT,
        context,
        patientId: patientId || consultation.patientId,
        consultationId: consultation._id,
      },
      actorId,
      req
    );

    return this.#shape(result);
  }

  /** Second call — re-runs the original context plus the doctor-recorded patient answers. */
  async refine(runId, { answers }, actorId, req = null, scope = null) {
    const parent = await AiRun.findById(runId).exec();
    if (!parent) throw ApiError.notFound('AI run not found');

    /**
     * SEC-030 — this was a cross-patient read path: any AI run id could be refined by any caller
     * holding `ai.use`, and the refinement echoes the parent run's full clinical `inputManifest`
     * back to the caller. The run itself has no branch column, so scope is taken from the
     * consultation it belongs to; a run with no consultation (ad-hoc gateway use) falls back to
     * "only the requester may refine it". 404 either way — never confirm the run exists.
     */
    if (scope?.branchId) {
      if (parent.consultationId) {
        const consultation = await Consultation.findOne({
          _id: parent.consultationId,
          deletedAt: null,
        }).exec();
        this.#assertConsultationInScope(consultation, scope, 'AI run not found');
      } else if (String(parent.requestedBy || '') !== String(actorId || '')) {
        throw ApiError.notFound('AI run not found');
      }
    }

    if (parent.useCase !== AI_USE_CASE.CLINICAL_COPILOT) {
      throw ApiError.badRequest('This AI run is not a clinical copilot run');
    }

    const previousAnswers = Array.isArray(parent.inputManifest?.recordedAnswers)
      ? parent.inputManifest.recordedAnswers
      : [];

    const context = {
      ...(parent.inputManifest || {}),
      recordedAnswers: [
        ...previousAnswers,
        ...answers.map((a) => ({ question: a.question, answer: a.answer })),
      ],
      refinementNote:
        'The patient has now answered the questions below. Narrow the differential using these answers.',
    };

    const result = await this.gateway.run(
      {
        useCase: AI_USE_CASE.CLINICAL_COPILOT,
        context,
        patientId: parent.patientId,
        consultationId: parent.consultationId,
        parentRunId: parent._id,
      },
      actorId,
      req
    );

    return { ...this.#shape(result), parentRunId: parent._id.toString() };
  }

  #shape(result) {
    return {
      runId: result.runId,
      output: result.output,
      model: result.model,
      degraded: Boolean(result.degraded),
      reason: result.reason || null,
    };
  }
}

export default ClinicalCopilotService;
