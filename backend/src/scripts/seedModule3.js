/**
 * Module 3 seed — 2 doctors, weekly schedules, sample leave.
 */
import User from '../models/User.model.js';
import Role from '../models/Role.model.js';
import Branch from '../models/Branch.model.js';
import Master from '../models/Master.model.js';
import Doctor from '../models/Doctor.model.js';
import DoctorSchedule from '../models/DoctorSchedule.model.js';
import DoctorLeave from '../models/DoctorLeave.model.js';
import { ROLES } from '../constants/roles.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import { USER_STATUS } from '../enums/userStatus.js';
import { ENTITY_STATUS } from '../constants/index.js';
import { LEAVE_STATUS, LEAVE_TYPE } from '../enums/leave.js';
import { hashPassword } from '../helpers/crypto.helper.js';
import logger from '../libs/logger.js';

async function ensureDoctorUser({ email, firstName, lastName, employeeId, password }) {
  const roleDoc = await Role.findOne({ code: ROLES.DOCTOR });
  if (!roleDoc) throw new Error('DOCTOR role missing — run Module 1 seed first');

  let user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    user.role = ROLES.DOCTOR;
    user.roleId = roleDoc._id;
    user.isActive = true;
    user.status = USER_STATUS.ACTIVE;
    user.deletedAt = null;
    await user.save();
    return user;
  }

  return User.create({
    firstName,
    lastName,
    email,
    passwordHash: await hashPassword(password),
    role: ROLES.DOCTOR,
    roleId: roleDoc._id,
    employeeId,
    status: USER_STATUS.ACTIVE,
    isActive: true,
    mustChangePassword: true,
  });
}

async function upsertDoctor(profile) {
  let doctor = await Doctor.findOne({ userId: profile.userId, deletedAt: null });
  if (doctor) {
    Object.assign(doctor, profile);
    doctor.isActive = true;
    doctor.status = ENTITY_STATUS.ACTIVE;
    await doctor.save();
    return doctor;
  }

  const byCode = await Doctor.findOne({ doctorCode: profile.doctorCode });
  if (byCode && byCode.deletedAt) {
    Object.assign(byCode, profile, {
      deletedAt: null,
      isActive: true,
      status: ENTITY_STATUS.ACTIVE,
    });
    await byCode.save();
    return byCode;
  }

  return Doctor.create(profile);
}

function defaultWeekDays() {
  return [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: '10:00',
    endTime: '19:00',
    lunchStart: '13:00',
    lunchEnd: '14:00',
    slotDuration: 15,
    bufferTime: 5,
    maximumAppointments: 40,
    isWorking: true,
  })).concat([
    {
      dayOfWeek: 0,
      startTime: '10:00',
      endTime: '14:00',
      lunchStart: null,
      lunchEnd: null,
      slotDuration: 15,
      bufferTime: 5,
      maximumAppointments: 16,
      isWorking: false,
    },
  ]);
}

export async function seedModule3() {
  const branch = await Branch.findOne({ branchCode: 'SURAT-01', deletedAt: null });
  if (!branch) {
    throw new Error('Default branch SURAT-01 missing — run Module 2 seed first');
  }

  const departments = await Master.find({
    type: MASTER_TYPES.DEPARTMENT,
    deletedAt: null,
    isActive: true,
  }).limit(3);

  const services = await Master.find({
    type: MASTER_TYPES.SERVICE,
    deletedAt: null,
    isActive: true,
  }).limit(2);

  const password = process.env.SEED_DOCTOR_PASSWORD || 'ChangeMe@12345';

  const user1 = await ensureDoctorUser({
    email: 'dr.shah@aurah360.local',
    firstName: 'Ananya',
    lastName: 'Shah',
    employeeId: 'EMP-DOC-001',
    password,
  });

  const user2 = await ensureDoctorUser({
    email: 'dr.mehta@aurah360.local',
    firstName: 'Rahul',
    lastName: 'Mehta',
    employeeId: 'EMP-DOC-002',
    password,
  });

  const doctor1 = await upsertDoctor({
    userId: user1._id,
    doctorCode: 'DOC-001',
    licenseNumber: 'GJ-DERM-1001',
    registrationNumber: 'MCI-REG-1001',
    qualification: 'MD Dermatology',
    specialization: 'Skin & Laser',
    experienceYears: 8,
    bio: 'Dermatologist focusing on acne, pigmentation and laser procedures.',
    consultationDuration: 20,
    consultationFee: 800,
    followUpFee: 400,
    departments: departments.map((d) => d._id),
    services: services.map((s) => s._id),
    branches: [branch._id],
    languages: ['en', 'gu', 'hi'],
    gender: 'FEMALE',
    colorCode: '#0d9488',
    isAvailableOnline: true,
    status: ENTITY_STATUS.ACTIVE,
    isActive: true,
  });

  const doctor2 = await upsertDoctor({
    userId: user2._id,
    doctorCode: 'DOC-002',
    licenseNumber: 'GJ-DERM-1002',
    registrationNumber: 'MCI-REG-1002',
    qualification: 'MD Dermatology',
    specialization: 'Hair & Cosmetology',
    experienceYears: 6,
    bio: 'Hair restoration and aesthetic dermatology.',
    consultationDuration: 15,
    consultationFee: 700,
    followUpFee: 350,
    departments: departments.map((d) => d._id),
    services: services.map((s) => s._id),
    branches: [branch._id],
    languages: ['en', 'hi'],
    gender: 'MALE',
    colorCode: '#2563eb',
    isAvailableOnline: false,
    status: ENTITY_STATUS.ACTIVE,
    isActive: true,
  });

  for (const doctor of [doctor1, doctor2]) {
    for (const day of defaultWeekDays()) {
      await DoctorSchedule.findOneAndUpdate(
        {
          doctorId: doctor._id,
          branchId: branch._id,
          dayOfWeek: day.dayOfWeek,
        },
        { $set: { ...day, doctorId: doctor._id, branchId: branch._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  const leaveStart = new Date();
  leaveStart.setDate(leaveStart.getDate() + 14);
  leaveStart.setHours(0, 0, 0, 0);
  const leaveEnd = new Date(leaveStart);
  leaveEnd.setDate(leaveEnd.getDate() + 1);

  const existingLeave = await DoctorLeave.findOne({
    doctorId: doctor1._id,
    deletedAt: null,
    reason: 'Seed sample leave',
  });

  if (!existingLeave) {
    await DoctorLeave.create({
      doctorId: doctor1._id,
      branchId: branch._id,
      leaveType: LEAVE_TYPE.FULL_DAY,
      startDate: leaveStart,
      endDate: leaveEnd,
      reason: 'Seed sample leave',
      status: LEAVE_STATUS.APPROVED,
    });
  }

  logger.info('Module 3 doctors seeded', {
    doctors: [doctor1.doctorCode, doctor2.doctorCode],
  });
}

export default seedModule3;
