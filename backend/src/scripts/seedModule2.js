import Branch from '../models/Branch.model.js';
import Master from '../models/Master.model.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import { ENTITY_STATUS } from '../constants/index.js';
import { DEFAULT_WEEKLY } from '../models/Branch.model.js';
import logger from '../libs/logger.js';

const DEPARTMENTS = [
  'Dermatology',
  'Hair',
  'Laser',
  'Cosmetology',
  'Reception',
  'Administration',
  'Pharmacy',
];

const DESIGNATIONS = [
  'Doctor',
  'Receptionist',
  'Nurse',
  'Technician',
  'Cashier',
  'CRM Executive',
  'Manager',
];

const SERVICE_CATEGORIES = [
  { name: 'Hair', code: 'HAIR' },
  { name: 'Skin', code: 'SKIN' },
  { name: 'Laser', code: 'LASER' },
  { name: 'Consultation', code: 'CONSULT' },
  { name: 'Packages', code: 'PKG' },
  { name: 'Other', code: 'OTHER' },
];

const APPOINTMENT_STATUSES = [
  { name: 'Scheduled', code: 'SCHEDULED', color: '#64748b', sortOrder: 1 },
  { name: 'Confirmed', code: 'CONFIRMED', color: '#2563eb', sortOrder: 2 },
  { name: 'Checked In', code: 'CHECKED_IN', color: '#0891b2', sortOrder: 3 },
  { name: 'In Consultation', code: 'IN_CONSULTATION', color: '#7c3aed', sortOrder: 4 },
  { name: 'Treatment', code: 'TREATMENT', color: '#db2777', sortOrder: 5 },
  { name: 'Completed', code: 'COMPLETED', color: '#16a34a', sortOrder: 6 },
  { name: 'Cancelled', code: 'CANCELLED', color: '#dc2626', sortOrder: 7 },
  { name: 'No Show', code: 'NO_SHOW', color: '#ea580c', sortOrder: 8 },
];

const PAYMENT_METHODS = [
  { name: 'Cash', code: 'CASH' },
  { name: 'Card', code: 'CARD' },
  { name: 'UPI', code: 'UPI' },
  { name: 'Bank Transfer', code: 'BANK' },
  { name: 'Cheque', code: 'CHEQUE' },
];

const LEAD_SOURCES = [
  { name: 'Walk In', code: 'WALK_IN' },
  { name: 'Google', code: 'GOOGLE' },
  { name: 'Instagram', code: 'INSTAGRAM' },
  { name: 'Facebook', code: 'FACEBOOK' },
  { name: 'Website', code: 'WEBSITE' },
  { name: 'Referral', code: 'REFERRAL' },
  { name: 'WhatsApp', code: 'WHATSAPP' },
  { name: 'Call', code: 'CALL' },
  { name: 'Other', code: 'OTHER' },
];

async function upsertMaster({ type, name, code = null, extra = {} }) {
  const existing = await Master.findOne({
    type,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    deletedAt: null,
  });

  if (existing) {
    Object.assign(existing, {
      code: code || existing.code,
      isSystem: true,
      isActive: true,
      status: ENTITY_STATUS.ACTIVE,
      ...extra,
    });
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
    ...extra,
  });
}

export async function seedModule2() {
  let branch = await Branch.findOne({ branchCode: 'SURAT-01', deletedAt: null });
  if (!branch) {
    branch = await Branch.create({
      name: 'Aurah 360 Surat Main',
      branchCode: 'SURAT-01',
      displayName: 'Surat Main',
      email: 'surat.main@aurah360.local',
      phone: '9876500001',
      address: 'Surat, Gujarat',
      city: 'Surat',
      state: 'Gujarat',
      country: 'India',
      postalCode: '395007',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      workingHours: '10:00 - 19:00',
      settings: {
        workingDays: [1, 2, 3, 4, 5, 6],
        weeklySchedule: DEFAULT_WEEKLY,
        lunchBreak: { enabled: true, startTime: '13:00', endTime: '14:00' },
        timeSlotDurationMinutes: 15,
        appointmentBufferMinutes: 5,
        holidayCalendar: [],
        emergencyContact: {
          name: 'Branch Desk',
          phone: '9876500001',
          email: 'surat.main@aurah360.local',
        },
      },
      status: ENTITY_STATUS.ACTIVE,
      isActive: true,
      notes: 'Default pilot branch',
    });
    logger.info('Default branch seeded', { branchCode: branch.branchCode });
  } else {
    logger.info('Default branch already exists', { branchCode: branch.branchCode });
  }

  for (const [index, name] of DEPARTMENTS.entries()) {
    await upsertMaster({
      type: MASTER_TYPES.DEPARTMENT,
      name,
      code: `DEPT-${index + 1}`,
      extra: { sortOrder: index + 1 },
    });
  }

  for (const [index, name] of DESIGNATIONS.entries()) {
    await upsertMaster({
      type: MASTER_TYPES.DESIGNATION,
      name,
      code: `DES-${index + 1}`,
      extra: { sortOrder: index + 1 },
    });
  }

  const categoryMap = {};
  for (const [index, item] of SERVICE_CATEGORIES.entries()) {
    const doc = await upsertMaster({
      type: MASTER_TYPES.SERVICE_CATEGORY,
      name: item.name,
      code: item.code,
      extra: { sortOrder: index + 1 },
    });
    categoryMap[item.code] = doc._id;
  }

  for (const item of APPOINTMENT_STATUSES) {
    await upsertMaster({
      type: MASTER_TYPES.APPOINTMENT_STATUS,
      name: item.name,
      code: item.code,
      extra: { color: item.color, sortOrder: item.sortOrder },
    });
  }

  for (const [index, item] of PAYMENT_METHODS.entries()) {
    await upsertMaster({
      type: MASTER_TYPES.PAYMENT_METHOD,
      name: item.name,
      code: item.code,
      extra: { sortOrder: index + 1 },
    });
  }

  for (const [index, item] of LEAD_SOURCES.entries()) {
    await upsertMaster({
      type: MASTER_TYPES.LEAD_SOURCE,
      name: item.name,
      code: item.code,
      extra: { sortOrder: index + 1 },
    });
  }

  // Sample services (optional starter catalogue)
  const sampleServices = [
    {
      name: 'Skin Consultation',
      code: 'SVC-CONSULT',
      categoryCode: 'CONSULT',
      durationMinutes: 20,
      price: 500,
    },
    {
      name: 'Laser Hair Reduction - Face',
      code: 'SVC-LHR-FACE',
      categoryCode: 'LASER',
      durationMinutes: 45,
      price: 3500,
    },
  ];

  for (const [index, svc] of sampleServices.entries()) {
    await upsertMaster({
      type: MASTER_TYPES.SERVICE,
      name: svc.name,
      code: svc.code,
      extra: {
        categoryId: categoryMap[svc.categoryCode],
        durationMinutes: svc.durationMinutes,
        price: svc.price,
        sortOrder: index + 1,
        description: svc.name,
      },
    });
  }

  logger.info('Module 2 masters seeded');
  return { branch };
}

export default seedModule2;
