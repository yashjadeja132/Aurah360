/**
 * Module 5 seed — branch holidays, blocked slots, special schedule override, sample leave.
 */
import Branch from '../models/Branch.model.js';
import Doctor from '../models/Doctor.model.js';
import DoctorLeave from '../models/DoctorLeave.model.js';
import BranchHoliday from '../models/BranchHoliday.model.js';
import DoctorBlockedSlot from '../models/DoctorBlockedSlot.model.js';
import DoctorSpecialSchedule from '../models/DoctorSpecialSchedule.model.js';
import { LEAVE_STATUS, LEAVE_TYPE } from '../enums/leave.js';
import { BLOCKED_SLOT_REASON } from '../enums/scheduling.js';
import logger from '../libs/logger.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function atTime(date, hours, minutes = 0) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export async function seedModule5() {
  const branches = await Branch.find({ deletedAt: null, isActive: true }).exec();
  if (!branches.length) throw new Error('No branches — run Module 2 seed first');

  const doctors = await Doctor.find({ deletedAt: null, isActive: true }).limit(2).exec();
  if (!doctors.length) throw new Error('No doctors — run Module 3 seed first');

  const year = new Date().getFullYear();
  const holidayDefs = [
    { holidayName: 'Republic Day', date: new Date(year, 0, 26), isRecurring: true },
    { holidayName: 'Independence Day', date: new Date(year, 7, 15), isRecurring: true },
    { holidayName: 'Gandhi Jayanti', date: new Date(year, 9, 2), isRecurring: true },
    { holidayName: 'Clinic Maintenance Day', date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return startOfDay(d);
    })(), isRecurring: false, description: 'Seeded maintenance holiday' },
  ];

  for (const branch of branches) {
    for (const def of holidayDefs) {
      const existing = await BranchHoliday.findOne({
        branchId: branch._id,
        holidayName: def.holidayName,
        deletedAt: null,
      });
      if (existing) continue;
      await BranchHoliday.create({
        branchId: branch._id,
        holidayName: def.holidayName,
        date: startOfDay(def.date),
        isRecurring: def.isRecurring,
        description: def.description || null,
      });
    }
  }

  const doctor = doctors[0];
  const branchId = doctor.branches?.[0] || branches[0]._id;

  // Temporary override tomorrow: shorter day 12:00–18:00
  const tomorrow = startOfDay(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  // skip Sunday for override usefulness
  if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);

  await DoctorSpecialSchedule.findOneAndUpdate(
    { doctorId: doctor._id, branchId, date: tomorrow, deletedAt: null },
    {
      $set: {
        doctorId: doctor._id,
        branchId,
        date: tomorrow,
        isWorking: true,
        startTime: '12:00',
        endTime: '18:00',
        lunchStart: '13:00',
        lunchEnd: '14:00',
        slotDuration: 15,
        bufferTime: 5,
        notes: 'Seeded temporary override',
        deletedAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Blocked slot: training tomorrow afternoon
  const blockStart = atTime(tomorrow, 16, 0);
  const blockEnd = atTime(tomorrow, 17, 0);
  const existingBlock = await DoctorBlockedSlot.findOne({
    doctorId: doctor._id,
    title: 'Team Training',
    deletedAt: null,
    startAt: blockStart,
  });
  if (!existingBlock) {
    await DoctorBlockedSlot.create({
      doctorId: doctor._id,
      branchId,
      title: 'Team Training',
      reason: BLOCKED_SLOT_REASON.TRAINING,
      startAt: blockStart,
      endAt: blockEnd,
      description: 'Seeded blocked slot',
    });
  }

  // Extra leave sample for second doctor (or same)
  const leaveDoctor = doctors[1] || doctor;
  const leaveStart = startOfDay(new Date());
  leaveStart.setDate(leaveStart.getDate() + 21);
  const leaveEnd = new Date(leaveStart);
  leaveEnd.setDate(leaveEnd.getDate() + 1);

  const existingLeave = await DoctorLeave.findOne({
    doctorId: leaveDoctor._id,
    reason: 'Seeded Module 5 leave',
    deletedAt: null,
  });
  if (!existingLeave) {
    await DoctorLeave.create({
      doctorId: leaveDoctor._id,
      branchId: leaveDoctor.branches?.[0] || branchId,
      leaveType: LEAVE_TYPE.FULL_DAY,
      startDate: leaveStart,
      endDate: leaveEnd,
      status: LEAVE_STATUS.APPROVED,
      reason: 'Seeded Module 5 leave',
    });
  }

  logger.info('Module 5 scheduling seed complete', {
    holidaysPerBranch: holidayDefs.length,
    branches: branches.length,
    specialDate: tomorrow.toISOString().slice(0, 10),
  });
}

export default seedModule5;
