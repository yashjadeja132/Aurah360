/**
 * Module 14 seed — 200 leads across sources/stages, follow-ups, tasks.
 */
import Lead from '../models/Lead.model.js';
import LeadFollowUp from '../models/LeadFollowUp.model.js';
import LeadTask from '../models/LeadTask.model.js';
import Branch from '../models/Branch.model.js';
import User from '../models/User.model.js';
import Master from '../models/Master.model.js';
import { generateLeadNumber } from '../helpers/leadNumber.helper.js';
import {
  FOLLOW_UP_TYPE,
  LEAD_PRIORITY,
  LEAD_STATUS,
  LEAD_TASK_ASSIGNEE_ROLE,
  LEAD_TASK_STATUS,
} from '../enums/crm.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import { GENDER } from '../enums/gender.js';
import { ROLES } from '../constants/roles.js';
import logger from '../libs/logger.js';

const FIRST = ['Aarav', 'Diya', 'Ishaan', 'Kiara', 'Rohan', 'Ananya', 'Vihaan', 'Myra', 'Kabir', 'Sara'];
const LAST = ['Patel', 'Shah', 'Mehta', 'Desai', 'Joshi', 'Khan', 'Singh', 'Nair', 'Iyer', 'Gupta'];
const SERVICES = ['Laser Hair Removal', 'Hydrafacial', 'Botox', 'Fillers', 'Acne Peel', 'PRP Hair', 'Skin Whitening'];
const CAMPAIGNS = ['Summer Glow', 'Diwali Offer', 'Insta Ads Q3', 'Referral Drive', 'Walk-in Weekend'];
const STATUSES = Object.values(LEAD_STATUS);
const PRIORITIES = Object.values(LEAD_PRIORITY);

export async function seedModule14() {
  const existing = await Lead.countDocuments({ deletedAt: null });
  if (existing >= 200) {
    logger.info('Module 14 leads already seeded', { existing });
    return;
  }

  const branch = await Branch.findOne({ deletedAt: null }).exec();
  if (!branch) {
    logger.warn('Module 14 skipped — no branch');
    return;
  }

  const sources = await Master.find({
    type: MASTER_TYPES.LEAD_SOURCE,
    deletedAt: null,
    isActive: true,
  }).exec();

  const assignees = await User.find({
    role: { $in: [ROLES.CRM_EXECUTIVE, ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.BRANCH_MANAGER] },
    deletedAt: null,
    isActive: true,
  })
    .limit(10)
    .exec();

  const toCreate = 200 - existing;
  for (let i = 0; i < toCreate; i += 1) {
    const src = sources[i % Math.max(sources.length, 1)] || null;
    const status = STATUSES[i % STATUSES.length];
    const assignee = assignees.length ? assignees[i % assignees.length] : null;
    const followDays = (i % 10) - 3;
    const nextFollowUp =
      [LEAD_STATUS.WON, LEAD_STATUS.LOST, LEAD_STATUS.JUNK].includes(status)
        ? null
        : new Date(Date.now() + followDays * 86400000);

    const lead = await Lead.create({
      leadNumber: await generateLeadNumber(),
      firstName: FIRST[i % FIRST.length],
      lastName: LAST[i % LAST.length],
      phone: `98${String(10000000 + i).slice(0, 8)}`,
      email: `lead${i + 1}@example.local`,
      gender: i % 2 === 0 ? GENDER.FEMALE : GENDER.MALE,
      age: 22 + (i % 35),
      city: i % 3 === 0 ? 'Surat' : i % 3 === 1 ? 'Ahmedabad' : 'Mumbai',
      sourceId: src?._id || null,
      source: src?.name || 'Walk In',
      campaign: CAMPAIGNS[i % CAMPAIGNS.length],
      branchId: branch._id,
      assignedTo: status === LEAD_STATUS.NEW ? null : assignee?._id || null,
      interestedServices: [SERVICES[i % SERVICES.length], SERVICES[(i + 2) % SERVICES.length]],
      budget: 5000 + (i % 20) * 2500,
      priority: PRIORITIES[i % PRIORITIES.length],
      status,
      remarks: 'Seed CRM lead',
      nextFollowUp,
      lostReason: status === LEAD_STATUS.LOST ? ['Budget', 'Location', 'Competitor', 'Not interested'][i % 4] : null,
      convertedAt: status === LEAD_STATUS.WON ? new Date() : null,
    });

    if (i % 2 === 0) {
      await LeadFollowUp.create({
        leadId: lead._id,
        date: new Date(Date.now() - (i % 5) * 86400000),
        type: Object.values(FOLLOW_UP_TYPE)[i % 5],
        notes: 'Seed follow-up call',
        outcome: i % 3 === 0 ? 'Interested' : 'Callback requested',
        nextFollowUp,
        assignedTo: assignee?._id || null,
      });
    }

    if (i % 3 === 0) {
      await LeadTask.create({
        leadId: lead._id,
        title: `Follow up ${lead.leadNumber}`,
        description: 'Seed CRM task',
        assigneeRole: Object.values(LEAD_TASK_ASSIGNEE_ROLE)[i % 4],
        assignedTo: assignee?._id || null,
        dueDate: new Date(Date.now() + (i % 7) * 86400000),
        reminderAt: new Date(Date.now() + (i % 7) * 86400000 - 3600000),
        status: i % 5 === 0 ? LEAD_TASK_STATUS.DONE : LEAD_TASK_STATUS.PENDING,
        completedAt: i % 5 === 0 ? new Date() : null,
      });
    }
  }

  logger.info('Module 14 CRM seeded', {
    leads: await Lead.countDocuments({ deletedAt: null }),
    followUps: await LeadFollowUp.countDocuments(),
    tasks: await LeadTask.countDocuments({ deletedAt: null }),
  });
}

export default seedModule14;
