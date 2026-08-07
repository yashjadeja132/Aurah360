/**
 * Module 4 seed — patient tags + 20 sample patients.
 */
import Branch from '../models/Branch.model.js';
import Master from '../models/Master.model.js';
import Doctor from '../models/Doctor.model.js';
import Patient from '../models/Patient.model.js';
import PatientTimeline from '../models/PatientTimeline.model.js';
import Sequence from '../models/Sequence.model.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import { ENTITY_STATUS } from '../constants/index.js';
import { GENDER } from '../enums/gender.js';
import { TIMELINE_EVENT } from '../enums/patient.js';
import { generateMrn, generatePatientCode } from '../helpers/mrn.helper.js';
import logger from '../libs/logger.js';

const PATIENT_TAGS = [
  { name: 'VIP', code: 'VIP' },
  { name: 'Hair', code: 'HAIR' },
  { name: 'Skin', code: 'SKIN' },
  { name: 'Laser', code: 'LASER' },
  { name: 'High Value', code: 'HIGH_VALUE' },
  { name: 'Referral', code: 'REFERRAL' },
  { name: 'Follow-up', code: 'FOLLOW_UP' },
];

const FIRST_NAMES = [
  ['Aarav', GENDER.MALE],
  ['Priya', GENDER.FEMALE],
  ['Rohan', GENDER.MALE],
  ['Ananya', GENDER.FEMALE],
  ['Vikram', GENDER.MALE],
  ['Meera', GENDER.FEMALE],
  ['Kabir', GENDER.MALE],
  ['Isha', GENDER.FEMALE],
  ['Arjun', GENDER.MALE],
  ['Neha', GENDER.FEMALE],
  ['Dev', GENDER.MALE],
  ['Sneha', GENDER.FEMALE],
  ['Harsh', GENDER.MALE],
  ['Pooja', GENDER.FEMALE],
  ['Yash', GENDER.MALE],
  ['Kavya', GENDER.FEMALE],
  ['Ayaan', GENDER.MALE],
  ['Riya', GENDER.FEMALE],
  ['Om', GENDER.OTHER],
  ['Sam', GENDER.PREFER_NOT_TO_SAY],
];

const LAST_NAMES = [
  'Patel', 'Shah', 'Mehta', 'Desai', 'Joshi',
  'Trivedi', 'Gandhi', 'Parekh', 'Modi', 'Kapadia',
  'Dave', 'Rana', 'Chauhan', 'Solanki', 'Thakkar',
  'Bhatt', 'Nair', 'Iyer', 'Khan', 'Singh',
];

const TAG_SETS = [
  ['VIP', 'Skin'],
  ['Hair'],
  ['Laser', 'Follow-up'],
  ['Skin', 'High Value'],
  ['Referral'],
  ['Hair', 'Laser'],
  ['VIP', 'High Value'],
  ['Follow-up'],
  ['Skin'],
  ['Hair', 'Referral'],
  ['Laser'],
  ['VIP'],
  ['Skin', 'Follow-up'],
  ['High Value'],
  ['Hair', 'VIP'],
  ['Laser', 'Skin'],
  ['Referral', 'Follow-up'],
  ['Skin', 'Hair'],
  ['VIP', 'Laser'],
  ['Follow-up', 'High Value'],
];

async function upsertMaster({ type, name, code }) {
  const existing = await Master.findOne({
    type,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    deletedAt: null,
  });
  if (existing) {
    existing.code = code || existing.code;
    existing.isSystem = true;
    existing.isActive = true;
    existing.status = ENTITY_STATUS.ACTIVE;
    await existing.save();
    return existing;
  }
  return Master.create({
    type,
    name,
    code,
    isSystem: true,
    isActive: true,
    status: ENTITY_STATUS.ACTIVE,
  });
}

async function ensureSecondBranch() {
  let branch = await Branch.findOne({ branchCode: 'SURAT-02', deletedAt: null });
  if (branch) return branch;
  return Branch.create({
    name: 'Aurah 360 Vesu',
    branchCode: 'SURAT-02',
    displayName: 'Vesu Clinic',
    email: 'vesu@aurah360.local',
    phone: '9876500002',
    address: 'Vesu, Surat',
    city: 'Surat',
    state: 'Gujarat',
    country: 'India',
    postalCode: '395007',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    workingHours: '10:00 - 19:00',
    status: ENTITY_STATUS.ACTIVE,
    isActive: true,
    notes: 'Second seed branch for Module 4',
  });
}

function birthDateYearsAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(years % 12);
  d.setDate(5 + (years % 20));
  return d;
}

export async function seedModule4() {
  for (const tag of PATIENT_TAGS) {
    await upsertMaster({
      type: MASTER_TYPES.PATIENT_TAG,
      name: tag.name,
      code: tag.code,
    });
  }

  const branchMain = await Branch.findOne({ branchCode: 'SURAT-01', deletedAt: null });
  if (!branchMain) throw new Error('SURAT-01 missing — run Module 2 seed first');
  const branchVesu = await ensureSecondBranch();

  const leadSources = await Master.find({
    type: MASTER_TYPES.LEAD_SOURCE,
    deletedAt: null,
    isActive: true,
  }).exec();
  if (!leadSources.length) throw new Error('Lead sources missing — run Module 2 seed first');

  const doctors = await Doctor.find({ deletedAt: null, isActive: true }).limit(2).exec();

  // Sync MRN sequence with existing patients so seed stays unique
  const existingCount = await Patient.countDocuments({});
  const seq = await Sequence.findOne({ key: 'patient_mrn' });
  if (!seq || seq.value < existingCount) {
    await Sequence.findOneAndUpdate(
      { key: 'patient_mrn' },
      { $set: { value: existingCount } },
      { upsert: true }
    );
  }

  let created = 0;
  for (let i = 0; i < 20; i += 1) {
    const [firstName, gender] = FIRST_NAMES[i];
    const lastName = LAST_NAMES[i];
    const mobile = `98${String(76000000 + i).padStart(8, '0')}`;
    const existing = await Patient.findOne({ mobile, deletedAt: null });
    if (existing) continue;

    const mrn = await generateMrn();
    const branch = i % 2 === 0 ? branchMain : branchVesu;
    const lead = leadSources[i % leadSources.length];
    const doctor = doctors.length ? doctors[i % doctors.length] : null;
    const ageYears = 18 + ((i * 3) % 50);

    const patient = await Patient.create({
      mrn,
      patientCode: await generatePatientCode(mrn),
      firstName,
      lastName,
      gender,
      dateOfBirth: birthDateYearsAgo(ageYears),
      mobile,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.local`,
      primaryBranchId: branch._id,
      primaryDoctorId: doctor?._id || null,
      leadSourceId: lead._id,
      isVip: TAG_SETS[i].includes('VIP'),
      tags: TAG_SETS[i],
      address: {
        addressLine1: `${100 + i} Ring Road`,
        city: 'Surat',
        state: 'Gujarat',
        country: 'India',
        postalCode: '395007',
      },
      medical: {
        heightCm: 150 + (i % 40),
        weightKg: 50 + (i % 35),
        allergies: i % 5 === 0 ? 'Penicillin' : null,
        smoking: i % 4 === 0 ? 'Never' : 'Occasional',
      },
      consent: {
        privacyPolicy: true,
        treatmentConsent: true,
        photographyConsent: i % 3 === 0,
        marketingConsent: i % 2 === 0,
        acceptedAt: new Date(),
      },
      status: ENTITY_STATUS.ACTIVE,
      isActive: true,
      registrationDate: new Date(Date.now() - i * 86400000 * 3),
    });

    await PatientTimeline.create({
      patientId: patient._id,
      eventType: TIMELINE_EVENT.PATIENT_REGISTERED,
      title: 'Patient registered',
      description: `Seeded ${mrn}`,
      occurredAt: patient.registrationDate,
    });

    created += 1;
  }

  logger.info('Module 4 patients seeded', { created, tags: PATIENT_TAGS.length });
}

export default seedModule4;
