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

  /** SEC-030 — `branchId` (when non-null) narrows the lookup itself, so an out-of-branch lead
   *  simply "does not exist" for this caller. */
  async findByIdPopulated(id, { branchId = null } = {}) {
    const filter = { _id: id, deletedAt: null };
    if (branchId) filter.branchId = branchId;
    return this.model
      .findOne(filter)
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

  async list({ leadIdsIn = null, leadId, assignedTo, status, limit = 50, skip = 0 } = {}) {
    const filter = { deletedAt: null };
    // SEC-030 — `leadIdsIn` is the branch scope expressed as lead ids (a task has no branch of
    // its own). An empty array is a real answer — "your branch has no leads" — and must filter
    // everything out, so it is applied whenever the caller passed an array at all.
    if (Array.isArray(leadIdsIn)) filter.leadId = { $in: leadIdsIn };
    // A client-supplied leadId may only NARROW within the scope, never replace it: combining
    // both with $and means `?leadId=<other branch's lead>` yields nothing rather than that
    // lead's tasks.
    if (leadId) {
      filter.leadId = Array.isArray(leadIdsIn)
        ? { $in: leadIdsIn.filter((id) => String(id) === String(leadId)) }
        : leadId;
    }
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
