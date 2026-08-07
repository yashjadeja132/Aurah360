import BaseRepository from './BaseRepository.js';
import Lead from '../models/Lead.model.js';
import LeadFollowUp from '../models/LeadFollowUp.model.js';
import LeadTask from '../models/LeadTask.model.js';
import { LEAD_STATUS } from '../enums/crm.js';

export class LeadRepository extends BaseRepository {
  constructor() {
    super(Lead);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('branchId', 'name displayName branchCode')
      .populate('assignedTo', 'firstName lastName role email')
      .populate('sourceId', 'name code type')
      .populate('convertedPatientId', 'mrn firstName lastName mobile')
      .exec();
  }

  async list({
    branchId,
    status,
    assignedTo,
    source,
    q,
    priority,
    followUpBefore,
    followUpAfter,
    limit = 50,
    skip = 0,
  } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (status) filter.status = Array.isArray(status) ? { $in: status } : status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (source) filter.source = source;
    if (priority) filter.priority = priority;
    if (q) {
      filter.$or = [
        { firstName: new RegExp(q, 'i') },
        { lastName: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { leadNumber: new RegExp(q, 'i') },
      ];
    }
    if (followUpBefore || followUpAfter) {
      filter.nextFollowUp = {};
      if (followUpAfter) filter.nextFollowUp.$gte = new Date(followUpAfter);
      if (followUpBefore) filter.nextFollowUp.$lte = new Date(followUpBefore);
    }

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('assignedTo', 'firstName lastName role')
        .populate('sourceId', 'name code')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async pipeline(branchId = null) {
    const filter = {
      deletedAt: null,
      status: { $nin: [LEAD_STATUS.JUNK] },
    };
    if (branchId) filter.branchId = branchId;
    return this.model
      .find(filter)
      .populate('assignedTo', 'firstName lastName')
      .sort({ priority: -1, updatedAt: -1 })
      .limit(500)
      .exec();
  }

  async dueFollowUps({ before, branchId } = {}) {
    const filter = {
      deletedAt: null,
      nextFollowUp: { $ne: null, $lte: before || new Date() },
      status: {
        $nin: [LEAD_STATUS.WON, LEAD_STATUS.LOST, LEAD_STATUS.JUNK],
      },
    };
    if (branchId) filter.branchId = branchId;
    return this.model
      .find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .sort({ nextFollowUp: 1 })
      .limit(200)
      .exec();
  }
}

export class LeadFollowUpRepository extends BaseRepository {
  constructor() {
    super(LeadFollowUp);
  }

  async listByLead(leadId) {
    return this.model
      .find({ leadId })
      .populate('assignedTo', 'firstName lastName')
      .sort({ date: -1 })
      .exec();
  }
}

export class LeadTaskRepository extends BaseRepository {
  constructor() {
    super(LeadTask);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async list({ leadId, assignedTo, status, limit = 50, skip = 0 } = {}) {
    const filter = { deletedAt: null };
    if (leadId) filter.leadId = leadId;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (status) filter.status = status;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('assignedTo', 'firstName lastName role')
        .populate('leadId', 'leadNumber firstName lastName phone status')
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export default { LeadRepository, LeadFollowUpRepository, LeadTaskRepository };
