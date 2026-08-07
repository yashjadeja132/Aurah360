/**
 * Module 8 seed — 10 completed consultations with SOAP, vitals, diagnosis, photos metadata.
 */
import Appointment from '../models/Appointment.model.js';
import Consultation from '../models/Consultation.model.js';
import ConsultationSoap from '../models/ConsultationSoap.model.js';
import ConsultationVitals from '../models/ConsultationVitals.model.js';
import ConsultationDiagnosis from '../models/ConsultationDiagnosis.model.js';
import ConsultationExamination from '../models/ConsultationExamination.model.js';
import ClinicalPhoto from '../models/ClinicalPhoto.model.js';
import ConsultationTemplate from '../models/ConsultationTemplate.model.js';
import Doctor from '../models/Doctor.model.js';
import { generateConsultationNumber } from '../helpers/consultationNumber.helper.js';
import { CONSULTATION_STATUS, PHOTO_TYPE, TEMPLATE_TYPE } from '../enums/consultation.js';
import logger from '../libs/logger.js';

const SOAP_EXAMPLES = [
  {
    subjective: 'Patient reports facial pigmentation for 6 months, worse with sun exposure.',
    objective: 'Diffuse melasma on cheeks and forehead. Fitzpatrick IV.',
    assessment: 'Melasma — epidermal predominant.',
    plan: 'Sun protection, topical regimen, review in 4 weeks.',
  },
  {
    subjective: 'Hair thinning over vertex for 1 year. Family history positive.',
    objective: 'Norwood III vertex pattern. Positive pull test mild.',
    assessment: 'Androgenetic alopecia.',
    plan: 'Medical therapy counseling; PRP discussion.',
  },
  {
    subjective: 'Acne flares around menstrual cycle. Prior isotretinoin 2 years ago.',
    objective: 'Inflammatory papules on cheeks and jawline. Mild scarring.',
    assessment: 'Hormonal acne with early scarring.',
    plan: 'Topicals + chemical peel series.',
  },
];

const DIAGNOSES = [
  'Melasma',
  'Androgenetic alopecia',
  'Acne vulgaris',
  'Post-inflammatory hyperpigmentation',
  'Seborrheic dermatitis',
];

export async function seedModule8() {
  const existing = await Consultation.countDocuments({ deletedAt: null });
  if (existing >= 10) {
    logger.info('Module 8 consultations already seeded', { existing });
    return;
  }

  const appointments = await Appointment.find({ deletedAt: null })
    .sort({ appointmentDate: -1 })
    .limit(20)
    .exec();
  const doctors = await Doctor.find({ deletedAt: null, isActive: true }).limit(3).exec();

  if (!appointments.length || !doctors.length) {
    throw new Error('Module 8 seed requires appointments and doctors');
  }

  let created = 0;
  const need = 10 - existing;

  for (let i = 0; i < appointments.length && created < need; i += 1) {
    const appt = appointments[i];
    const already = await Consultation.findOne({
      appointmentId: appt._id,
      deletedAt: null,
    });
    if (already) continue;

    const startedAt = new Date(appt.appointmentDate || Date.now());
    startedAt.setHours(10 + (i % 6), 15 * (i % 4), 0, 0);
    const endedAt = new Date(startedAt.getTime() + 20 * 60000);
    const soapEx = SOAP_EXAMPLES[i % SOAP_EXAMPLES.length];

    const consultation = await Consultation.create({
      consultationNumber: await generateConsultationNumber(),
      appointmentId: appt._id,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      branchId: appt.branchId,
      status: CONSULTATION_STATUS.SIGNED,
      startedAt,
      endedAt,
      duration: 20,
      signedByDoctor: doctors[0].userId || null,
      signedAt: endedAt,
      locked: i % 5 === 0,
      lockedAt: i % 5 === 0 ? endedAt : null,
      chiefComplaint: soapEx.subjective.slice(0, 120),
      followUp: {
        value: 4,
        unit: 'WEEKS',
        reason: 'Review response',
        instructions: 'Continue prescribed regimen; SPF daily.',
      },
    });

    if (consultation.locked) {
      consultation.status = CONSULTATION_STATUS.LOCKED;
      await consultation.save();
    }

    await ConsultationSoap.create({
      consultationId: consultation._id,
      ...soapEx,
      currentVersion: 2,
      isDraft: false,
      lastAutosavedAt: endedAt,
      versions: [
        {
          version: 1,
          ...soapEx,
          subjective: 'Initial draft notes',
          savedAt: startedAt,
        },
        {
          version: 2,
          ...soapEx,
          savedAt: endedAt,
        },
      ],
    });

    await ConsultationVitals.create({
      consultationId: consultation._id,
      heightCm: 160 + (i % 20),
      weightKg: 55 + (i % 25),
      bmi: 22 + (i % 5),
      temperatureC: 36.6,
      pulseBpm: 72 + i,
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 76,
      respirationRpm: 16,
      oxygenSaturation: 98,
      painScale: i % 3,
      recordedAt: startedAt,
    });

    await ConsultationDiagnosis.create({
      consultationId: consultation._id,
      primaryDiagnosis: DIAGNOSES[i % DIAGNOSES.length],
      secondaryDiagnoses: i % 2 === 0 ? ['Sun damage'] : [],
      clinicalNotes: 'Seed diagnosis notes',
      icd10Codes: ['L81.1'],
    });

    await ConsultationExamination.create({
      consultationId: consultation._id,
      generalExamination: 'Alert, oriented, no acute distress.',
      skinExamination: soapEx.objective,
      hairExamination: i % 2 === 0 ? 'Thinning at vertex.' : 'Normal density.',
      scalpExamination: 'No active lesions.',
      laserAssessment: 'Skin type suitable for Nd:YAG / Q-switched discussion.',
      clinicalFindings: soapEx.assessment,
    });

    await ClinicalPhoto.create({
      consultationId: consultation._id,
      patientId: appt.patientId,
      photoType: PHOTO_TYPE.BEFORE,
      title: `Seed before photo ${created + 1}`,
      bodyRegion: 'Face',
      storageKey: `seed/consultations/${consultation._id}/before-placeholder.jpg`,
      originalName: 'before-placeholder.jpg',
      mimeType: 'image/jpeg',
      size: 0,
      consentVerified: true,
      consentVerifiedAt: startedAt,
      metadata: { seeded: true },
    });

    created += 1;
  }

  // Templates for first doctor
  const doctor = doctors[0];
  const tplCount = await ConsultationTemplate.countDocuments({
    doctorId: doctor._id,
    deletedAt: null,
  });
  if (tplCount === 0) {
    await ConsultationTemplate.create([
      {
        doctorId: doctor._id,
        name: 'Melasma SOAP',
        templateType: TEMPLATE_TYPE.SOAP,
        content: SOAP_EXAMPLES[0],
        isShared: true,
      },
      {
        doctorId: doctor._id,
        name: 'Hair consult exam',
        templateType: TEMPLATE_TYPE.EXAMINATION,
        content: {
          hairExamination: 'Patterned thinning noted.',
          scalpExamination: 'No inflammation.',
        },
        isShared: false,
      },
      {
        doctorId: doctor._id,
        name: 'Acne diagnosis',
        templateType: TEMPLATE_TYPE.DIAGNOSIS,
        content: {
          primaryDiagnosis: 'Acne vulgaris',
          icd10Codes: ['L70.0'],
        },
        isShared: true,
      },
    ]);
  }

  logger.info('Module 8 consultations seeded', { created, total: existing + created });
}

export default seedModule8;
